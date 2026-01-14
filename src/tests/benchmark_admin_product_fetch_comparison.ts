
import { performance } from 'perf_hooks';

// Mock data
const TOTAL_ITEMS = 50;
const CHUNK_SIZE = 10;
const NETWORK_LATENCY_MS = 50;
const CONCURRENCY_LIMIT = 6;

// Simulate a network request with concurrency limit
let activeRequests = 0;
const queue: (() => void)[] = [];

const simulateRequest = async (id: string | string[]) => {
  return new Promise<void>((resolve) => {
    const execute = () => {
      activeRequests++;
      setTimeout(() => {
        activeRequests--;
        if (queue.length > 0) {
          const next = queue.shift();
          next?.();
        }
        resolve();
      }, NETWORK_LATENCY_MS);
    };

    if (activeRequests < CONCURRENCY_LIMIT) {
      execute();
    } else {
      queue.push(execute);
    }
  });
};

async function benchmarkNPlusOne() {
  const ids = Array.from({ length: TOTAL_ITEMS }, (_, i) => `id_${i}`);
  const start = performance.now();

  await Promise.all(ids.map(async (id) => {
    await simulateRequest(id);
  }));

  return performance.now() - start;
}

async function benchmarkBatched() {
  const ids = Array.from({ length: TOTAL_ITEMS }, (_, i) => `id_${i}`);
  const start = performance.now();

  const chunks = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + CHUNK_SIZE));
  }

  await Promise.all(chunks.map(async (chunk) => {
    await simulateRequest(chunk);
  }));

  return performance.now() - start;
}

async function run() {
  console.log(`Benchmarking Fetch Strategies for ${TOTAL_ITEMS} items`);
  console.log(`Latency: ${NETWORK_LATENCY_MS}ms, Concurrency Limit: ${CONCURRENCY_LIMIT}`);

  const nPlusOneTime = await benchmarkNPlusOne();
  console.log(`N+1 Query Time: ${nPlusOneTime.toFixed(2)}ms`);

  const batchedTime = await benchmarkBatched();
  console.log(`Batched Query Time: ${batchedTime.toFixed(2)}ms`);

  const improvement = nPlusOneTime / batchedTime;
  console.log(`Speedup: ${improvement.toFixed(2)}x`);
}

run();
