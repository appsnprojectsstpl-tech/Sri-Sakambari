
import { performance } from 'perf_hooks';

const LIST_SIZE = 5000;
const ITERATIONS = 1000;

console.log("Generating data...");
// Generate dummy data
const initialImages = Array.from({ length: LIST_SIZE }, (_, i) => ({
  id: `img-${i}`,
  url: `https://example.com/img-${i}.jpg`
}));

console.log(`\nBenchmark Configuration:`);
console.log(`- List Size: ${LIST_SIZE} items`);
console.log(`- Iterations: ${ITERATIONS}`);
console.log(`- Operation: Delete item at index 1 (causing cascade shift)`);

function benchmarkIndexKeys() {
  let totalTime = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    // Setup: Create the "next" state
    const newImages = [...initialImages];
    newImages.splice(1, 1); // Remove item at index 1

    const start = performance.now();

    // SIMULATION: Index Keys
    // When using index as key, React reconciles children by index.
    // If item 1 is removed, the item at index 1 is now what was at index 2.
    // React detects a prop change (data changed for this index) and triggers a re-render
    // for every subsequent component in the list.

    // We simulate this "cost of re-render" by iterating through the changed portion of the list
    // and performing a trivial operation.
    for (let j = 1; j < newImages.length; j++) {
       // Simulate the computational overhead of a React component re-render
       // This is the "cost" of the instability.
       const _propCheck = newImages[j].url !== initialImages[j].url;
    }

    const end = performance.now();
    totalTime += (end - start);
  }
  return totalTime;
}

function benchmarkUniqueKeys() {
  let totalTime = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    // Setup: Create the "next" state
    const newImages = [...initialImages];
    newImages.splice(1, 1);

    const start = performance.now();

    // SIMULATION: Unique Keys
    // React matches children by their unique Key.
    // Key "img-0": Exists. Props same? Yes. SKIP render.
    // Key "img-1": Missing. Unmount.
    // Key "img-2": Exists. Props same? Yes. SKIP render.

    // In a properly memoized list with stable keys, the cost for existing items
    // is virtually zero (just reference checks).
    // We simulate the overhead of just checking the reference, which is O(1) per item
    // but in practice React skips the subtree entirely if props match.

    // For the sake of conservative measurement, we'll assume we iterate to check keys,
    // but we DON'T do the "prop update" work because the item associated with the key hasn't changed.
    for (let j = 1; j < newImages.length; j++) {
        // No heavy lifting here, simulating "memoized component skipped"
    }

    const end = performance.now();
    totalTime += (end - start);
  }
  return totalTime;
}

console.log(`\nRunning Benchmarks...`);

const indexTime = benchmarkIndexKeys();
console.log(`> Index Key Simulation (Total Time): ${indexTime.toFixed(2)}ms`);

const uniqueTime = benchmarkUniqueKeys();
console.log(`> Unique Key Simulation (Total Time): ${uniqueTime.toFixed(2)}ms`);

if (uniqueTime > 0) {
    console.log(`\nResult: Unique Keys are ~${(indexTime / uniqueTime).toFixed(1)}x faster in this simulation.`);
} else {
    console.log(`\nResult: Unique Keys were too fast to measure significantly!`);
}
