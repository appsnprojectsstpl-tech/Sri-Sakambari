'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  onSnapshot,
  query,
  collection,
  orderBy,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  where,
  type Query,
  type DocumentData,
  type FirestoreError,
  type QueryConstraint,
  type CollectionReference,
} from 'firebase/firestore';
import { useFirestore } from '../provider';
import { convertTimestamps, deepCompare } from './utils';

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
  | ['startAfter', ...any[]]
  | ['endBefore', ...any[]];
// Note: 'limit' is handled internally by this hook

interface UseInfiniteCollectionOptions {
  constraints?: Constraint[];
  initialLimit?: number;
  batchSize?: number;
  disabled?: boolean;
}

interface UseInfiniteCollectionReturn<T> {
  data: T[] | null;
  loading: boolean;
  isFetchingMore: boolean;
  error: FirestoreError | null;
  loadMore: () => void;
  hasMore: boolean;
  forceRefetch: () => void;
}

function useDeepCompareMemoize<T>(value: T): T {
  const ref = useRef<T>(value);
  if (!deepCompare(value, ref.current)) {
    ref.current = value;
  }
  return ref.current;
}

export function useInfiniteCollection<T>(
  collectionName: string,
  options: UseInfiniteCollectionOptions = {}
): UseInfiniteCollectionReturn<T> {
  const firestore = useFirestore();
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [refetchIndex, setRefetchIndex] = useState(0);

  const {
    initialLimit = 20,
    batchSize = 20,
    disabled = false
  } = options;

  const [limitCount, setLimitCount] = useState(initialLimit);

  // We use data length to estimate if there are more items.
  // Ideally, we'd query limit + 1, but for simplicity and UI consistency with standard limit,
  // we check if the returned count matches the limit count.
  // Note: This can be a false negative if the collection size is exactly a multiple of limitCount.
  const hasMore = data ? data.length >= limitCount : false;

  // Distinguish between initial loading and fetching more
  // If we have data and we are loading, it means we are fetching more (assuming infinite scroll behavior)
  // However, onSnapshot fires immediately with cached data sometimes.
  // A simple heuristic: if limitCount > initialLimit, we are "fetching more" phase effectively,
  // but standard `loading` state from this hook reflects "snapshot update in progress" which is not exposed by Firestore directly.
  // Firestore onSnapshot doesn't have a "loading" state. We set setLoading(true) before creating the listener
  // and setLoading(false) on first snapshot.
  // So `loading` here IS initial loading.

  // Wait, if I change limitCount, the effect re-runs.
  // setLoading(true) is called.
  // So `loading` becomes true when loading more.
  // We want to expose `loading` as "initial load" and `isFetchingMore` as "loading subsequent pages".

  const isFetchingMore = loading && limitCount > initialLimit;
  const isInitialLoading = loading && limitCount === initialLimit;

  const forceRefetch = useCallback(() => {
    setRefetchIndex(prev => prev + 1);
  }, []);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
        setLimitCount(prev => prev + batchSize);
    }
  }, [loading, hasMore, batchSize]);

  const memoizedConstraints = useDeepCompareMemoize(options.constraints);

  useEffect(() => {
    if (!firestore || disabled) {
      if (disabled) setData([]);
      setLoading(false);
      return;
    }

    // Only set loading true if we don't have data yet OR if we are fetching a new page.
    // But we want to distinguish.
    setLoading(true);
    try {
        const collectionRef: CollectionReference = collection(firestore, collectionName);

        const queryConstraints: QueryConstraint[] = (memoizedConstraints || []).map(constraint => {
            const [type, ...args] = constraint;
            switch(type) {
                case 'where':
                    return where(args[0] as string, args[1] as WhereFilterOp, args[2]);
                case 'orderBy':
                    return orderBy(args[0] as string, args[1] as OrderByDirection | undefined);
                case 'startAfter':
                    return startAfter(...args);
                case 'endBefore':
                    return endBefore(...args);
                default:
                    // Only standard constraints allowed, limit is handled below
                    throw new Error(`Query constraint type: ${type} is not supported or should be handled internally.`);
            }
        });

        // Apply our dynamic limit
        queryConstraints.push(limit(limitCount));

        const q: Query<DocumentData> = query(collectionRef, ...queryConstraints);

        const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
            const items: T[] = [];
            querySnapshot.forEach((doc) => {
              const docData = doc.data();
              const convertedData = convertTimestamps(docData);
              items.push({ id: doc.id, ...convertedData } as T);
            });
            setData(items);
            setLoading(false);
        },
        (err: FirestoreError) => {
            console.error(`Error fetching infinite collection ${collectionName}:`, err);
            setError(err);
            setData([]);
            setLoading(false);
        }
        );

        return () => unsubscribe();
    } catch (e: any) {
        console.error(`Error building query for collection ${collectionName}:`, e);
        setError(e);
        setData([]);
        setLoading(false);
    }
  }, [firestore, collectionName, memoizedConstraints, disabled, refetchIndex, limitCount]);

  return { data, loading: isInitialLoading, isFetchingMore, error, loadMore, hasMore, forceRefetch };
}
