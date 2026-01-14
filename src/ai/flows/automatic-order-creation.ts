'use server';

/**
 * @fileOverview Automatically creates orders based on active subscriptions.
 *
 * - automaticOrderCreation - A function that handles the automatic order creation process.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  AutomaticOrderCreationInputSchema,
  AutomaticOrderCreationOutputSchema,
  type AutomaticOrderCreationInput,
  type AutomaticOrderCreationOutput,
  type Subscription,
  type Order,
  type OrderItem,
} from '@/lib/types';
import { adminDb } from '@/lib/server/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { startOfDay, isWeekend, differenceInDays } from 'date-fns';
import { chunkArray } from '@/firebase/firestore/utils';

// Define minimal types for what we expect in the DB if strict types are not available
// However, we can probably use the types from @/lib/types if they are complete enough.
// Let's assume the DB data matches the types mostly, or use 'any' for the data part but typed maps.

export async function automaticOrderCreation(
  input: AutomaticOrderCreationInput
): Promise<AutomaticOrderCreationOutput> {
  return automaticOrderCreationFlow(input);
}

const automaticOrderCreationFlow = ai.defineFlow(
  {
    name: 'automaticOrderCreationFlow',
    inputSchema: AutomaticOrderCreationInputSchema,
    outputSchema: AutomaticOrderCreationOutputSchema,
  },
  async (input) => {
    console.log('Starting automatic order creation flow...');
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayStr = todayStart.toISOString();
    let ordersCreatedCount = 0;

    // 1. Fetch active subscriptions
    const subscriptionsSnapshot = await adminDb
      .collection('subscriptions')
      .where('isActive', '==', true)
      .get();

    if (subscriptionsSnapshot.empty) {
      console.log('No active subscriptions found.');
      return { ordersCreated: 0 };
    }

    console.log(`Found ${subscriptionsSnapshot.size} active subscriptions.`);

    // 2. Pre-fetch existing orders for today to avoid N+1 queries
    const existingOrdersSnapshot = await adminDb
      .collection('orders')
      .where('deliveryDate', '==', todayStart.toISOString())
      .where('orderType', '==', 'SUBSCRIPTION_GENERATED')
      .get();

    const existingSubscriptionOrderIds = new Set<string>();
    existingOrdersSnapshot.forEach(doc => {
      const order = doc.data() as Order;
      if (order.subscriptionId) {
        existingSubscriptionOrderIds.add(order.subscriptionId);
      }
    });

    console.log(`Found ${existingSubscriptionOrderIds.size} existing subscription orders for today.`);

    // 3. Filter subscriptions requiring order creation
    const subscriptionsToProcess: Subscription[] = [];

    for (const doc of subscriptionsSnapshot.docs) {
      const subscription = { id: doc.id, ...doc.data() } as Subscription;

      // Safety check for endDate
      if (subscription.endDate) {
        const endDate =
          subscription.endDate instanceof Timestamp
            ? subscription.endDate.toDate()
            : new Date(subscription.endDate);
        if (startOfDay(endDate) < todayStart) {
            continue;
        }
      }

      // Check Frequency Logic
      let shouldCreateOrder = false;
      const startDate =
        subscription.startDate instanceof Timestamp
          ? subscription.startDate.toDate()
          : new Date(subscription.startDate);

      if (startOfDay(startDate) > todayStart) {
         continue;
      }

      switch (subscription.frequency) {
        case 'DAILY':
          shouldCreateOrder = true;
          break;
        case 'WEEKEND':
          shouldCreateOrder = isWeekend(now);
          break;
        case 'ALTERNATE':
          const daysDiff = differenceInDays(todayStart, startOfDay(startDate));
          shouldCreateOrder = daysDiff % 2 === 0;
          break;
        case 'CUSTOM':
          if (subscription.customDays && subscription.customDays.length > 0) {
            shouldCreateOrder = subscription.customDays.includes(now.getDay());
          }
          break;
        default:
          shouldCreateOrder = false;
      }

      if (!shouldCreateOrder) continue;

      // Idempotency Check
      if (existingSubscriptionOrderIds.has(subscription.id)) {
        continue;
      }

      if (!subscription.items || subscription.items.length === 0) continue;

      subscriptionsToProcess.push(subscription);
    }

    if (subscriptionsToProcess.length === 0) {
      console.log('No subscriptions need processing after filtering.');
      return { ordersCreated: 0 };
    }

    console.log(`Processing ${subscriptionsToProcess.length} subscriptions...`);

    // 4. Bulk Pre-fetch Users and Products
    const userIds = new Set<string>();
    const productIds = new Set<string>();

    for (const sub of subscriptionsToProcess) {
      if (sub.customerId) userIds.add(sub.customerId);
      if (sub.items) {
        sub.items.forEach(item => productIds.add(item.productId));
      }
    }

    // Fetch Users in Batches (e.g. 10 or 30 IDs per 'in' query)
    // Actually, 'in' query limit is 30. adminDb.getAll handles many args, but let's be safe and chunk.
    const usersMap = new Map<string, any>();
    const productMap = new Map<string, any>();

    // Helper to fetch docs by ID
    async function fetchDocsByIds(ids: Set<string>, collection: 'users' | 'products', map: Map<string, any>) {
      const idList = Array.from(ids);
      const chunks = chunkArray(idList, 100); // 100 fits easily in getAll args.
      // Note: getAll(...refs) is more efficient than where('__name__', 'in', ...) for exact IDs.

      const promises = chunks.map(async (chunk) => {
        const refs = chunk.map(id => adminDb.doc(`${collection}/${id}`));
        const docs = await adminDb.getAll(...refs);
        docs.forEach(doc => {
           if (doc.exists) {
             map.set(doc.id, doc.data());
           }
        });
      });
      await Promise.all(promises);
    }

    await Promise.all([
      fetchDocsByIds(userIds, 'users', usersMap),
      fetchDocsByIds(productIds, 'products', productMap)
    ]);

    console.log(`Fetched ${usersMap.size} users and ${productMap.size} products.`);

    // 5. Process in Chunks using Transactions
    // Firestore transaction limit is 500 reads/writes.
    // We read 1 counter doc.
    // We write N orders + 1 counter update.
    // So N < 499. Let's use 400 for safety.
    const BATCH_SIZE = 400;
    const subscriptionChunks = chunkArray(subscriptionsToProcess, BATCH_SIZE);

    for (const chunk of subscriptionChunks) {
      try {
        await adminDb.runTransaction(async (transaction) => {
          // A. Read Counter
          const counterRef = adminDb.doc('counters/orders');
          const counterDoc = await transaction.get(counterRef);

          let nextId = 1001;
          if (counterDoc.exists) {
            nextId = (counterDoc.data()?.lastId || 1000) + 1;
          }

          let currentId = nextId;

          // B. Prepare Writes
          for (const subscription of chunk) {
            const userData = usersMap.get(subscription.customerId);
            if (!userData) {
               console.warn(`User ${subscription.customerId} not found for subscription ${subscription.id}`);
               continue;
            }

            const orderItems: OrderItem[] = [];
            let totalAmount = 0;
            let missingProduct = false;

            for (const item of subscription.items) {
               const productData = productMap.get(item.productId);
               if (!productData) {
                   console.warn(`Product ${item.productId} not found for subscription ${subscription.id}`);
                   missingProduct = true;
                   break;
               }

               const priceAtOrder = productData.pricePerUnit || 0;
               const amount = priceAtOrder * item.qty;
               totalAmount += amount;

               orderItems.push({
                 productId: item.productId,
                 qty: item.qty,
                 priceAtOrder,
                 isCut: false,
                 cutCharge: 0,
                 name: productData.name,
                 name_te: productData.name_te,
                 unit: productData.unit,
               });
            }

            if (missingProduct) continue;

            const orderId = `ORD-${currentId}`;
            const newOrderRef = adminDb.doc(`orders/${orderId}`);

            const newOrder: Order = {
                id: orderId,
                customerId: subscription.customerId,
                name: userData.name || 'Unknown',
                phone: userData.phone || '',
                address: subscription.area || userData.address || '',
                deliveryPlace: 'Home',
                items: orderItems,
                totalAmount,
                paymentMode: 'COD',
                orderType: 'SUBSCRIPTION_GENERATED',
                area: subscription.area,
                deliverySlot: subscription.deliverySlot,
                deliveryDate: todayStart.toISOString(),
                status: 'PENDING',
                createdAt: new Date(),
                subscriptionId: subscription.id,
            };

            transaction.set(newOrderRef, newOrder);
            ordersCreatedCount++;
            currentId++;
          }

          // Update Counter
          // The last used ID is currentId - 1.
          // We update the counter to the last ID we plan to use.
          if (currentId > nextId) {
             transaction.set(counterRef, { lastId: currentId - 1 }, { merge: true });
          }
        });
        console.log(`Processed chunk of ${chunk.length} subscriptions.`);
      } catch (error) {
        console.error('Transaction failed for a chunk of subscriptions:', error);
      }
    }

    return { ordersCreated: ordersCreatedCount };
  }
);
