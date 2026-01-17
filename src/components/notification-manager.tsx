'use client';

import { useEffect, useState } from 'react';
import { getToken } from 'firebase/messaging';
import { initializeFirebase } from '@/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '@/firebase';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { firebaseConfig } from '@/firebase/config';

export default function NotificationManager() {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isSupported, setIsSupported] = useState(false);
    const auth = useAuth();
    const { messaging, firestore } = initializeFirebase();

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setIsSupported(true);
            setPermission(Notification.permission);
        }
    }, []);

    const requestPermission = async () => {
        if (!messaging || !auth?.currentUser) return;

        try {
            const permissionResult = await Notification.requestPermission();
            setPermission(permissionResult);

            if (permissionResult === 'granted') {
                const token = await getToken(messaging);

                if (token) {
                    // Save token to user profile
                    const userRef = doc(firestore, 'users', auth.currentUser.uid);
                    await updateDoc(userRef, {
                        fcmTokens: arrayUnion(token)
                    });
                    console.log('FCM Token:', token);
                    toast({ title: 'Notifications Enabled', description: 'You will now receive updates on your orders.' });
                }
            }
        } catch (error) {
            console.error('Error getting notification permission', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to enable notifications.' });
        }
    };

    if (!isSupported) return null;

    if (permission === 'granted') {
        return null; // Already granted, no need to show persistent button unless we want a toggle "Disable"?
        // Usually browser handles disable.
    }

    if (permission === 'denied') {
        return (
            <div className="fixed bottom-24 right-4 z-40 bg-white p-2 rounded-full shadow-md border animate-in fade-in">
                <BellOff className="w-5 h-5 text-gray-400" />
            </div>
        );
    }

    return (
        <div className="fixed bottom-24 right-4 z-40 animate-in slide-in-from-bottom duration-500">
            <Button onClick={requestPermission} size="sm" className="rounded-full shadow-lg bg-primary text-white hover:bg-primary/90">
                <Bell className="w-4 h-4 mr-2" />
                Enable Updates
            </Button>
        </div>
    );
}
