
import { useState, useEffect, useRef } from 'react';
import {
  documentId,
  where,
  query,
  collection,
  getDocs,
  doc,
  type DocumentData,
  type Query
} from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import type { User } from '@/lib/types';
import { convertTimestamps } from '@/firebase/firestore/utils';

interface UseUsersByIdsReturn {
  users: User[];
  loading: boolean;
  error: any;
}

export function useUsersByIds(userIds: string[]): UseUsersByIdsReturn {
  const firestore = useFirestore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  // Use a ref to track the previous IDs to prevent unnecessary re-fetches
  // if the array reference changes but content is same
  const prevIdsRef = useRef<string[]>([]);

  useEffect(() => {
    // Basic array content check
    const isSame =
        userIds.length === prevIdsRef.current.length &&
        userIds.every((id, i) => id === prevIdsRef.current[i]);

    if (isSame && users.length > 0) return;

    // Filter out duplicates and empty strings
    const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);

    if (!firestore || uniqueIds.length === 0) {
      if (uniqueIds.length === 0) setUsers([]);
      return;
    }

    prevIdsRef.current = userIds;
    setLoading(true);

    const fetchUsers = async () => {
      try {
        // Firestore 'in' query supports max 10 values
        const CHUNK_SIZE = 10;
        const chunks = [];

        for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
          chunks.push(uniqueIds.slice(i, i + CHUNK_SIZE));
        }

        const allUsers: User[] = [];

        await Promise.all(chunks.map(async (chunkIds) => {
            const q = query(
                collection(firestore, 'users'),
                where(documentId(), 'in', chunkIds)
            );

            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                const data = convertTimestamps(doc.data());
                allUsers.push({ id: doc.id, ...data } as User);
            });
        }));

        setUsers(allUsers);
        setError(null);
      } catch (err) {
        console.error("Error fetching users by IDs:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [firestore, userIds, users.length]); // Dependencies

  return { users, loading, error };
}
