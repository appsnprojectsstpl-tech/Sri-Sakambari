
// Mock types to avoid importing firebase
type WhereFilterOp =
  | '<'
  | '<='
  | '=='
  | '!='
  | '>='
  | '>'
  | 'array-contains'
  | 'in'
  | 'not-in'
  | 'array-contains-any';

type OrderByDirection = 'desc' | 'asc';

type Constraint =
  | ['where', string, WhereFilterOp, any]
  | ['orderBy', string, OrderByDirection?]
  | ['limit', number]
  | ['limitToLast', number]
  | ['startAfter', ...any[]]
  | ['endBefore', ...any[]];

interface MockTimestamp {
    seconds: number;
    nanoseconds: number;
}

// COPIED FROM src/firebase/firestore/utils.ts to avoid dependency issues in benchmark environment
function deepCompare(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return a === b;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Handle Firebase Timestamps if they appear
  if (a instanceof Object && 'seconds' in a && 'nanoseconds' in a && b instanceof Object && 'seconds' in b && 'nanoseconds' in b) {
      return a.seconds === b.seconds && a.nanoseconds === b.nanoseconds;
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepCompare(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !deepCompare(a[key], b[key])) return false;
  }
  return true;
}

function compareConstraints(a: Constraint[] | undefined, b: Constraint[] | undefined): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
        const c1 = a[i];
        const c2 = b[i];

        if (c1 === c2) continue;
        if (c1.length !== c2.length) return false;

        // Optimistically assume the first element (type) matches
        if (c1[0] !== c2[0]) return false;

        for (let j = 1; j < c1.length; j++) {
            const v1 = c1[j];
            const v2 = c2[j];

            if (v1 === v2) continue;

            if (typeof v1 === 'object' && v1 !== null && typeof v2 === 'object' && v2 !== null) {
                if (v1 instanceof Date && v2 instanceof Date) {
                    if (v1.getTime() !== v2.getTime()) return false;
                    continue;
                }

                // Handle Firebase Timestamps
                if ('seconds' in v1 && 'nanoseconds' in v1 && 'seconds' in v2 && 'nanoseconds' in v2) {
                    // Cast to any/MockTimestamp
                    if ((v1 as any).seconds !== (v2 as any).seconds || (v1 as any).nanoseconds !== (v2 as any).nanoseconds) {
                        return false;
                    }
                    continue;
                }

                if (Array.isArray(v1) && Array.isArray(v2)) {
                     if (v1.length !== v2.length) return false;
                     // Use generic deep compare for array contents to be safe
                     if (!deepCompare(v1, v2)) return false;
                     continue;
                }

                if (!deepCompare(v1, v2)) return false;
            } else {
                return false;
            }
        }
    }
    return true;
}

const ITERATIONS = 100000;

function runBenchmark() {
  console.log(`Running benchmark with ${ITERATIONS} iterations...`);

  // Case 1: Simple Constraints (where clauses with primitive values)
  const constraints1: Constraint[] = [
    ['where', 'status', '==', 'active'],
    ['orderBy', 'createdAt', 'desc'],
    ['limit', 10]
  ];
  const constraints1_copy: Constraint[] = [
    ['where', 'status', '==', 'active'],
    ['orderBy', 'createdAt', 'desc'],
    ['limit', 10]
  ];

  // Case 2: Complex Constraints (arrays, Timestamps)
  const now = { seconds: 1700000000, nanoseconds: 0 }; // Mock timestamp
  const constraints2: Constraint[] = [
    ['where', 'tags', 'array-contains-any', ['urgent', 'high-priority', 'review-needed']],
    ['where', 'updatedAt', '>', now],
    ['where', 'metadata', '==', { source: 'web', version: 2 }]
  ];
  const constraints2_copy: Constraint[] = [
    ['where', 'tags', 'array-contains-any', ['urgent', 'high-priority', 'review-needed']],
    ['where', 'updatedAt', '>', now],
    ['where', 'metadata', '==', { source: 'web', version: 2 }]
  ];

  // Warmup
  for(let i=0; i<100; i++) {
      JSON.stringify(constraints1);
      compareConstraints(constraints1, constraints1_copy);
  }

  // Benchmark JSON.stringify
  const startJson = performance.now();
  let jsonMatches = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    const s1 = JSON.stringify(constraints1);
    const s2 = JSON.stringify(constraints1_copy);
    if (s1 === s2) jsonMatches++;

    const s3 = JSON.stringify(constraints2);
    const s4 = JSON.stringify(constraints2_copy);
    if (s3 === s4) jsonMatches++;
  }
  const endJson = performance.now();
  const timeJson = endJson - startJson;

  // Benchmark compareConstraints
  const startCustom = performance.now();
  let customMatches = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    if (compareConstraints(constraints1, constraints1_copy)) customMatches++;
    if (compareConstraints(constraints2, constraints2_copy)) customMatches++;
  }
  const endCustom = performance.now();
  const timeCustom = endCustom - startCustom;

  console.log(`JSON.stringify time: ${timeJson.toFixed(2)}ms`);
  console.log(`compareConstraints time: ${timeCustom.toFixed(2)}ms`);
  console.log(`Improvement: ${(timeJson / timeCustom).toFixed(2)}x faster`);

  if (timeCustom > timeJson) {
      console.warn("WARNING: Custom comparison is SLOWER than JSON.stringify");
  } else {
      console.log("SUCCESS: Custom comparison is faster.");
  }
}

runBenchmark();
