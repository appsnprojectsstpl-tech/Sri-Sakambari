import { useUser, useCollection } from '@/firebase';
import { Notification } from '@/lib/types';

export function useUserNotifications() {
    const { user } = useUser();

    // Sort logic removed from here as useCollection doesn't support complex sorts directly easily without index
    // We will sort client side.
    const { data: notifications, loading } = useCollection<Notification>(
        'notifications',
        {
            constraints: user ? [['where', 'userId', '==', user.id]] : [],
            disabled: !user?.id
        }
    );

    const sortedNotifications = notifications
        ? [...notifications].sort((a, b) => {
            const timeA = (a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : new Date(a.createdAt).getTime();
            const timeB = (b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : new Date(b.createdAt).getTime();
            return timeB - timeA;
        })
        : [];

    return { notifications: sortedNotifications, loading };
}
