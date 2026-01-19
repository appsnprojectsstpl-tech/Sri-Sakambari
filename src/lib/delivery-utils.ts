import { Order } from './types';

/**
 * Auto-assign orders to delivery partners based on area and workload
 */
export function autoAssignOrders(
    orders: Order[],
    deliveryPartners: any[],
    existingAssignments: Map<string, number> = new Map()
): Map<string, string> {
    const assignments = new Map<string, string>();

    // Group orders by area
    const ordersByArea = orders.reduce((acc, order) => {
        if (!acc[order.area]) acc[order.area] = [];
        acc[order.area].push(order);
        return acc;
    }, {} as Record<string, Order[]>);

    // Calculate current workload for each partner
    const workload = new Map<string, number>(existingAssignments);
    deliveryPartners.forEach(partner => {
        if (!workload.has(partner.id)) {
            workload.set(partner.id, 0);
        }
    });

    // Assign orders area by area
    Object.entries(ordersByArea).forEach(([area, areaOrders]) => {
        // Find partners with least workload
        const sortedPartners = [...deliveryPartners].sort((a, b) => {
            const workloadA = workload.get(a.id) || 0;
            const workloadB = workload.get(b.id) || 0;
            return workloadA - workloadB;
        });

        // Distribute orders in this area
        areaOrders.forEach((order, index) => {
            const partner = sortedPartners[index % sortedPartners.length];
            assignments.set(order.id, partner.id);
            workload.set(partner.id, (workload.get(partner.id) || 0) + 1);
        });
    });

    return assignments;
}

/**
 * Calculate optimal delivery route for orders
 */
export function calculateDeliveryRoute(orders: Order[]): Order[] {
    // Simple implementation: group by area and sort by area
    const grouped = orders.reduce((acc, order) => {
        if (!acc[order.area]) acc[order.area] = [];
        acc[order.area].push(order);
        return acc;
    }, {} as Record<string, Order[]>);

    // Flatten back to array, grouped by area
    return Object.values(grouped).flat();
}

/**
 * Get delivery partner performance metrics
 */
export function getPartnerPerformance(
    partnerId: string,
    orders: Order[]
): {
    totalDeliveries: number;
    onTimeDeliveries: number;
    onTimePercentage: number;
    avgDeliveryTime: number;
} {
    const partnerOrders = orders.filter(o => o.deliveryPartnerId === partnerId && o.status === 'DELIVERED');

    const totalDeliveries = partnerOrders.length;
    const onTimeDeliveries = partnerOrders.filter(o => {
        // Simplified: consider on-time if delivered same day
        const orderDate = o.createdAt instanceof Date ? o.createdAt : new Date((o.createdAt as any).seconds * 1000);
        // deliveryDate is a string, so parse it
        const deliveryDate = o.deliveryDate ? new Date(o.deliveryDate) : orderDate;
        return orderDate.toDateString() === deliveryDate.toDateString();
    }).length;

    const onTimePercentage = totalDeliveries > 0 ? (onTimeDeliveries / totalDeliveries) * 100 : 0;

    // Calculate average delivery time (simplified)
    const avgDeliveryTime = 0; // Would need actual delivery time data

    return {
        totalDeliveries,
        onTimeDeliveries,
        onTimePercentage,
        avgDeliveryTime
    };
}

/**
 * Suggest delivery slots based on capacity
 */
export function suggestDeliverySlots(
    orders: Order[],
    maxOrdersPerSlot: number = 10
): Record<string, number> {
    const slotCounts = orders.reduce((acc, order) => {
        const slot = order.deliverySlot || 'Not Set';
        acc[slot] = (acc[slot] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return slotCounts;
}

/**
 * Get orders that need attention (pending, delayed, etc.)
 */
export function getOrdersNeedingAttention(orders: Order[]): {
    pending: Order[];
    delayed: Order[];
    paymentPending: Order[];
} {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return {
        pending: orders.filter(o => o.status === 'PENDING'),
        delayed: orders.filter(o => {
            if (o.status === 'DELIVERED' || o.status === 'CANCELLED') return false;
            const orderDate = o.createdAt instanceof Date ? o.createdAt : new Date((o.createdAt as any).seconds * 1000);
            return orderDate < oneDayAgo;
        }),
        paymentPending: orders.filter(o => o.status === 'PENDING_PAYMENT')
    };
}
