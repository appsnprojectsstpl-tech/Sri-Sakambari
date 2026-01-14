
import { performance } from 'perf_hooks';

// Simulation Configuration
const NUM_ITEMS = 50;
const NETWORK_LATENCY_MS = 50;
const PROCESSING_TIME_MS = 2;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to limit concurrency
async function pMap<T, R>(
    array: T[],
    mapper: (item: T) => Promise<R>,
    concurrency: number
): Promise<R[]> {
    const results = new Array<R>(array.length);
    let index = 0;

    const worker = async () => {
        while (index < array.length) {
            const i = index++;
            results[i] = await mapper(array[i]);
        }
    };

    const workers = Array.from({ length: Math.min(concurrency, array.length) }, () => worker());
    await Promise.all(workers);
    return results;
}

// Approach 1: Individual Fetches (N+1) with Concurrency Limit (Browser usually ~6)
async function fetchIndividually(ids: string[]) {
    const start = performance.now();

    // Simulate browser connection limit of 6
    await pMap(ids, async (id) => {
        await sleep(NETWORK_LATENCY_MS + PROCESSING_TIME_MS);
        return { id };
    }, 6);

    const end = performance.now();
    return end - start;
}

// Approach 2: Batched Fetches
async function fetchBatched(ids: string[]) {
    const start = performance.now();

    const chunkSize = 30;
    const chunks = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
        chunks.push(ids.slice(i, i + chunkSize));
    }

    // Even batches execute in parallel, but there are only 2 of them (50/30 = 2 chunks)
    // So they easily fit within the concurrency limit of 6.
    await Promise.all(chunks.map(async (chunk) => {
        // Latency + processing time for the batch
        // A batch request is one network roundtrip, but DB takes longer to scan/fetch 30 docs
        await sleep(NETWORK_LATENCY_MS + (chunk.length * PROCESSING_TIME_MS));
        return chunk;
    }));

    const end = performance.now();
    return end - start;
}

async function runBenchmark() {
    console.log(`Running Benchmark: Fetching ${NUM_ITEMS} items`);
    console.log(`Parameters: Latency=${NETWORK_LATENCY_MS}ms, Processing/Doc=${PROCESSING_TIME_MS}ms`);
    console.log(`Concurrency Limit for Individual: 6`);

    console.log('\n--- Approach 1: Individual Fetches (Concurrency Limited) ---');
    const timeIndividual = await fetchIndividually(Array.from({ length: NUM_ITEMS }, (_, i) => `${i}`));
    console.log(`Time: ${timeIndividual.toFixed(2)}ms`);

    console.log('\n--- Approach 2: Batched Fetches ---');
    const timeBatched = await fetchBatched(Array.from({ length: NUM_ITEMS }, (_, i) => `${i}`));
    console.log(`Time: ${timeBatched.toFixed(2)}ms`);

    const improvement = ((timeIndividual - timeBatched) / timeIndividual) * 100;
    console.log(`\nImprovement: ${improvement.toFixed(2)}%`);
}

runBenchmark();
