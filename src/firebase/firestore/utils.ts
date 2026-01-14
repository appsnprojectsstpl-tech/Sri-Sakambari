import {
  Timestamp,
  getDocs,
  query,
  limit,
  startAfter,
  Query,
  DocumentData,
  QuerySnapshot
} from 'firebase/firestore';

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

/**
 * Fetches all documents from a query in batches to avoid Firestore limits and timeouts.
 *
 * @param baseQuery The base query to execute (e.g., collection reference or query with filters).
 *                  IMPORTANT: The query MUST be ordered by a unique field (or set of fields)
 *                  consistent with the cursor strategy. Ideally, order by 'id' or 'createdAt'.
 * @param batchSize The number of documents to fetch per batch (default: 500).
 * @param onProgress Optional callback to report the total number of documents fetched so far.
 * @returns A promise resolving to an array of all documents (with IDs merged).
 */
export async function fetchAllDocsInBatches<T = DocumentData>(
  baseQuery: Query<T>,
  batchSize: number = 500,
  onProgress?: (count: number) => void
): Promise<(T & { id: string })[]> {
  let allDocs: (T & { id: string })[] = [];
  let lastDoc: any = null;
  let hasMore = true;

  while (hasMore) {
    const constraints: any[] = [limit(batchSize)];
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const q = query(baseQuery, ...constraints);
    const snapshot: QuerySnapshot<T> = await getDocs(q);

    // Process current batch
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as T & { id: string }));

    allDocs.push(...docs);

    if (onProgress) {
      onProgress(allDocs.length);
    }

    if (snapshot.docs.length < batchSize) {
      hasMore = false;
    } else {
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }
  }

  return allDocs;
}
