'use client';

import { useEffect, useRef } from 'react';
import { useUser, useCollection } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Order } from '@/lib/types'; // Adjust path if needed

export default function OrderUpdatesListener() {
    const { user } = useUser();
    const { toast } = useToast();

    // Listen to active orders
    const { data: orders } = useCollection<Order>('orders', {
        constraints: user?.id ? [['where', 'customerId', '==', user.id]] : [],
        disabled: !user?.id
    });

    const prevOrdersRef = useRef<Map<string, string>>(new Map());

    useEffect(() => {
        if (!orders) return;

        const currentStatusMap = new Map();

        orders.forEach(order => {
            const prevStatus = prevOrdersRef.current.get(order.id);

            // If we have a previous status and it's different from current
            if (prevStatus && prevStatus !== order.status) {
                // Trigger Toast
                toast({
                    title: `Order Updated #${order.id.slice(0, 5)}`,
                    description: `Status changed to ${order.status}`,
                });
            }

            // Logic for new orders if needed, but usually user knows they placed it.
            // We focus on updates.

            currentStatusMap.set(order.id, order.status);
        });

        // Update ref
        prevOrdersRef.current = currentStatusMap;

    }, [orders, toast]);

    return null;
}
