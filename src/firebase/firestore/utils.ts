import { Timestamp } from 'firebase/firestore';

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

// Generic deep compare (fallback)
export function deepCompare(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return a === b;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepCompare(a[i], b[i])) return false;
    }
    return true;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Handle Firebase Timestamps if they appear
  // We already know a and b are objects and not null
  if ('seconds' in a && 'nanoseconds' in a && 'seconds' in b && 'nanoseconds' in b) {
      return a.seconds === b.seconds && a.nanoseconds === b.nanoseconds;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !deepCompare(a[key], b[key])) return false;
  }
  return true;
}

// Specialized Comparator for Constraints
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
                if (v1 instanceof Date && v2 instanceof Date) {
                    if (v1.getTime() !== v2.getTime()) return false;
                    continue;
                }

                // Handle Firebase Timestamps
                if ('seconds' in v1 && 'nanoseconds' in v1 && 'seconds' in v2 && 'nanoseconds' in v2) {
                    if ((v1 as Timestamp).seconds !== (v2 as Timestamp).seconds || (v1 as Timestamp).nanoseconds !== (v2 as Timestamp).nanoseconds) {
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
