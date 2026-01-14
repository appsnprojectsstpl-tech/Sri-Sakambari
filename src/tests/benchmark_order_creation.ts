
import { performance } from 'perf_hooks';

// Mock types
type Subscription = {
    id: string;
    customerId: string;
    items: { productId: string; qty: number }[];
    frequency: 'DAILY' | 'WEEKEND' | 'ALTERNATE' | 'CUSTOM';
    isActive: boolean;
    startDate: string;
    deliverySlot: string;
    area: string;
};

// --- Mock Data ---
const NUM_SUBSCRIPTIONS = 100;
const NUM_PRODUCTS = 20;
const NUM_USERS = 50;

// Create mock users
const users: Record<string, any> = {};
for (let i = 0; i < NUM_USERS; i++) {
    users[`user-${i}`] = {
        name: `User ${i}`,
        phone: `123456789${i}`,
        address: `Address ${i}`
    };
}

// Create mock products
const products: Record<string, any> = {};
for (let i = 0; i < NUM_PRODUCTS; i++) {
    products[`prod-${i}`] = {
        name: `Product ${i}`,
        name_te: `Product TE ${i}`,
        unit: 'kg',
        pricePerUnit: 10 + i
    };
}

// Create mock subscriptions
const subscriptions: Subscription[] = [];
for (let i = 0; i < NUM_SUBSCRIPTIONS; i++) {
    subscriptions.push({
        id: `sub-${i}`,
        customerId: `user-${i % NUM_USERS}`,
        items: [{ productId: `prod-${i % NUM_PRODUCTS}`, qty: 1 }],
        frequency: 'DAILY',
        isActive: true,
        startDate: new Date().toISOString(),
        deliverySlot: 'Morning',
        area: 'Area 1'
    });
}

// --- Benchmark Functions ---

async function benchmarkSequentialTransactions() {
    const start = performance.now();
    let currentId = 1000;

    // Simulation of the sequential loop with transaction overhead
    for (const sub of subscriptions) {
        // 1. Transaction Start Overhead (network RTT simulation)
        await new Promise(resolve => setTimeout(resolve, 5)); // 5ms latency

        // 2. Read Counter
        // await db.doc('counters/orders').get()
        await new Promise(resolve => setTimeout(resolve, 2)); // 2ms read

        // 3. Read User
        // await db.doc(`users/${sub.customerId}`).get()
        const _user = users[sub.customerId];
        await new Promise(resolve => setTimeout(resolve, 2)); // 2ms read

        // 4. Read Products (getAll)
        // await transaction.getAll(...)
        const _prods = sub.items.map(item => products[item.productId]);
        await new Promise(resolve => setTimeout(resolve, 5)); // 5ms read multiple

        // 5. Logic & Write
        currentId++;
        const _orderId = `ORD-${currentId}`;

        // Write Counter & Order
        // transaction.set(...)
        await new Promise(resolve => setTimeout(resolve, 10)); // 10ms write commit
    }

    const end = performance.now();
    return end - start;
}

async function benchmarkOptimizedBulk() {
    const start = performance.now();
    let currentId = 1000;

    // 1. Pre-fetch Data
    // Get all unique customer IDs
    const userIds = [...new Set(subscriptions.map(s => s.customerId))];
    // Get all unique product IDs
    const productIds = [...new Set(subscriptions.flatMap(s => s.items.map(i => i.productId)))];

    // Bulk Fetch Users (simulated)
    // await db.collection('users').where(documentId(), 'in', userIds).get()
    await new Promise(resolve => setTimeout(resolve, 20)); // One bigger read
    const userMap = new Map();
    userIds.forEach(id => userMap.set(id, users[id]));

    // Bulk Fetch Products (simulated)
    // await db.collection('products').where(documentId(), 'in', productIds).get()
    await new Promise(resolve => setTimeout(resolve, 20)); // One bigger read
    const productMap = new Map();
    productIds.forEach(id => productMap.set(id, products[id]));

    // 2. Reserve IDs (One Transaction)
    // await db.runTransaction(...)
    await new Promise(resolve => setTimeout(resolve, 20)); // One transaction overhead
    const startId = currentId + 1;
    currentId += subscriptions.length;

    // 3. In-Memory Processing
    const ordersToWrite = [];
    let idCounter = startId;
    for (const sub of subscriptions) {
        const user = userMap.get(sub.customerId);
        const subProducts = sub.items.map(item => productMap.get(item.productId));
        // logic...
        ordersToWrite.push({ id: `ORD-${idCounter++}`, ...sub });
    }

    // 4. Bulk Write (Batched)
    // Chunk into 500s
    const batchSize = 500;
    for (let i = 0; i < ordersToWrite.length; i += batchSize) {
        // const batch = db.batch();
        // ... batch.set ...
        // await batch.commit();
        await new Promise(resolve => setTimeout(resolve, 50)); // Batch commit latency
    }

    const end = performance.now();
    return end - start;
}

async function runBenchmarks() {
    console.log(`Running Benchmark with ${NUM_SUBSCRIPTIONS} subscriptions...`);

    console.log("Running Sequential Transaction Approach...");
    const seqTime = await benchmarkSequentialTransactions();
    console.log(`> Sequential Time: ${seqTime.toFixed(2)}ms`);

    console.log("Running Optimized Bulk Approach...");
    const optTime = await benchmarkOptimizedBulk();
    console.log(`> Optimized Time: ${optTime.toFixed(2)}ms`);

    console.log(`\nImprovement: ${(seqTime / optTime).toFixed(2)}x faster`);
}

runBenchmarks();
