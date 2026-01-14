
import { chunkArray } from '../firebase/firestore/utils';

// Mock types
interface MockDoc {
    id: string;
    data: () => any;
}

// Mock Firestore
const mockDb: Record<string, any> = {};
for (let i = 0; i < 50; i++) {
    mockDb[`prod_${i}`] = { name: `Product ${i}`, price: 10 + i };
}

// Mock Functions
const collection = (db: any, path: string) => path;
const documentId = () => '__name__';
const where = (field: string, op: string, val: any) => ({ field, op, val });
const query = (coll: string, ...constraints: any[]) => ({ coll, constraints });

const getDocs = async (q: any) => {
    // Extract IDs from 'in' query
    const inConstraint = q.constraints.find((c: any) => c.op === 'in');
    if (!inConstraint) return { docs: [] };

    const ids = inConstraint.val as string[];
    const docs: MockDoc[] = [];

    ids.forEach(id => {
        if (mockDb[id]) {
            docs.push({
                id,
                data: () => mockDb[id]
            });
        }
    });

    return { docs };
};

async function verifyOptimization() {
    console.log("Verifying Profile Page Optimization Logic...");

    // Test Case 1: Standard case ( < 30 items)
    console.log("\nTest 1: 5 items");
    let ids = ['prod_1', 'prod_2', 'prod_3', 'prod_4', 'prod_5'];
    let fetched = await fetchProductsLogic(ids);
    if (fetched.length === 5 && fetched.every(p => p.name)) {
        console.log("✅ Fetched 5 items correctly.");
    } else {
        console.error("❌ Failed fetching 5 items.", fetched);
    }

    // Test Case 2: Boundary case (30 items)
    console.log("\nTest 2: 30 items");
    ids = Array.from({ length: 30 }, (_, i) => `prod_${i}`);
    fetched = await fetchProductsLogic(ids);
    if (fetched.length === 30) {
        console.log("✅ Fetched 30 items correctly.");
    } else {
        console.error(`❌ Failed fetching 30 items. Got ${fetched.length}`);
    }

    // Test Case 3: Large case ( > 30 items)
    console.log("\nTest 3: 50 items (Multiple chunks)");
    ids = Array.from({ length: 50 }, (_, i) => `prod_${i}`);
    fetched = await fetchProductsLogic(ids);
    if (fetched.length === 50) {
        console.log("✅ Fetched 50 items correctly.");
    } else {
        console.error(`❌ Failed fetching 50 items. Got ${fetched.length}`);
    }

    // Test Case 4: Non-existent items
    console.log("\nTest 4: Mixed existing and non-existing");
    ids = ['prod_1', 'prod_9999'];
    fetched = await fetchProductsLogic(ids);
    if (fetched.length === 1 && fetched[0].id === 'prod_1') {
        console.log("✅ Correctly handled missing item.");
    } else {
        console.error("❌ Failed missing item check.", fetched);
    }
}

// Replicate the logic inside handleRepeatOrder
async function fetchProductsLogic(itemIds: string[]) {
    const fetchedProducts: any[] = [];
    // Mocking 'firestore' object as {}
    const firestore = {};

    try {
        const chunks = chunkArray(itemIds, 30);
        await Promise.all(chunks.map(async (chunkIds) => {
            const q = query(collection(firestore, 'products'), where(documentId(), 'in', chunkIds));
            const snapshot = await getDocs(q);
            snapshot.docs.forEach((doc: any) => {
                fetchedProducts.push({ id: doc.id, ...doc.data() });
            });
        }));
    } catch (error) {
        console.error("Error:", error);
    }
    return fetchedProducts;
}

verifyOptimization();
