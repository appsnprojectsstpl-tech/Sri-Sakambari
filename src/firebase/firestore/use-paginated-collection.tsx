'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  query,
  collection,
  orderBy,
  limit,
  startAfter,
  getDocs,
  where,
  type Query,
  type DocumentData,
  type FirestoreError,
  type QueryConstraint,
  type CollectionReference,
  type Timestamp,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { useFirestore } from '../provider';

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
  | ['limit', number]; // Limit in constraints overrides pageSize, but usually we use pageSize

interface UsePaginatedCollectionOptions {
  constraints?: Constraint[];
  pageSize?: number;
  disabled?: boolean;
}

interface UsePaginatedCollectionReturn<T> {
  data: T[] | null;
  loading: boolean;
  error: FirestoreError | null;
  nextPage: () => void;
  prevPage: () => void;
  refresh: () => void;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  page: number;
}

// Helper: Deep compare for constraints
function deepCompare(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return a === b;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
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

function useDeepCompareMemoize<T>(value: T): T {
  const ref = useRef<T>(value);
  if (!deepCompare(value, ref.current)) {
    ref.current = value;
  }
  return ref.current;
}

const convertTimestamps = (data: DocumentData): DocumentData => {
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

export function usePaginatedCollection<T>(
  collectionName: string,
  options: UsePaginatedCollectionOptions = {}
): UsePaginatedCollectionReturn<T> {
  const firestore = useFirestore();
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageStartCursors, setPageStartCursors] = useState<(DocumentSnapshot | null)[]>([null]); // Index 0 is null (start)
  const [hasMore, setHasMore] = useState(true);

  const { pageSize = 20, disabled = false } = options;
  const memoizedConstraints = useDeepCompareMemoize(options.constraints);

  // We need to access the raw last document snapshot to paginate.
  // The clean way is to store the "last fetched document" in state after every successful fetch.
  const [lastFetchedDoc, setLastFetchedDoc] = useState<DocumentSnapshot | null>(null);

  // Update fetchPage to set lastFetchedDoc
  const fetchPageWithDocRef = useCallback(async (cursor: DocumentSnapshot | null) => {
      if (!firestore || disabled) return;
      setLoading(true);
      setError(null);

      try {
        const collectionRef: CollectionReference = collection(firestore, collectionName);

        const rawConstraints = (memoizedConstraints || [])
          .filter(c => c[0] !== 'limit')
          .map((constraint): QueryConstraint | null => {
            const [type, ...args] = constraint;
            switch(type) {
                case 'where': return where(args[0] as string, args[1] as WhereFilterOp, args[2]);
                case 'orderBy': return orderBy(args[0] as string, args[1] as OrderByDirection | undefined);
                default: return null;
            }
          });

        // Filter out nulls and cast to QueryConstraint[]
        const queryConstraints: QueryConstraint[] = rawConstraints.filter((c): c is QueryConstraint => c !== null);

        queryConstraints.push(limit(pageSize));
        if (cursor) {
          queryConstraints.push(startAfter(cursor));
        }

        const q: Query<DocumentData> = query(collectionRef, ...queryConstraints);
        const snapshot = await getDocs(q);

        const items: T[] = [];
        snapshot.forEach((doc) => {
          const docData = doc.data();
          const convertedData = convertTimestamps(docData);
          items.push({ id: doc.id, ...convertedData } as T);
        });

        setData(items);
        setHasMore(snapshot.docs.length === pageSize);
        if (snapshot.docs.length > 0) {
            setLastFetchedDoc(snapshot.docs[snapshot.docs.length - 1]);
        } else {
            setLastFetchedDoc(null);
        }

      } catch (err: any) {
        console.error(`Error fetching paginated collection ${collectionName}:`, err);
        setError(err);
        setData([]);
      } finally {
        setLoading(false);
      }
    }, [firestore, collectionName, memoizedConstraints, pageSize, disabled]);

    // Re-trigger initial load if constraints change
    useEffect(() => {
        setPage(1);
        setPageStartCursors([null]);
        setHasMore(true);
        fetchPageWithDocRef(null);
    }, [fetchPageWithDocRef]);

    const handleNextPage = () => {
        if (!hasMore || loading || !lastFetchedDoc) return;

        const newCursors = [...pageStartCursors];
        // The start of the *next* page is the last doc of *this* page
        newCursors[page] = lastFetchedDoc;
        setPageStartCursors(newCursors);

        setPage(p => p + 1);
        fetchPageWithDocRef(lastFetchedDoc);
    };

    const handlePrevPage = () => {
        if (page <= 1 || loading) return;

        const prevPage = page - 1;
        // The cursor for the previous page is at index (prevPage - 1)
        // e.g. To go back to Page 1 (index 0), we use cursors[0] which is null.
        const cursor = pageStartCursors[prevPage - 1];

        setPage(prevPage);
        // We also need to trim the cursors stack if we want to be clean, but keeping them is fine/cache.
        // Actually, if we go back, we should just use the existing cursor.
        fetchPageWithDocRef(cursor);
    };

    const refresh = () => {
        // Refresh current page
        const cursor = pageStartCursors[page - 1];
        fetchPageWithDocRef(cursor);
    };

  return {
      data,
      loading,
      error,
      nextPage: handleNextPage,
      prevPage: handlePrevPage,
      refresh,
      hasNextPage: hasMore,
      hasPrevPage: page > 1,
      page
  };
}
