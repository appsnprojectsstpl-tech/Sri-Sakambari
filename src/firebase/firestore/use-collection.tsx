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
  type Timestamp,
} from 'firebase/firestore';
import { useFirestore } from '../provider';
import { compareConstraints, type Constraint, type WhereFilterOp, type OrderByDirection } from './utils';
import { logger, getFirebaseErrorMessage } from '@/lib/logger';

interface UseCollectionOptions {
  constraints?: Constraint[];
  disabled?: boolean;
}


interface UseCollectionReturn<T> {
  data: T[] | null;
  loading: boolean;
  error: string | FirestoreError | null;
  forceRefetch: () => void;
}

// Function to recursively convert Firestore Timestamps to JS Dates in an object
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

function useConstraintsMemoize(value: Constraint[] | undefined): Constraint[] | undefined {
  const ref = useRef<Constraint[] | undefined>(value);
  if (!compareConstraints(value, ref.current)) {
    ref.current = value;
  }
  return ref.current;
}

export function useCollection<T>(
  collectionName: string,
  options: UseCollectionOptions = {}
): UseCollectionReturn<T> {
  const firestore = useFirestore();
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | FirestoreError | null>(null);
  const [refetchIndex, setRefetchIndex] = useState(0);

  const forceRefetch = useCallback(() => {
    setRefetchIndex(prev => prev + 1);
  }, []);

  const { disabled = false } = options;
  // Performance: Use deep comparison for constraints to avoid expensive JSON.stringify
  // and unnecessary re-renders/fetches when constraints object identity changes but content is same.
  const memoizedConstraints = useConstraintsMemoize(options.constraints);

  useEffect(() => {
    console.log(`useCollection: Starting fetch for ${collectionName}, disabled: ${disabled}, constraints:`, memoizedConstraints);
    
    if (!firestore || disabled) {
      console.log(`useCollection: Skipping fetch for ${collectionName} - firestore: ${!!firestore}, disabled: ${disabled}`);
      setData([]); // Return empty array if disabled
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const collectionRef: CollectionReference = collection(firestore, collectionName);

      const queryConstraints: QueryConstraint[] = (memoizedConstraints || []).map(constraint => {
        const [type, ...args] = constraint;
        switch (type) {
          case 'where':
            return where(args[0] as string, args[1] as WhereFilterOp, args[2]);
          case 'orderBy':
            return orderBy(args[0] as string, args[1] as OrderByDirection | undefined);
          case 'limit':
            return limit(args[0] as number);
          case 'limitToLast':
            return limitToLast(args[0] as number);
          case 'startAfter':
            return startAfter(...args);
          case 'endBefore':
            return endBefore(...args);
          default:
            // This should not happen with proper typing
            throw new Error(`Unknown query constraint type: ${type}`);
        }
      });

      const q: Query<DocumentData> = query(collectionRef, ...queryConstraints);

      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const items: T[] = [];
          console.log(`useCollection: Received ${querySnapshot.docs.length} documents from ${collectionName}`);
          querySnapshot.forEach((doc) => {
            const docData = doc.data();
            const convertedData = convertTimestamps(docData);
            items.push({ id: doc.id, ...convertedData } as T);
          });
          console.log(`useCollection: Processed ${items.length} items from ${collectionName}`);
          setData(items);
          setLoading(false);
        },
        (err: FirestoreError) => {
          console.error(`useCollection: Error fetching collection ${collectionName}:`, err);
          logger.error(`Error fetching collection ${collectionName}:`, err);
          setError(getFirebaseErrorMessage(err)); // Cast to FirestoreError as getFirebaseErrorMessage returns string
          setData([]); // Set data to empty array on error to avoid breaking UI
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (e: any) {
      logger.error(`Error building query for collection ${collectionName}:`, e);
      setError(getFirebaseErrorMessage(e)); // Cast to FirestoreError as getFirebaseErrorMessage returns string
      setData([]);
      setLoading(false);
    }
  }, [firestore, collectionName, memoizedConstraints, disabled, refetchIndex]); // Deep comparison for constraints

  return { data, loading, error, forceRefetch };
}
