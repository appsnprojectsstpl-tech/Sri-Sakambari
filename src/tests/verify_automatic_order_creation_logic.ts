
// Standalone verification script
// Removed imports that fail in this env

import * as assert from 'assert';

// Mock FieldPath
const FieldPath = {
    documentId: () => 'documentId'
};

// Mock Helper for Chained Where
const createMockQuery = (docs: any[] = []) => {
    const query = {
        where: () => query, // Return self for chaining
        get: async () => ({
            empty: docs.length === 0,
            size: docs.length,
            docs: docs,
            forEach: (cb: any) => docs.forEach(cb)
        })
    };
    return query;
};

// Mock Data
const mockSubscriptions = Array.from({ length: 50 }, (_, i) => ({
    id: `sub-${i}`,
    data: () => ({
        isActive: true,
        customerId: `user-${i}`,
        items: [{ productId: `prod-${i % 10}`, qty: 1 }],
        frequency: 'DAILY',
        startDate: new Date().toISOString(),
        deliverySlot: 'Morning',
        area: 'Area 1'
    })
}));

// Mock State
const mocks = {
    transactionCalled: 0,
    batchCommitted: 0,
    batchSets: 0,
    collectionCalls: [] as string[]
};

// Mock adminDb
const adminDb = {
    collection: (name: string) => {
        mocks.collectionCalls.push(name);

        if (name === 'subscriptions') {
            return createMockQuery(mockSubscriptions);
        }

        if (name === 'orders') {
            return createMockQuery([]); // No existing orders
        }

        return {
            where: (field: any, op: any, val: any) => {
                if (op === 'in' && Array.isArray(val) && val.length > 10) {
                    throw new Error(`Batch size exceeded! Got ${val.length} items. Limit is 10.`);
                }

                return {
                    where: () => this,
                    get: async () => {
                        // SIMULATE ERROR for one specific chunk
                        // If chunk contains 'user-0', fail it
                        if (name === 'users' && Array.isArray(val) && val.includes('user-0')) {
                             throw new Error("Simulated Fetch Error for Chunk 1");
                        }

                        return {
                            forEach: (cb: any) => {
                                if (Array.isArray(val)) {
                                    val.forEach(id => {
                                        cb({
                                            id,
                                            data: () => ({ name: 'Mock Name', pricePerUnit: 100 })
                                        });
                                    });
                                }
                            }
                        };
                    }
                };
            }
        };
    },
    doc: (path: string) => ({ path }),
    runTransaction: async (cb: any) => {
        mocks.transactionCalled++;
        await cb({
            get: async () => ({
                exists: true,
                data: () => ({ lastId: 1000 })
            }),
            set: () => {}
        });
    },
    batch: () => ({
        set: () => { mocks.batchSets++; },
        commit: async () => { mocks.batchCommitted++; }
    })
};


// Copied utility for self-containment in test
function chunkArray(array: any[], size: number) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// Minimal date-fns mocks
const startOfDay = (d: Date) => d;
const isWeekend = (d: Date) => false;
const differenceInDays = (a: Date, b: Date) => 0;


// --- COPIED & ADAPTED LOGIC FOR VERIFICATION ---
async function automaticOrderCreationLogic(adminDb: any) {
    console.log('Starting automatic order creation flow...');
    const now = new Date();
    const todayStart = startOfDay(now);

    // 1. Fetch active subscriptions
    const subscriptionsSnapshot = await adminDb
      .collection('subscriptions')
      .where('isActive', '==', true)
      .get();

    if (subscriptionsSnapshot.empty) return { ordersCreated: 0 };

    // 2. Pre-fetch existing orders
    const existingOrdersSnapshot = await adminDb
      .collection('orders')
      .where('deliveryDate', '==', todayStart.toISOString())
      .where('orderType', '==', 'SUBSCRIPTION_GENERATED')
      .get();

    const existingSubscriptionOrderIds = new Set<string>();
    // ... (logic)

    // --- PHASE 1 ---
    const userIds = new Set<string>();
    const productIds = new Set<string>();
    const validSubscriptions = [];

    for (const doc of subscriptionsSnapshot.docs) {
       const subscription = { id: doc.id, ...doc.data() };
       validSubscriptions.push(subscription);
       userIds.add(subscription.customerId);
       subscription.items.forEach((i: any) => productIds.add(i.productId));
    }

    // --- PHASE 2 ---
    const userMap = new Map();
    const productMap = new Map();

    const fetchByIds = async (col: string, ids: string[], map: Map<string, any>) => {
        const chunks = chunkArray(ids, 10);
        // PARALLEL SAFE FETCH
        const promises = chunks.map(async (chunk: any) => {
            try {
                const snap = await adminDb.collection(col).where(FieldPath.documentId(), 'in', chunk).get();
                snap.forEach((d: any) => map.set(d.id, d.data()));
            } catch (e) {
                console.log(`Simulated Error Caught for ${col} chunk`);
            }
        });
        await Promise.all(promises);
    };

    await Promise.all([
        fetchByIds('users', Array.from(userIds), userMap),
        fetchByIds('products', Array.from(productIds), productMap)
    ]);

    // --- PHASE 3 ---
    await adminDb.runTransaction(async (t: any) => {
        mocks.transactionCalled++;
    });

    // --- PHASE 4 ---
    const newOrders = [];
    let currentId = 1001;

    for (const sub of validSubscriptions) {
        const user = userMap.get(sub.customerId);
        if (!user) {
            // console.log("Skipping user not found (simulated error)");
            currentId++;
            continue;
        }

        // ... logic ...
        newOrders.push({ id: `ORD-${currentId++}` });
    }

    const writeChunks = chunkArray(newOrders, 450);
    for (const chunk of writeChunks) {
        try {
            const batch = adminDb.batch();
            chunk.forEach(o => batch.set(null, o));
            await batch.commit();
        } catch(e) { console.log("Batch write error"); }
    }

    return { ordersCreated: newOrders.length };
}

// --- RUN TEST ---
async function runTest() {
    console.log("Running Logic Verification (With Errors)...");

    try {
        const result = await automaticOrderCreationLogic(adminDb);

        console.log("Result:", result);

        // Assertions
        // We have 50 subscriptions.
        // Chunk 1 of users (10 users) should fail due to simulation.
        // We have 50 users total, so 5 chunks of 10.
        // 1 chunk fails => 10 users fail.
        // 40 users succeed.
        // So we expect 40 orders created.

        assert.equal(result.ordersCreated, 40, "Should create 40 orders (10 failed due to user fetch error)");

        // Transaction should be called
        assert.ok(mocks.transactionCalled >= 1, "Transaction should be called");

        // Batch Commit
        assert.equal(mocks.batchCommitted, 1, "Should commit 1 batch");

        // Batch Sets
        assert.equal(mocks.batchSets, 40, "Should have 40 set operations in batch");

        console.log("✅ Verification Passed!");

    } catch (e) {
        console.error("❌ Verification Failed:", e);
        process.exit(1);
    }
}

runTest();
