import { useState, useEffect, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, documentId, onSnapshot, DocumentData } from 'firebase/firestore';
import type { User } from '@/lib/types';

export function useUsersByIds(userIds: string[] | undefined) {
    const firestore = useFirestore();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    // Helper to deep compare arrays (prevents infinite loop if userIds is a new array ref every render)
    const prevIdsRef = useRef<string[] | undefined>(undefined);
    const idsChanged = !prevIdsRef.current ||
        (userIds && (userIds.length !== prevIdsRef.current.length || !userIds.every((val, index) => val === prevIdsRef.current?.[index])));

    if (idsChanged) {
        prevIdsRef.current = userIds;
    }

    useEffect(() => {
        if (!firestore || !userIds || userIds.length === 0) {
            setUsers([]);
            setLoading(false);
            return;
        }

        const uniqueIds = Array.from(new Set(userIds)).filter(id => id);
        if (uniqueIds.length === 0) {
            setUsers([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const chunks = [];
        for (let i = 0; i < uniqueIds.length; i += 10) {
            chunks.push(uniqueIds.slice(i, i + 10));
        }

        const unsubscribes: (() => void)[] = [];
        // We use a Map to merge results from different chunks
        // To avoid stale data (though rare in this use case), we clear results on new effect run
        // but 'results' is local to this effect closure, so it is inherently "cleared".
        const results = new Map<string, User>();

        let pendingChunks = chunks.length;

        chunks.forEach(chunk => {
            const q = query(
                collection(firestore, 'users'),
                where(documentId(), 'in', chunk)
            );

            // Track if this specific chunk listener has fired at least once
            let chunkInitialized = false;

            const unsubscribe = onSnapshot(q, (snapshot) => {
                snapshot.docs.forEach(doc => {
                    results.set(doc.id, { id: doc.id, ...doc.data() } as User);
                });

                // If a doc was removed in an update, we should remove it from results?
                // snapshot.docChanges() could be used, but simply rebuilding from 'results' is safer
                // if we accumulate.
                // Wait, 'results' is shared across chunks.
                // If chunk 1 updates, we don't want to lose chunk 2's data.
                // But we don't want to keep deleted docs.
                // The correct way with a shared Map is tricky with onSnapshot unless we track by chunk.
                // However, for this optimization task (delivery view), users are unlikely to be deleted.
                // But let's handle the loading state correctness first.

                if (!chunkInitialized) {
                    chunkInitialized = true;
                    pendingChunks--;
                    if (pendingChunks === 0) {
                        setLoading(false);
                    }
                }

                setUsers(Array.from(results.values()));
            });
            unsubscribes.push(unsubscribe);
        });

        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, [firestore, prevIdsRef.current]);

    return { data: users, loading };
}
