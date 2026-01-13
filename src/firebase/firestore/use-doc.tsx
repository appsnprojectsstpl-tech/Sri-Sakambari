'use client';

import { useState, useEffect } from 'react';
import {
  doc,
  onSnapshot,
  type DocumentReference,
  type DocumentData,
  type FirestoreError,
} from 'firebase/firestore';
import { useFirestore } from '../provider';

interface UseDocReturn<T> {
  data: T | null;
  loading: boolean;
  error: FirestoreError | null;
}

export function useDoc<T>(
  docRefPath: string
): UseDocReturn<T> {
  const firestore = useFirestore();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!firestore) return;
    
    const docRef: DocumentReference<DocumentData> = doc(firestore, docRefPath);

    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setData({ id: docSnap.id, ...docSnap.data() } as T);
        } else {
          setData(null); // Document does not exist
        }
        setLoading(false);
      },
      (err: FirestoreError) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, docRefPath]);

  return { data, loading, error };
}
