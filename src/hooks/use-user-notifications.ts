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
            const dateA = a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(a.createdAt);
            const dateB = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.createdAt);
            return dateB.getTime() - dateA.getTime();
        })
        : [];

    return { notifications: sortedNotifications, loading };
}
