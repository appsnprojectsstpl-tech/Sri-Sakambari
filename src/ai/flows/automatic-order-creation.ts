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
    const todayStr = todayStart.toISOString(); // For simple comparison if needed, though we'll use dates
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


    // 3. Process each subscription
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
            console.log(`Subscription ${subscription.id} has ended.`);
            continue;
        }
      }

      // 3. Check Frequency Logic
      let shouldCreateOrder = false;
      const startDate =
        subscription.startDate instanceof Timestamp
          ? subscription.startDate.toDate()
          : new Date(subscription.startDate);

      // Check if start date is in the future
      if (startOfDay(startDate) > todayStart) {
         console.log(`Subscription ${subscription.id} hasn't started yet.`);
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
        console.log(`Skipping subscription ${subscription.id} due to frequency rules.`);
        continue;
      }

      // 4. Idempotency Check: Has an order been created for this subscription today?
      if (existingSubscriptionOrderIds.has(subscription.id)) {
        console.log(`Order already exists for subscription ${subscription.id} on ${todayStr}.`);
        continue;
      }

      if (!subscription.items || subscription.items.length === 0) {
        console.log(`Subscription ${subscription.id} has no items. Skipping.`);
        continue;
      }

      // 5. Create Order via Transaction
      try {
        await adminDb.runTransaction(async (transaction) => {
          // A. Perform ALL reads first
          const counterRef = adminDb.doc('counters/orders');
          const counterDoc = await transaction.get(counterRef);

          const userDoc = await transaction.get(adminDb.doc(`users/${subscription.customerId}`));
          const userData = userDoc.data();
          if (!userData) throw new Error(`User ${subscription.customerId} not found`);

          // Fetch products in parallel or sequence (all reads)
          // Since we need to calculate totalAmount and get product details
          const productRefs = subscription.items.map(item => adminDb.doc(`products/${item.productId}`));
          const productDocs = await transaction.getAll(...productRefs);

          // B. Perform calculations and logic
          const orderItems: OrderItem[] = [];
          let totalAmount = 0;

          subscription.items.forEach((item, index) => {
             const productDoc = productDocs[index];
             if (!productDoc.exists) throw new Error(`Product ${item.productId} not found`);
             const productData = productDoc.data();

             // Basic price calculation
             const priceAtOrder = productData?.pricePerUnit || 0;
             const amount = priceAtOrder * item.qty;
             totalAmount += amount;

             orderItems.push({
               productId: item.productId,
               qty: item.qty,
               priceAtOrder,
               isCut: false, // Defaulting
               cutCharge: 0,
               name: productData?.name,
               name_te: productData?.name_te,
               unit: productData?.unit,
             });
          });

          let nextId = 1001;
          if (counterDoc.exists) {
            nextId = (counterDoc.data()?.lastId || 1000) + 1;
          }
          const orderId = `ORD-${nextId}`;
          const newOrderRef = adminDb.doc(`orders/${orderId}`);

          const newOrder: Order = {
            id: orderId,
            customerId: subscription.customerId,
            name: userData.name || 'Unknown',
            phone: userData.phone || '',
            address: subscription.area || userData.address || '', // Fallback
            deliveryPlace: 'Home', // Default
            items: orderItems,
            totalAmount,
            paymentMode: 'COD', // Default for subscription? Or match user pref?
            orderType: 'SUBSCRIPTION_GENERATED',
            area: subscription.area,
            deliverySlot: subscription.deliverySlot,
            deliveryDate: todayStart.toISOString(),
            status: 'PENDING',
            createdAt: new Date(),
            subscriptionId: subscription.id,
            // agreedToTerms: true
          };

          // C. Perform ALL writes
          transaction.set(counterRef, { lastId: nextId }, { merge: true });
          transaction.set(newOrderRef, newOrder);
        });

        ordersCreatedCount++;
        console.log(`Created order for subscription ${subscription.id}`);

      } catch (error) {
        console.error(`Failed to create order for subscription ${subscription.id}:`, error);
      }
    }

    return { ordersCreated: ordersCreatedCount };
  }
);
