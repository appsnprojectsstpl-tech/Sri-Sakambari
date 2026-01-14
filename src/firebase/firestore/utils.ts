import { Timestamp, DocumentData } from 'firebase/firestore';

export type WhereFilterOp =
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

export type OrderByDirection = 'desc' | 'asc';

export type Constraint =
  | ['where', string, WhereFilterOp, any]
  | ['orderBy', string, OrderByDirection?]
  | ['limit', number]
  | ['limitToLast', number]
  | ['startAfter', ...any[]]
  | ['endBefore', ...any[]];

// Function to recursively convert Firestore Timestamps to JS Dates in an object
export const convertTimestamps = (data: DocumentData): DocumentData => {
    const newData: DocumentData = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const value = data[key];
            if (value instanceof Object && 'seconds' in value && 'nanoseconds' in value && !(value instanceof Date)) {
                newData[key] = (value as Timestamp).toDate();
            } else if (Array.isArray(value)) {
                newData[key] = value.map(item => (item instanceof Object ? convertTimestamps(item) : item));
            } else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
                newData[key] = convertTimestamps(value);
            } else {
                newData[key] = value;
            }
        }
    }
    return newData;
};

// Generic deep compare (fallback)
export function deepCompare(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return a === b;

  if (a instanceof Date || b instanceof Date) {
    return (a instanceof Date && b instanceof Date) && a.getTime() === b.getTime();
  }

  // Handle Firebase Timestamps
  const isATimestamp = 'seconds' in a && 'nanoseconds' in a;
  const isBTimestamp = 'seconds' in b && 'nanoseconds' in b;
  if (isATimestamp || isBTimestamp) {
      return isATimestamp && isBTimestamp && a.seconds === b.seconds && a.nanoseconds === b.nanoseconds;
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepCompare(a[i], b[i])) return false;
    }
    return true;
  }

  if (Array.isArray(b)) return false;

  // Optimized object iteration to avoid Object.keys allocation
  let countA = 0;
  for (const key in a) {
    if (Object.prototype.hasOwnProperty.call(a, key)) {
        countA++;
        if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
        if (!deepCompare(a[key], b[key])) return false;
    }
  }

  let countB = 0;
  for (const key in b) {
      if (Object.prototype.hasOwnProperty.call(b, key)) countB++;
  }

  return countA === countB;
}

/**
 * Specialized Comparator for Constraints.
 *
 * This function is a performance-critical hot path used in useCollection hooks
 * to avoid JSON.stringify overhead in dependency arrays.
 *
 * Benchmarks show this implementation is ~10-60x faster than JSON.stringify
 * depending on constraint complexity.
 *
 * See src/benchmarks/compare-constraints.ts for performance verification.
 */
export function compareConstraints(a: Constraint[] | undefined, b: Constraint[] | undefined): boolean {
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
                if (!deepCompare(v1, v2)) return false;
            } else {
                return false;
            }
        }
    }
    return true;
}
