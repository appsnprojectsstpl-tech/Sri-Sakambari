
import { compareConstraints, type Constraint, deepCompare } from '../firebase/firestore/utils';
import { Timestamp } from 'firebase/firestore';

// Mocking Timestamp if needed, but we try to use the real one or a compatible object
class MockTimestamp {
  constructor(public seconds: number, public nanoseconds: number) {}
  toDate() { return new Date(this.seconds * 1000); }
}

const constraints1: Constraint[] = [
    ['where', 'category', '==', 'Vegetables'],
    ['where', 'isActive', '==', true],
    ['orderBy', 'price', 'desc'],
    ['limit', 10]
];

const constraints2: Constraint[] = [
    ['where', 'category', '==', 'Vegetables'],
    ['where', 'isActive', '==', true],
    ['orderBy', 'price', 'desc'],
    ['limit', 10]
];

const constraints3: Constraint[] = [
    ['where', 'category', '==', 'Fruits'],
    ['where', 'isActive', '==', true],
    ['orderBy', 'price', 'desc'],
    ['limit', 10]
];

// Complex constraints with Timestamp
const ts1 = new MockTimestamp(1600000000, 0);
const ts2 = new MockTimestamp(1600000000, 0);

const constraintsComplex1: Constraint[] = [
    ['where', 'createdAt', '>', ts1 as any],
    ['where', 'tags', 'array-contains', 'organic'],
    ['limit', 50]
];

const constraintsComplex2: Constraint[] = [
    ['where', 'createdAt', '>', ts2 as any],
    ['where', 'tags', 'array-contains', 'organic'],
    ['limit', 50]
];

function benchmark(name: string, fn: () => void, iterations: number) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        fn();
    }
    const end = performance.now();
    const duration = end - start;
    console.log(`${name}: ${duration.toFixed(2)}ms (${(iterations / duration * 1000).toFixed(0)} ops/s)`);
    return duration;
}

const ITERATIONS = 1000000;

console.log(`Running benchmark with ${ITERATIONS} iterations...`);

// Warmup
JSON.stringify(constraints1);
compareConstraints(constraints1, constraints2);

benchmark('JSON.stringify (Simple)', () => {
    const s = JSON.stringify(constraints1);
}, ITERATIONS);

benchmark('compareConstraints (Simple)', () => {
    compareConstraints(constraints1, constraints2);
}, ITERATIONS);

benchmark('JSON.stringify (Complex)', () => {
    const s = JSON.stringify(constraintsComplex1);
}, ITERATIONS);

benchmark('compareConstraints (Complex)', () => {
    compareConstraints(constraintsComplex1, constraintsComplex2);
}, ITERATIONS);
