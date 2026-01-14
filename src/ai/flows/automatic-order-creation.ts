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
import { Timestamp, FieldPath } from 'firebase-admin/firestore';
import { startOfDay, isWeekend, differenceInDays } from 'date-fns';
import { chunkArray } from '@/firebase/firestore/utils';

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

    // 3. Filter Subscriptions to Process
    const subscriptionsToProcess: Subscription[] = [];

    for (const doc of subscriptionsSnapshot.docs) {
      const subscription = { id: doc.id, ...doc.data() } as Subscription;

      // Safety check for endDate
      if (subscription.endDate) {
        const endDate =
          subscription.endDate instanceof Timestamp
            ? subscription.endDate.toDate()
            : new Date(subscription.endDate);
        // Check if endDate (start of day) is before today (start of day)
        // This ensures the subscription is active ON the end date.
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

      // Check if start date is in the future
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
          // Simple logic: Create if days diff is even (0, 2, 4...)
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

      if (!shouldCreateOrder) {
        continue;
      }

      // Idempotency Check
      if (existingSubscriptionOrderIds.has(subscription.id)) {
        console.log(`Order already exists for subscription ${subscription.id} on ${todayStr}.`);
        continue;
      }

      if (!subscription.items || subscription.items.length === 0) {
        console.log(`Subscription ${subscription.id} has no items. Skipping.`);
        continue;
      }

      subscriptionsToProcess.push(subscription);
    }

    if (subscriptionsToProcess.length === 0) {
        console.log("No subscriptions match criteria for today.");
        return { ordersCreated: 0 };
    }

    console.log(`Preparing to create ${subscriptionsToProcess.length} orders.`);

    // 4. Bulk Fetch Data (Users and Products)
    const userIds = new Set<string>();
    const productIds = new Set<string>();

    subscriptionsToProcess.forEach(sub => {
        userIds.add(sub.customerId);
        sub.items.forEach(item => productIds.add(item.productId));
    });

    const userMap = new Map<string, any>();
    const productMap = new Map<string, any>();

    const userRefs = Array.from(userIds).map(id => adminDb.doc(`users/${id}`));
    const productRefs = Array.from(productIds).map(id => adminDb.doc(`products/${id}`));

    // adminDb.getAll supports fetching mixed collection docs, but splitting them is cleaner logic-wise
    if (userRefs.length > 0) {
        const userDocs = await adminDb.getAll(...userRefs);
        userDocs.forEach(doc => {
            if (doc.exists) userMap.set(doc.id, doc.data());
        });
    }

    if (productRefs.length > 0) {
        const productDocs = await adminDb.getAll(...productRefs);
        productDocs.forEach(doc => {
            if (doc.exists) productMap.set(doc.id, doc.data());
        });
    }

    // 5. Reserve IDs
    const ordersCount = subscriptionsToProcess.length;
    let startId = 1001;

    try {
        await adminDb.runTransaction(async (transaction) => {
            const counterRef = adminDb.doc('counters/orders');
            const counterDoc = await transaction.get(counterRef);

            if (counterDoc.exists) {
                startId = (counterDoc.data()?.lastId || 1000) + 1;
            }

            const newLastId = startId + ordersCount - 1;
            transaction.set(counterRef, { lastId: newLastId }, { merge: true });
        });
    } catch (err) {
        console.error("Failed to reserve IDs", err);
        throw new Error("Failed to reserve Order IDs");
    }

    // 6. Construct Orders
    const ordersToWrite: Order[] = [];
    let currentIdCounter = startId;

    for (const subscription of subscriptionsToProcess) {
        const userData = userMap.get(subscription.customerId);
        if (!userData) {
            console.warn(`User ${subscription.customerId} not found for subscription ${subscription.id}`);
            // Skip or fail? Skipping prevents one bad data point from blocking all
            continue;
        }

        const orderItems: OrderItem[] = [];
        let totalAmount = 0;
        let validItems = true;

        for (const item of subscription.items) {
            const productData = productMap.get(item.productId);
            if (!productData) {
                console.warn(`Product ${item.productId} not found for subscription ${subscription.id}`);
                validItems = false;
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

        if (!validItems) continue;

        const orderId = `ORD-${currentIdCounter++}`;

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

        ordersToWrite.push(newOrder);
    }

    // 7. Batch Write Orders
    const orderChunks = chunkArray(ordersToWrite, 400); // 500 limit, safe buffer
    let ordersCreatedCount = 0;

    for (const chunk of orderChunks) {
        const batch = adminDb.batch();
        chunk.forEach(order => {
            const ref = adminDb.doc(`orders/${order.id}`);
            batch.set(ref, order);
        });

        await batch.commit();
        ordersCreatedCount += chunk.length;
    }

    console.log(`Successfully created ${ordersCreatedCount} orders.`);

    return { ordersCreated: ordersCreatedCount };
  }
);
