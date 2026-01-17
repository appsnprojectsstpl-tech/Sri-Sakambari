import { useFirestore } from '@/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

export interface StoreSettings {
    isOpen: boolean;
    closeMessage?: string;
}

export function useStoreStatus() {
    const firestore = useFirestore();
    const [status, setStatus] = useState<StoreSettings>({ isOpen: true });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!firestore) return;

        const ref = doc(firestore, 'settings', 'global');
        const unsub = onSnapshot(ref, (snap) => {
            if (snap.exists()) {
                setStatus(snap.data() as StoreSettings);
            } else {
                // Initialize if missing
                setDoc(ref, { isOpen: true }, { merge: true });
            }
            setLoading(false);
        });

        return () => unsub();
    }, [firestore]);

    const toggleStore = async (isOpen: boolean, message?: string) => {
        if (!firestore) return;
        const ref = doc(firestore, 'settings', 'global');
        await setDoc(ref, { isOpen, closeMessage: message || '' }, { merge: true });
    };

    return { isOpen: status.isOpen, closeMessage: status.closeMessage, loading, toggleStore };
}
