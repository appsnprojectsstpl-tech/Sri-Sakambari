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
import { compareConstraints, type Constraint, type WhereFilterOp, type OrderByDirection, convertTimestamps } from './utils';

interface UseCollectionOptions {
  constraints?: Constraint[];
  disabled?: boolean;
}


interface UseCollectionReturn<T> {
  data: T[] | null;
  loading: boolean;
  error: FirestoreError | null;
  forceRefetch: () => void;
}

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
  const [error, setError] = useState<FirestoreError | null>(null);
  const [refetchIndex, setRefetchIndex] = useState(0);

  const forceRefetch = useCallback(() => {
    setRefetchIndex(prev => prev + 1);
  }, []);
  
  const { disabled = false } = options;
  // Performance: Use deep comparison for constraints to avoid expensive JSON.stringify
  // and unnecessary re-renders/fetches when constraints object identity changes but content is same.
  const memoizedConstraints = useConstraintsMemoize(options.constraints);

  useEffect(() => {
    if (!firestore || disabled) {
      setData([]); // Return empty array if disabled
      setLoading(false);
      return;
    }

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
            querySnapshot.forEach((doc) => {
              const docData = doc.data();
              const convertedData = convertTimestamps(docData);
              items.push({ id: doc.id, ...convertedData } as T);
            });
            setData(items);
            setLoading(false);
        },
        (err: FirestoreError) => {
            console.error(`Error fetching collection ${collectionName}:`, err);
            setError(err);
            setData([]); // Set data to empty array on error to avoid breaking UI
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
  }, [firestore, collectionName, memoizedConstraints, disabled, refetchIndex]); // Deep comparison for constraints

  return { data, loading, error, forceRefetch };
}
