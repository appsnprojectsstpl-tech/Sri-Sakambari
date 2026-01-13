
import { performance } from 'perf_hooks';

// Simulation Configuration
const NETWORK_LATENCY_MS = 100;
const MAX_CONCURRENT_REQUESTS = 6;
const ADMIN_COUNT = 20;

class SimulatedNetwork {
  private activeRequests = 0;
  private queue: (() => void)[] = [];

  async request(name: string): Promise<void> {
    return new Promise((resolve) => {
      const execute = async () => {
        this.activeRequests++;
        // Simulate network delay
        await new Promise(r => setTimeout(r, NETWORK_LATENCY_MS));
        this.activeRequests--;
        resolve();
        this.processQueue();
      };

      if (this.activeRequests < MAX_CONCURRENT_REQUESTS) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }

  private processQueue() {
    if (this.activeRequests < MAX_CONCURRENT_REQUESTS && this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

async function benchmark() {
  console.log(`\nStarting Benchmark: Firestore Writes (Simulated)`);
  console.log(`------------------------------------------------`);
  console.log(`Configuration:`);
  console.log(`  Admins (Writes): ${ADMIN_COUNT}`);
  console.log(`  Network Latency: ${NETWORK_LATENCY_MS}ms`);
  console.log(`  Max Concurrent:  ${MAX_CONCURRENT_REQUESTS}`);
  console.log(`------------------------------------------------\n`);

  const network = new SimulatedNetwork();

  // --- Baseline: Promise.all(map(addDoc)) ---
  console.log(`Running Baseline (N+1 individual requests)...`);
  const startBaseline = performance.now();

  const promises = Array.from({ length: ADMIN_COUNT }).map((_, i) =>
    network.request(`addDoc-${i}`)
  );
  await Promise.all(promises);

  const endBaseline = performance.now();
  const baselineTime = endBaseline - startBaseline;
  console.log(`Baseline Time: ${baselineTime.toFixed(2)}ms`);


  // --- Optimized: writeBatch ---
  console.log(`\nRunning Optimized (1 batch request)...`);
  const startOptimized = performance.now();

  // Batch overhead is negligible, main cost is one network request
  await network.request('batchCommit');

  const endOptimized = performance.now();
  const optimizedTime = endOptimized - startOptimized;
  console.log(`Optimized Time: ${optimizedTime.toFixed(2)}ms`);

  // --- Results ---
  console.log(`\n------------------------------------------------`);
  console.log(`Results:`);
  console.log(`  Baseline:   ${baselineTime.toFixed(2)}ms`);
  console.log(`  Optimized:  ${optimizedTime.toFixed(2)}ms`);
  console.log(`  Improvement: ${(baselineTime / optimizedTime).toFixed(2)}x faster`);
  console.log(`------------------------------------------------\n`);
}

benchmark();
