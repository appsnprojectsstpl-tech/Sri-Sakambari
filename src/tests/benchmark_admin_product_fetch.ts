
import { performance } from 'perf_hooks';

// Mock simulation of Network Latency
const NETWORK_LATENCY_MS = 100; // Average round trip
const BROWSER_CONCURRENCY_LIMIT = 6; // Typical browser limit per domain

async function mockGetDoc(id: string) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                exists: () => true,
                id,
                data: () => ({ name: `Product ${id}`, price: 100 })
            });
        }, NETWORK_LATENCY_MS);
    });
}

async function mockGetDocsBatch(ids: string[]) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const docs = ids.map(id => ({
                exists: () => true,
                id,
                data: () => ({ name: `Product ${id}`, price: 100 })
            }));
            resolve({ docs });
        }, NETWORK_LATENCY_MS); // One request for the batch
    });
}

async function runBenchmark() {
    console.log('⚡ Benchmarking Product Fetch Strategies (Simulating Browser Concurrency)');
    const ids = Array.from({ length: 30 }, (_, i) => `prod_${i}`);

    // --- Strategy 1: N+1 (Current) ---
    console.log(`\nTesting N+1 Strategy (30 items, limited to ${BROWSER_CONCURRENCY_LIMIT} concurrent requests)...`);
    const startN1 = performance.now();

    // Simulate browser queuing behavior
    const results: Promise<any>[] = [];
    const executing: Promise<any>[] = [];
    for (const id of ids) {
        const p = mockGetDoc(id).then(res => {
            executing.splice(executing.indexOf(p), 1);
            return res;
        });
        results.push(p);
        executing.push(p);
        if (executing.length >= BROWSER_CONCURRENCY_LIMIT) {
            await Promise.race(executing);
        }
    }
    await Promise.all(results);

    const endN1 = performance.now();
    const timeN1 = endN1 - startN1;
    console.log(`N+1 Duration: ${timeN1.toFixed(2)}ms`);

    // --- Strategy 2: Batched (Optimized) ---
    console.log(`\nTesting Batched Strategy (Chunks of 10)...`);
    const startBatch = performance.now();

    const CHUNK_SIZE = 10;
    const chunks = [];
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        chunks.push(ids.slice(i, i + CHUNK_SIZE));
    }

    // 3 requests is well within concurrency limit, so they run fully parallel
    await Promise.all(chunks.map(chunk => mockGetDocsBatch(chunk)));

    const endBatch = performance.now();
    const timeBatch = endBatch - startBatch;
    console.log(`Batched Duration: ${timeBatch.toFixed(2)}ms`);

    // --- Results ---
    console.log('\n--- Summary ---');
    console.log(`Improvement: ${(timeN1 - timeBatch).toFixed(2)}ms faster`);
    console.log(`Speedup: ${(timeN1 / timeBatch).toFixed(2)}x`);
}

runBenchmark();
