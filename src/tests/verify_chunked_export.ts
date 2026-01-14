
import assert from 'assert';

// Mock types
interface MockDoc {
    id: string;
    data: () => any;
}

interface MockQuery {
    constraints: any[];
}

// Mock Firestore functions
const mockDocs = Array.from({ length: 155 }, (_, i) => ({
    id: `doc_${i}`,
    data: () => ({ index: i, value: `Value ${i}` })
}));

let getDocsCallCount = 0;
let lastStartAfterArg: any = null;

const getDocs = async (query: MockQuery) => {
    getDocsCallCount++;
    const limitConstraint = query.constraints.find(c => c.type === 'limit');
    const startAfterConstraint = query.constraints.find(c => c.type === 'startAfter');

    const limit = limitConstraint ? limitConstraint.value : mockDocs.length;
    let startIndex = 0;

    if (startAfterConstraint) {
        lastStartAfterArg = startAfterConstraint.value;
        const lastDocId = startAfterConstraint.value.id;
        const lastDocIndex = mockDocs.findIndex(d => d.id === lastDocId);
        startIndex = lastDocIndex + 1;
    }

    const docs = mockDocs.slice(startIndex, startIndex + limit);

    return {
        docs,
        empty: docs.length === 0,
        size: docs.length
    };
};

const query = (base: any, ...constraints: any[]) => {
    return {
        base,
        constraints: constraints
    };
};

const limit = (n: number) => ({ type: 'limit', value: n });
const startAfter = (doc: any) => ({ type: 'startAfter', value: doc });

// --- The Function to Test (Draft) ---
async function fetchAllDocsInBatches(
    baseQuery: any,
    batchSize: number = 50,
    onProgress?: (count: number) => void
): Promise<any[]> {
    let allDocs: any[] = [];
    let lastDoc: any = null;
    let hasMore = true;

    while (hasMore) {
        const constraints = [limit(batchSize)];
        if (lastDoc) {
            constraints.push(startAfter(lastDoc));
        }

        // Apply constraints to base query (mocked)
        // In real firestore: query(baseQuery, limit(batchSize), startAfter(lastDoc))
        const q = query(baseQuery, ...constraints);

        const snapshot = await getDocs(q);
        const docs = snapshot.docs;

        allDocs = [...allDocs, ...docs];

        if (onProgress) {
            onProgress(allDocs.length);
        }

        if (docs.length < batchSize) {
            hasMore = false;
        } else {
            lastDoc = docs[docs.length - 1];
        }
    }

    return allDocs;
}

// --- Test Execution ---
async function runTest() {
    console.log("Starting verification of chunked fetch logic...");

    // Reset counters
    getDocsCallCount = 0;

    const results = await fetchAllDocsInBatches({}, 50, (count) => {
        console.log(`Progress: fetched ${count} documents`);
    });

    console.log(`Total documents fetched: ${results.length}`);
    console.log(`Total getDocs calls: ${getDocsCallCount}`);

    // Assertions
    assert.strictEqual(results.length, 155, "Should fetch all 155 documents");

    // 155 docs / 50 batch size = 3 full batches + 1 partial batch (5 docs)
    // 1st call: 0-49 (returns 50) -> hasMore=true
    // 2nd call: 50-99 (returns 50) -> hasMore=true
    // 3rd call: 100-149 (returns 50) -> hasMore=true
    // 4th call: 150-154 (returns 5) -> hasMore=false
    assert.strictEqual(getDocsCallCount, 4, "Should make 4 calls to getDocs");

    console.log("✅ Verification Successful!");
}

runTest().catch(console.error);
