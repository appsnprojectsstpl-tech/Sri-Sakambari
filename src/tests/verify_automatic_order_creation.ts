
import { automaticOrderCreation } from '../ai/flows/automatic-order-creation';
import { adminDb } from '../lib/server/firebase';
import { Timestamp } from 'firebase-admin/firestore';

// Polyfills for date-fns functions to avoid dependency issues in broken env
function startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
}

function differenceInDays(dateLeft: Date, dateRight: Date): number {
    const diffTime = Math.abs(dateLeft.getTime() - dateRight.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

interface MockDoc {
    id: string;
    data: () => any;
    exists: boolean;
}

class MockQuerySnapshot {
    docs: MockDoc[];
    empty: boolean;
    size: number;

    constructor(docs: MockDoc[]) {
        this.docs = docs;
        this.empty = docs.length === 0;
        this.size = docs.length;
    }
}

class MockTransaction {
    async get(ref: any): Promise<MockDoc> {
        return ref._get();
    }
    async getAll(...refs: any[]): Promise<MockDoc[]> {
        return refs.map(ref => ref._get());
    }
    set(ref: any, data: any, options?: any) {
        ref._set(data);
    }
}

class MockCollection {
    name: string;
    data: Map<string, any>;

    constructor(name: string) {
        this.name = name;
        this.data = new Map();
    }

    doc(id: string) {
        return new MockDocRef(this, id);
    }

    // Simple mock query support
    where(field: string, op: string, value: any) {
        return new MockQuery(this, [{ field, op, value }]);
    }

    // Add get() to Collection for verifying all docs
    async get() {
        const results: MockDoc[] = [];
        for (const [id, data] of this.data.entries()) {
             results.push({
                id,
                data: () => data,
                exists: true
            });
        }
        return new MockQuerySnapshot(results);
    }
}

class MockQuery {
    collection: MockCollection;
    filters: any[];

    constructor(collection: MockCollection, filters: any[]) {
        this.collection = collection;
        this.filters = filters;
    }

    where(field: string, op: string, value: any) {
        this.filters.push({ field, op, value });
        return this;
    }

    async get() {
        const results: MockDoc[] = [];
        for (const [id, data] of this.collection.data.entries()) {
            let match = true;
            for (const filter of this.filters) {
                if (filter.op === '==') {
                     if (data[filter.field] !== filter.value) match = false;
                }
                // Add other ops if needed
            }
            if (match) {
                results.push({
                    id,
                    data: () => data,
                    exists: true
                });
            }
        }
        return new MockQuerySnapshot(results);
    }
}

class MockDocRef {
    collection: MockCollection;
    id: string;

    constructor(collection: MockCollection, id: string) {
        this.collection = collection;
        this.id = id;
    }

    _get() {
        const data = this.collection.data.get(this.id);
        return {
            id: this.id,
            data: () => data,
            exists: !!data
        };
    }

    _set(data: any) {
        // Merge if existing? Simplified set.
        const existing = this.collection.data.get(this.id) || {};
        this.collection.data.set(this.id, { ...existing, ...data });
    }
}

class MockDb {
    collections: Map<string, MockCollection> = new Map();

    collection(name: string) {
        if (!this.collections.has(name)) {
            this.collections.set(name, new MockCollection(name));
        }
        return this.collections.get(name)!;
    }

    doc(path: string) {
        const [col, id] = path.split('/');
        return this.collection(col).doc(id);
    }

    async runTransaction(updateFunction: (t: MockTransaction) => Promise<any>) {
        const t = new MockTransaction();
        await updateFunction(t);
    }
}

// -----------------------------------------------------------------------------
// The Logic to Test (Copy-pasted/Adapted from source to allow injection)
// -----------------------------------------------------------------------------
// Note: We use our local polyfills here instead of imports

async function testableOrderCreation(db: any, currentDate: Date) {
    const todayStart = startOfDay(currentDate);
    const todayStr = todayStart.toISOString();
    let ordersCreatedCount = 0;

    // 1. Fetch active subscriptions
    const subscriptionsSnapshot = await db
      .collection('subscriptions')
      .where('isActive', '==', true)
      .get();

    for (const doc of subscriptionsSnapshot.docs) {
      const subscription = { id: doc.id, ...doc.data() };

      if (subscription.endDate) {
        const endDate = new Date(subscription.endDate); // Mock assumes string/date, not Timestamp
        if (startOfDay(endDate) < todayStart) continue;
      }

      let shouldCreateOrder = false;
      const startDate = new Date(subscription.startDate);
      if (startOfDay(startDate) > todayStart) continue;

      switch (subscription.frequency) {
        case 'DAILY':
          shouldCreateOrder = true;
          break;
        case 'WEEKEND':
          shouldCreateOrder = isWeekend(currentDate);
          break;
        case 'ALTERNATE':
          const daysDiff = differenceInDays(todayStart, startOfDay(startDate));
          shouldCreateOrder = daysDiff % 2 === 0;
          break;
        case 'CUSTOM':
          if (subscription.customDays && subscription.customDays.length > 0) {
            shouldCreateOrder = subscription.customDays.includes(currentDate.getDay());
          }
          break;
        default:
          shouldCreateOrder = false;
      }

      if (!shouldCreateOrder) continue;

      // Idempotency
      const existingOrdersSnapshot = await db
        .collection('orders')
        .where('customerId', '==', subscription.customerId)
        .where('deliveryDate', '==', todayStart.toISOString())
        .where('orderType', '==', 'SUBSCRIPTION_GENERATED')
        .get();

      const orderAlreadyExists = existingOrdersSnapshot.docs.some((d: any) => {
        return d.data().subscriptionId === subscription.id;
      });

      if (orderAlreadyExists) continue;

      await db.runTransaction(async (transaction: any) => {
          const counterRef = db.doc('counters/orders');
          const counterDoc = await transaction.get(counterRef);

          const userDoc = await transaction.get(db.doc(`users/${subscription.customerId}`));
          if (!userDoc.exists) return; // Should handle error in real code

          // Mock products fetch - assuming simplified for test
          // In real code we fetch products. Here we just assume success for counters.
          // MOCKING PRODUCT FETCH (Simplified for verification script)
          const productRefs = subscription.items.map((item: any) => db.doc(`products/${item.productId}`));
          const productDocs = await transaction.getAll(...productRefs);

          const orderItems: any[] = [];
          subscription.items.forEach((item: any, index: number) => {
             const productDoc = productDocs[index];
             const productData = productDoc.data();

             orderItems.push({
               productId: item.productId,
               qty: item.qty,
               priceAtOrder: productData?.pricePerUnit || 0,
               isCut: false,
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
          const newOrderRef = db.doc(`orders/${orderId}`);

          transaction.set(counterRef, { lastId: nextId }, { merge: true });
          transaction.set(newOrderRef, {
              id: orderId,
              subscriptionId: subscription.id,
              customerId: subscription.customerId,
              deliveryDate: todayStart.toISOString(),
              orderType: 'SUBSCRIPTION_GENERATED',
              items: orderItems
          });
      });
      ordersCreatedCount++;
    }
    return ordersCreatedCount;
}

// -----------------------------------------------------------------------------
// Test Runner
// -----------------------------------------------------------------------------

async function runTests() {
    console.log('--- Starting Verification of Order Creation Logic ---');
    const mockDb = new MockDb();

    // Setup Data
    const startDate = new Date('2024-01-01T00:00:00.000Z'); // Monday

    // Users
    mockDb.collection('users').data.set('user1', { name: 'Alice', id: 'user1' });

    // Products
    mockDb.collection('products').data.set('prod1', { pricePerUnit: 10, name: 'Apple' });

    // Subscriptions
    // 1. Daily
    mockDb.collection('subscriptions').data.set('sub_daily', {
        id: 'sub_daily',
        customerId: 'user1',
        isActive: true,
        frequency: 'DAILY',
        startDate: startDate.toISOString(),
        items: [{ productId: 'prod1', qty: 1 }],
        area: 'Area1',
        deliverySlot: 'Morning'
    });

    // 2. Weekend
    mockDb.collection('subscriptions').data.set('sub_weekend', {
        id: 'sub_weekend',
        customerId: 'user1',
        isActive: true,
        frequency: 'WEEKEND',
        startDate: startDate.toISOString(),
        items: [{ productId: 'prod1', qty: 1 }],
        area: 'Area1',
        deliverySlot: 'Morning'
    });

    // 3. Custom (Wednesdays only)
    mockDb.collection('subscriptions').data.set('sub_custom', {
        id: 'sub_custom',
        customerId: 'user1',
        isActive: true,
        frequency: 'CUSTOM',
        customDays: [3], // Wednesday
        startDate: startDate.toISOString(),
        items: [{ productId: 'prod1', qty: 1 }],
        area: 'Area1',
        deliverySlot: 'Morning'
    });

    // Test 1: Run on Monday (2024-01-01)
    // Expected: Daily created. Weekend NOT created. Custom NOT created.
    console.log('\nTest 1: Run on Monday');
    const monday = new Date('2024-01-01T10:00:00.000Z');
    const count1 = await testableOrderCreation(mockDb, monday);
    console.log(`Created: ${count1}`);

    // Verify
    const ordersMon = await mockDb.collection('orders').get();
    const subDailyOrder = ordersMon.docs.find(d => d.data().subscriptionId === 'sub_daily');
    const subWeekendOrder = ordersMon.docs.find(d => d.data().subscriptionId === 'sub_weekend');
    const subCustomOrder = ordersMon.docs.find(d => d.data().subscriptionId === 'sub_custom');

    if (subDailyOrder && !subWeekendOrder && !subCustomOrder) {
        console.log('✅ Passed: Only Daily subscription generated an order.');

        // Verify Data Integrity (Denormalization)
        const items = subDailyOrder.data().items;
        if (items && items.length > 0 && items[0].name === 'Apple') {
            console.log('✅ Passed: Product name is denormalized correctly.');
        } else {
            console.error('❌ Failed: Product name missing or incorrect on order item.', items);
        }

    } else {
        console.error('❌ Failed: Unexpected orders generated.', {
            daily: !!subDailyOrder,
            weekend: !!subWeekendOrder,
            custom: !!subCustomOrder
        });
    }

    // Test 2: Run again on Monday (Idempotency)
    console.log('\nTest 2: Idempotency check (Run again on Monday)');
    const count2 = await testableOrderCreation(mockDb, monday);
    console.log(`Created: ${count2}`);
    if (count2 === 0) {
        console.log('✅ Passed: No duplicates created.');
    } else {
        console.error(`❌ Failed: Created ${count2} duplicates.`);
    }

    // Test 3: Run on Wednesday (2024-01-03)
    // Expected: Daily created. Weekend NOT created. Custom created (Wed).
    console.log('\nTest 3: Run on Wednesday');
    const wednesday = new Date('2024-01-03T10:00:00.000Z');
    const count3 = await testableOrderCreation(mockDb, wednesday);
    console.log(`Created: ${count3}`);

    // Verify orders for Wednesday
    const ordersWed = (await mockDb.collection('orders').get()).docs.filter(d => d.data().deliveryDate === startOfDay(wednesday).toISOString());
    const dailyWed = ordersWed.find(d => d.data().subscriptionId === 'sub_daily');
    const weekendWed = ordersWed.find(d => d.data().subscriptionId === 'sub_weekend');
    const customWed = ordersWed.find(d => d.data().subscriptionId === 'sub_custom');

    if (dailyWed && !weekendWed && customWed) {
        console.log('✅ Passed: Daily and Custom generated, Weekend did not.');
    } else {
        console.error('❌ Failed: Unexpected orders generated for Wednesday.', {
            daily: !!dailyWed,
            weekend: !!weekendWed,
            custom: !!customWed
        });
    }

    // Test 4: Run on Saturday (2024-01-06)
    // Expected: Daily created. Weekend created. Custom NOT created.
    console.log('\nTest 4: Run on Saturday');
    const saturday = new Date('2024-01-06T10:00:00.000Z');
    const count4 = await testableOrderCreation(mockDb, saturday);

    const ordersSat = (await mockDb.collection('orders').get()).docs.filter(d => d.data().deliveryDate === startOfDay(saturday).toISOString());
    const dailySat = ordersSat.find(d => d.data().subscriptionId === 'sub_daily');
    const weekendSat = ordersSat.find(d => d.data().subscriptionId === 'sub_weekend');
    const customSat = ordersSat.find(d => d.data().subscriptionId === 'sub_custom');

    if (dailySat && weekendSat && !customSat) {
        console.log('✅ Passed: Daily and Weekend generated, Custom did not.');
    } else {
         console.error('❌ Failed: Unexpected orders generated for Saturday.', {
            daily: !!dailySat,
            weekend: !!weekendSat,
            custom: !!customSat
        });
    }
}

runTests().catch(console.error);
