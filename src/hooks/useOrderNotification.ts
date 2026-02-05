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
 */
function playNotificationSound() {
    try {
        // Create AudioContext
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Create oscillator for a pleasant notification sound
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Configure sound: two-tone notification
        oscillator.frequency.value = 800; // Higher pitch
        gainNode.gain.value = 0.3; // Volume

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);

        // Second tone
        setTimeout(() => {
            const oscillator2 = audioContext.createOscillator();
            const gainNode2 = audioContext.createGain();

            oscillator2.connect(gainNode2);
            gainNode2.connect(audioContext.destination);

            oscillator2.frequency.value = 1000; // Even higher pitch
            gainNode2.gain.value = 0.3;

            oscillator2.start(audioContext.currentTime);
            oscillator2.stop(audioContext.currentTime + 0.15);
        }, 150);
    } catch (error) {
        console.error('Error playing notification sound:', error);
    }
}

/**
 * Show browser notification
 */
function showBrowserNotification(orderData: any) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Order Received! 🛒', {
            body: `Order #${orderData.id?.slice(0, 8)} - ₹${orderData.totalAmount}`,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'new-order',
            requireInteraction: false,
        });
    }
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
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
