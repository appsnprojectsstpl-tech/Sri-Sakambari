import { useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/firebase';

/**
 * Hook to play notification sound when new orders arrive
 * Only active for admin and restricted_admin users
 */
export function useOrderNotification(userRole: string | undefined) {
    const lastOrderIdRef = useRef<string | null>(null);
    const isInitialLoadRef = useRef(true);

    useEffect(() => {
        // Only enable for admin users
        if (userRole !== 'admin' && userRole !== 'restricted_admin') {
            return;
        }

        // Create query to listen to the most recent order
        const ordersRef = collection(firestore, 'orders');
        const q = query(ordersRef, orderBy('createdAt', 'desc'), limit(1));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                return;
            }

            const latestOrder = snapshot.docs[0];
            const latestOrderId = latestOrder.id;

            // Skip initial load
            if (isInitialLoadRef.current) {
                lastOrderIdRef.current = latestOrderId;
                isInitialLoadRef.current = false;
                return;
            }

            // Check if this is a new order
            if (lastOrderIdRef.current && latestOrderId !== lastOrderIdRef.current) {
                // Play notification sound
                playNotificationSound();

                // Show browser notification if permission granted
                showBrowserNotification(latestOrder.data());
            }

            lastOrderIdRef.current = latestOrderId;
        });

        return () => unsubscribe();
    }, [userRole]);
}

/**
 * Play notification sound using Web Audio API
 * Plays a sequence of beeps for 3 seconds
 */
function playNotificationSound() {
    try {
        // Create AudioContext
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        if (!AudioContextClass) return;

        const audioContext = new AudioContextClass();
        const duration = 3000; // 3 seconds
        const beepInterval = 400; // interval between beeps
        const beepDuration = 150; // duration of each beep

        const startTime = audioContext.currentTime;

        for (let time = 0; time < duration; time += beepInterval) {
            const playTime = startTime + (time / 1000);

            // Create oscillator for a pleasant notification sound
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Alternate between two frequencies for a more noticeable pattern
            oscillator.frequency.value = (time / beepInterval) % 2 === 0 ? 800 : 1000;
            gainNode.gain.setValueAtTime(0.3, playTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, playTime + (beepDuration / 1000));

            oscillator.start(playTime);
            oscillator.stop(playTime + (beepDuration / 1000));
        }
    } catch (error) {
        console.error('Error playing notification sound:', error);
    }
}

/**
 * Show browser notification
 */
function showBrowserNotification(orderData: any) {
    // Check if Notification API is available (not available in all environments)
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return;
    }

    if (Notification.permission === 'granted') {
        try {
            new Notification('New Order Received! 🛒', {
                body: `Order #${orderData.id?.slice(0, 8)} - ₹${orderData.totalAmount}`,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: 'new-order',
                requireInteraction: false,
            });
        } catch (error) {
            console.error('Failed to show notification:', error);
        }
    }
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return false;
    }

    if (Notification.permission === 'default') {
        try {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return false;
        }
    }
    return Notification.permission === 'granted';
}
