
import { compareConstraints, type Constraint } from '../firebase/firestore/utils';

// Helper to deep clone constraints to avoid reference equality checks in the benchmark loop
function clone(c: Constraint[]): Constraint[] {
    return c.map(item => {
        if (Array.isArray(item)) {
            // Shallow copy of the tuple is enough to break reference equality of the outer array
            // But internal objects (like dates) might still share ref if we aren't careful.
            // For this benchmark, we want to force the comparison logic to run.
            return [...item];
        }
        return item;
    }) as any as Constraint[];
}

// Mock Timestamp for benchmark
class MockTimestamp {
    seconds: number;
    nanoseconds: number;
    constructor(seconds: number, nanoseconds: number) {
        this.seconds = seconds;
        this.nanoseconds = nanoseconds;
    }
    toDate() { return new Date(this.seconds * 1000); }
}

const simpleConstraints: Constraint[] = [
    ['where', 'status', '==', 'delivered'],
    ['orderBy', 'createdAt', 'desc'],
    ['limit', 20]
];

const complexConstraints: Constraint[] = [
    ['where', 'updatedAt', '>', new Date('2023-01-01')],
    ['where', 'tags', 'array-contains', 'urgent'],
    ['where', 'metadata', '==', { source: 'web', version: 2 }],
    ['orderBy', 'amount', 'desc'],
    ['limit', 50]
];

const timestampConstraints: Constraint[] = [
    ['where', 'createdAt', '>', new MockTimestamp(1672531200, 0)],
    ['where', 'user_id', '==', 'user_123'],
    ['orderBy', 'createdAt', 'desc']
];

function runBenchmark(name: string, fn: () => void, iterations: number = 50000) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        fn();
    }
    const end = performance.now();
    const totalMs = end - start;
    const opsPerSec = (iterations / totalMs) * 1000;

    console.log(`${name.padEnd(35)} | ${Math.floor(opsPerSec).toLocaleString().padStart(12)} ops/sec | ${totalMs.toFixed(2)}ms total`);
    return opsPerSec;
}

console.log('--- Constraint Comparison Benchmark ---');
console.log('Comparing JSON.stringify vs compareConstraints (current implementation)');
console.log('Note: Inputs are cloned to prevent reference equality optimization.\n');

// Pre-clone inputs
const simpleA = clone(simpleConstraints);
const simpleB = clone(simpleConstraints);

const complexA = clone(complexConstraints);
const complexB = clone(complexConstraints);

const timestampA = clone(timestampConstraints);
const timestampB = clone(timestampConstraints);

runBenchmark('JSON.stringify (Simple)', () => {
    JSON.stringify(simpleA) === JSON.stringify(simpleB);
});

runBenchmark('compareConstraints (Simple)', () => {
    compareConstraints(simpleA, simpleB);
});

console.log('-');

runBenchmark('JSON.stringify (Complex)', () => {
    JSON.stringify(complexA) === JSON.stringify(complexB);
});

runBenchmark('compareConstraints (Complex)', () => {
    compareConstraints(complexA, complexB);
});

console.log('-');

runBenchmark('JSON.stringify (Timestamp)', () => {
    JSON.stringify(timestampA) === JSON.stringify(timestampB);
});

runBenchmark('compareConstraints (Timestamp)', () => {
    compareConstraints(timestampA, timestampB);
});
