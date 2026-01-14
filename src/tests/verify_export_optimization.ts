
import { Constraint } from '../firebase/firestore/utils';

// Mock types
interface MockDoc {
    id: string;
    data: () => any;
}

// Mock Firestore Data (1200 orders)
const TOTAL_ORDERS = 1200;
const mockOrders: any[] = [];
// Create orders with decreasing timestamps
const baseTime = Date.now();
for (let i = 0; i < TOTAL_ORDERS; i++) {
    mockOrders.push({
        id: `order_${i}`,
        // Distinct timestamps to ensure stable sort for cursor
        createdAt: new Date(baseTime - i * 1000).toISOString(),
        totalAmount: 100 + i
    });
}

// Mock Functions
const collection = (db: any, path: string) => path;
const orderBy = (field: string, dir: string) => ({ type: 'orderBy', field, dir });
const limit = (val: number) => ({ type: 'limit', val });
const startAfter = (...vals: any[]) => ({ type: 'startAfter', vals });
const query = (coll: string, ...constraints: any[]) => ({ coll, constraints });

const getDocs = async (q: any) => {
    let results = [...mockOrders];

    // Apply constraints
    const constraints = q.constraints || [];

    // Sort
    const orderByC = constraints.find((c: any) => c.type === 'orderBy');
    if (orderByC && orderByC.field === 'createdAt') {
        results.sort((a, b) => {
             const tA = new Date(a.createdAt).getTime();
             const tB = new Date(b.createdAt).getTime();
             return orderByC.dir === 'desc' ? tB - tA : tA - tB;
        });
    }

    // StartAfter
    const startAfterC = constraints.find((c: any) => c.type === 'startAfter');
    if (startAfterC) {
        const startVal = startAfterC.vals[0]; // Assuming createdAt is the cursor
        // Find the index of the cursor. Note: In real firestore cursor can be a doc snapshot.
        // Here we simulate passing values.
        const startIndex = results.findIndex(o => o.createdAt === startVal);
        if (startIndex !== -1) {
            results = results.slice(startIndex + 1);
        }
    }

    // Limit
    const limitC = constraints.find((c: any) => c.type === 'limit');
    if (limitC) {
        results = results.slice(0, limitC.val);
    }

    // Convert to docs
    const docs = results.map(o => ({
        id: o.id,
        data: () => o
    }));

    return { docs, size: docs.length, empty: docs.length === 0 };
};


// The function we want to implement in utils.ts
async function fetchAllDocsInBatches(
    queryBase: any,
    firestoreGetDocs: any,
    firestoreQuery: any,
    firestoreLimit: any,
    firestoreStartAfter: any,
    batchSize: number = 500
) {
    const allDocs: any[] = [];
    let lastDoc: any = null;
    let hasMore = true;
    let chunkCount = 0;

    console.log(`Starting batched fetch with size ${batchSize}...`);
    const startTime = Date.now();

    while (hasMore) {
        chunkCount++;
        const constraints = [...(queryBase.constraints || [])];

        // Add limit
        constraints.push(firestoreLimit(batchSize));

        // Add cursor if not first page
        if (lastDoc) {
             // In this specific mock setup, we are assuming sorting by createdAt
             // Ideally the cursor should match the orderBy fields.
             // For the export function, we know we order by createdAt desc.
             constraints.push(firestoreStartAfter(lastDoc.data().createdAt));
        }

        // Re-construct query with new constraints
        // In real firestore: query(baseQuery, limit(x), startAfter(y))
        // Here our mock structure is simple object
        const q = { ...queryBase, constraints };

        const snapshot = await firestoreGetDocs(q);

        snapshot.docs.forEach((doc: any) => {
            allDocs.push({ id: doc.id, ...doc.data() });
        });

        if (snapshot.docs.length < batchSize) {
            hasMore = false;
        } else {
            lastDoc = snapshot.docs[snapshot.docs.length - 1];
        }
    }

    console.log(`Finished in ${Date.now() - startTime}ms. Total Chunks: ${chunkCount}. Total Docs: ${allDocs.length}`);
    return allDocs;
}

async function verify() {
    console.log("--- Benchmark: Unbounded vs Batched ---");

    // Baseline: Unbounded
    console.log("\n1. Unbounded Fetch (Simulated)");
    const qUnbounded = query('orders', orderBy('createdAt', 'desc'));
    const startUn = Date.now();
    // In reality this might fail or be slow
    const snapUn = await getDocs(qUnbounded);
    const docsUn = snapUn.docs.map((d: any) => ({id: d.id, ...d.data()}));
    console.log(`Unbounded: ${docsUn.length} docs in ${Date.now() - startUn}ms`);


    // Optimization: Batched
    console.log("\n2. Batched Fetch");
    const qBase = query('orders', orderBy('createdAt', 'desc'));

    // We pass our mocks as the 'firestore' functions
    const docsBatched = await fetchAllDocsInBatches(
        qBase,
        getDocs,
        query,
        limit,
        startAfter,
        450
    );

    if (docsBatched.length === TOTAL_ORDERS) {
        console.log("✅ Success: All documents fetched correctly via batches.");
    } else {
        console.error(`❌ Failure: Expected ${TOTAL_ORDERS}, got ${docsBatched.length}`);
    }

    // Check order
    const isOrdered = docsBatched.every((d, i) => {
        if (i === 0) return true;
        return new Date(d.createdAt).getTime() <= new Date(docsBatched[i-1].createdAt).getTime();
    });
    console.log(`Order preserved: ${isOrdered ? 'Yes' : 'No'}`);
}

verify();
