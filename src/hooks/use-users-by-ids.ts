
'use client';

import { useState, useEffect, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { documentId, getDocs, query, collection, where, type DocumentData } from 'firebase/firestore';
import type { User } from '@/lib/types';

// Firestore 'in' queries are limited to 10 values
const CHUNK_SIZE = 10;

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export function useUsersByIds(ids: string[]) {
  const firestore = useFirestore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // Track IDs we've already tried to fetch to avoid loops or redundant fetches
  // We use a ref to keep this stable across renders unless logic manually resets it
  // But for this simple hook, simpler is better: refetch when IDs change significantly.
  // Actually, we should just depend on `ids.join(',')` or similar stability.

  const uniqueIds = Array.from(new Set(ids)).filter(Boolean).sort();
  const idsKey = uniqueIds.join(',');

  useEffect(() => {
    if (!firestore || uniqueIds.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const chunks = chunkArray(uniqueIds, CHUNK_SIZE);
        const allUsers: User[] = [];

        // We run these in parallel
        await Promise.all(chunks.map(async (chunk) => {
          const q = query(
            collection(firestore, 'users'),
            where(documentId(), 'in', chunk)
          );

          const snapshot = await getDocs(q);
          snapshot.forEach(doc => {
            const data = doc.data() as DocumentData;
            // Handle Timestamp conversion if necessary (simplified here assuming types match roughly)
            // But ideally we should use the same conversion logic as use-collection.
            // For now, we cast as User, noting that Dates might be Timestamps.
            // We'll do a basic safe cast.

            // Helper to convert timestamps if needed (basic version)
            const safeData = { ...data, id: doc.id } as any;
            if (safeData.createdAt && typeof safeData.createdAt.toDate === 'function') {
                safeData.createdAt = safeData.createdAt.toDate();
            }

            allUsers.push(safeData as User);
          });
        }));

        if (isMounted) {
          setUsers(allUsers);
        }
      } catch (error) {
        console.error("Error fetching users by IDs:", error);
        // We don't wipe data on error, just stop loading
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchUsers();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, idsKey]);

  return { users, loading };
}
