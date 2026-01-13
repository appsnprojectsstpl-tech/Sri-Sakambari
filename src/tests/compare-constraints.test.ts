
import { compareConstraints, type Constraint } from '../firebase/firestore/utils';
import { Timestamp } from 'firebase/firestore'; // Assuming we can import this, or mock it

// Mock for testing if import fails (but tsx should handle it if installed)
class MockTimestamp {
    seconds: number;
    nanoseconds: number;
    constructor(seconds: number, nanoseconds: number) {
        this.seconds = seconds;
        this.nanoseconds = nanoseconds;
    }
}

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        throw new Error(`Test Failed: ${message}`);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log('--- Testing compareConstraints Correctness ---');

const c1: Constraint[] = [['where', 'status', '==', 'active']];
const c1Clone: Constraint[] = [['where', 'status', '==', 'active']];
const c2: Constraint[] = [['where', 'status', '==', 'inactive']];

assert(compareConstraints(c1, c1Clone), 'Identical simple constraints should match');
assert(!compareConstraints(c1, c2), 'Different simple constraints should not match');

// Complex with Objects
const c3: Constraint[] = [['where', 'meta', '==', { a: 1, b: 2 }]];
const c3Clone: Constraint[] = [['where', 'meta', '==', { a: 1, b: 2 }]];
const c4: Constraint[] = [['where', 'meta', '==', { a: 1, b: 3 }]];

assert(compareConstraints(c3, c3Clone), 'Identical object constraints should match');
assert(!compareConstraints(c3, c4), 'Different object constraints should not match');

// Timestamps (Duck typing test)
const ts1 = { seconds: 100, nanoseconds: 0 };
const ts2 = { seconds: 100, nanoseconds: 0 };
const ts3 = { seconds: 200, nanoseconds: 0 };

const cTS1: Constraint[] = [['where', 'time', '>', ts1]];
const cTS2: Constraint[] = [['where', 'time', '>', ts2]];
const cTS3: Constraint[] = [['where', 'time', '>', ts3]];

assert(compareConstraints(cTS1, cTS2), 'Identical timestamps (duck typed) should match');
assert(!compareConstraints(cTS1, cTS3), 'Different timestamps should not match');

// Arrays
const arr1: Constraint[] = [['where', 'tags', 'in', ['a', 'b']]];
const arr2: Constraint[] = [['where', 'tags', 'in', ['a', 'b']]];
const arr3: Constraint[] = [['where', 'tags', 'in', ['a', 'c']]];

assert(compareConstraints(arr1, arr2), 'Identical array constraints should match');
assert(!compareConstraints(arr1, arr3), 'Different array constraints should not match');

// Order/Length
const len1: Constraint[] = [['limit', 10]];
const len2: Constraint[] = [['limit', 10], ['orderBy', 'date']];

assert(!compareConstraints(len1, len2), 'Different length should not match');

console.log('All tests passed.');
