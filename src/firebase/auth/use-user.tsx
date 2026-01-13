'use client';

import { useState, useEffect } from 'react';
import type { User as FirebaseAuthUser } from 'firebase/auth';
import { doc, onSnapshot, type DocumentData } from 'firebase/firestore';
import { useAuth, useFirestore } from '../provider';
import type { User } from '@/lib/types';

interface UseUserReturn {
  user: User | null | undefined;
  loading: boolean;
  error: Error | null;
}

export function useUser(): UseUserReturn {
  const auth = useAuth();
  const firestore = useFirestore();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null | undefined>(undefined);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!auth) {
      // Auth might not be initialized yet.
      // The hook will re-run once auth is available.
      return;
    }
    
    setLoading(true);
    const unsubscribe = auth.onAuthStateChanged(
      (user) => {
        setFirebaseUser(user);
        // If the user logs out, we should clear their data immediately.
        if (!user) {
          setUserData(null);
          setLoading(false);
        }
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (!firestore || !firebaseUser) {
        // If the user is logged out, firebaseUser will be null.
        if (firebaseUser === null) {
            setLoading(false);
        }
        return;
    }

    const userDocRef = doc(firestore, 'users', firebaseUser.uid);

    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as DocumentData;
          setUserData({
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate(),
          } as User);
        } else {
          // This can happen briefly during signup before the user doc is created.
          // Or if a user is deleted from the database.
          setUserData(null); 
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching user document:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, firebaseUser]);
  
  return { user: userData, loading, error };
}
