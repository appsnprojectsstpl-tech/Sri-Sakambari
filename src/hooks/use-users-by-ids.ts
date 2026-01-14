import { useState, useEffect, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { documentId, where, collection, query, getDocs } from 'firebase/firestore';
import type { User } from '@/lib/types';

/**
 * Custom hook to fetch users by a list of IDs.
 * Handles chunking of IDs to respect Firestore's 10-item limit for 'in' queries.
 */
export function useUsersByIds(userIds: string[]) {
    const firestore = useFirestore();
    const [users, setUsers] = useState<User[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Deduplicate IDs and sort for stability
    const uniqueIds = useMemo(() => {
        return Array.from(new Set(userIds)).filter(id => !!id).sort();
    }, [userIds]);

    useEffect(() => {
        let active = true;

        if (!firestore || uniqueIds.length === 0) {
            setUsers([]);
            setLoading(false);
            return;
        }

        const fetchUsers = async () => {
            setLoading(true);
            try {
                // Chunk IDs into groups of 10
                const chunks = [];
                for (let i = 0; i < uniqueIds.length; i += 10) {
                    chunks.push(uniqueIds.slice(i, i + 10));
                }

                const allUsers: User[] = [];

                await Promise.all(chunks.map(async (chunk) => {
                    const q = query(
                        collection(firestore, 'users'),
                        where(documentId(), 'in', chunk)
                    );
                    const snapshot = await getDocs(q);
                    snapshot.forEach(doc => {
                        if (active) {
                            allUsers.push({ id: doc.id, ...doc.data() } as User);
                        }
                    });
                }));

                if (active) {
                    setUsers(allUsers);
                }
            } catch (err: any) {
                console.error("Error fetching users by IDs:", err);
                if (active) {
                    setError(err);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        fetchUsers();

        return () => {
            active = false;
        };
    }, [firestore, uniqueIds]);

    return { data: users, loading, error };
}
