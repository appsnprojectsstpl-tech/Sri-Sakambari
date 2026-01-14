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
    // If this main fetch fails, we can't do anything, so let it throw or handle at top level.
    const subscriptionsSnapshot = await adminDb
      .collection('subscriptions')
      .where('isActive', '==', true)
      .get();

    if (subscriptionsSnapshot.empty) {
      console.log('No active subscriptions found.');
      return { ordersCreated: 0 };
    }

    console.log(`Found ${subscriptionsSnapshot.size} active subscriptions.`);

    // 2. Pre-fetch existing orders for today
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

    // --- PHASE 1: Collect IDs and Filter Subscriptions ---
    const userIds = new Set<string>();
    const productIds = new Set<string>();
    const validSubscriptions: Subscription[] = [];

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

      if (!shouldCreateOrder) {
        continue;
      }

      if (existingSubscriptionOrderIds.has(subscription.id)) {
        continue;
      }

      if (!subscription.items || subscription.items.length === 0) {
        continue;
      }

      // Add to process list
      validSubscriptions.push(subscription);
      userIds.add(subscription.customerId);
      subscription.items.forEach(item => productIds.add(item.productId));
    }

    if (validSubscriptions.length === 0) {
        console.log("No valid subscriptions to process after filtering.");
        return { ordersCreated: 0 };
    }

    console.log(`Processing ${validSubscriptions.length} subscriptions...`);


    // --- PHASE 2: Bulk Fetch Data (Resilient) ---
    const userMap = new Map<string, any>();
    const productMap = new Map<string, any>();

    // Helper to fetch by ID chunks safely
    const fetchByIds = async (collectionName: string, ids: string[], map: Map<string, any>) => {
        const chunks = chunkArray(ids, 10); // Firestore 'in' limit is 10

        // Process chunks in parallel but handle errors individually
        const promises = chunks.map(async (chunk) => {
            try {
                const snap = await adminDb.collection(collectionName).where(FieldPath.documentId(), 'in', chunk).get();
                snap.forEach(doc => map.set(doc.id, doc.data()));
            } catch (error) {
                console.error(`Failed to fetch chunk for ${collectionName}:`, error);
                // We continue, effectively treating these IDs as "not found"
            }
        });

        await Promise.all(promises);
    };

    await Promise.all([
        fetchByIds('users', Array.from(userIds), userMap),
        fetchByIds('products', Array.from(productIds), productMap)
    ]);

    // --- PHASE 3: Reserve IDs (Atomic Transaction) ---
    let startId = 1001;
    const ordersToCreateCount = validSubscriptions.length;

    try {
        await adminDb.runTransaction(async (t) => {
            const counterRef = adminDb.doc('counters/orders');
            const counterDoc = await t.get(counterRef);

            let lastId = 1000;
            if (counterDoc.exists) {
                lastId = counterDoc.data()?.lastId || 1000;
            }

            startId = lastId + 1;
            t.set(counterRef, { lastId: lastId + ordersToCreateCount }, { merge: true });
        });
    } catch (error) {
        console.error("Failed to reserve IDs for orders. Aborting flow.", error);
        throw error; // Critical failure, cannot proceed without IDs
    }


    // --- PHASE 4: Build Orders & Batch Write ---
    const newOrders: Order[] = [];
    let currentId = startId;

    for (const subscription of validSubscriptions) {
        const userData = userMap.get(subscription.customerId);
        if (!userData) {
            console.warn(`User ${subscription.customerId} not found for sub ${subscription.id} (or fetch failed). Skipping.`);
            // Skipping means we "wasted" a reserved ID, which is fine (gaps are acceptable).
            currentId++;
            continue;
        }

        const orderItems: OrderItem[] = [];
        let totalAmount = 0;
        let allProductsFound = true;

        for (const item of subscription.items) {
            const productData = productMap.get(item.productId);
            if (!productData) {
                console.warn(`Product ${item.productId} not found for sub ${subscription.id} (or fetch failed). Skipping.`);
                allProductsFound = false;
                break;
            }

            const priceAtOrder = productData?.pricePerUnit || 0;
            const amount = priceAtOrder * item.qty;
            totalAmount += amount;

            orderItems.push({
                productId: item.productId,
                qty: item.qty,
                priceAtOrder,
                isCut: false,
                cutCharge: 0,
                name: productData?.name,
                name_te: productData?.name_te,
                unit: productData?.unit,
            });
        }

        if (!allProductsFound) {
            currentId++;
            continue;
        }

        const orderId = `ORD-${currentId}`;
        currentId++;

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

        newOrders.push(newOrder);
    }

    // Write in chunks of 450 (Resilient)
    const writeChunks = chunkArray(newOrders, 450);
    let batchCount = 0;
    let successCount = 0;

    for (const chunk of writeChunks) {
        try {
            const batch = adminDb.batch();
            chunk.forEach(order => {
                const ref = adminDb.doc(`orders/${order.id}`);
                batch.set(ref, order);
            });
            await batch.commit();
            batchCount++;
            successCount += chunk.length;
        } catch (error) {
            console.error("Failed to commit a batch of orders:", error);
            // Continue to next batch
        }
    }

    console.log(`Successfully created ${successCount} orders in ${batchCount} batches.`);
    return { ordersCreated: successCount };
  }
);

/**
 * Splits an array into chunks of a specified size.
 */
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}
