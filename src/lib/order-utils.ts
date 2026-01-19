import { Order, User } from './types';
import { OrderFilters } from '@/components/admin/order-filters-bar';

/**
 * Filter orders based on search term and filters
 */
export function filterOrders(
    orders: Order[],
    filters: OrderFilters,
    users?: User[]
): Order[] {
    let filtered = [...orders];

    // Search filter (Order ID, Customer Name, Phone)
    if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        filtered = filtered.filter(order => {
            const customer = users?.find(u => u.id === order.customerId);
            return (
                order.id.toLowerCase().includes(searchLower) ||
                order.name?.toLowerCase().includes(searchLower) ||
                order.phone?.includes(searchLower) ||
                customer?.name?.toLowerCase().includes(searchLower) ||
                customer?.phone?.includes(searchLower)
            );
        });
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
        filtered = filtered.filter(order => order.status === filters.status);
    }

    // Payment mode filter
    if (filters.paymentMode && filters.paymentMode !== 'all') {
        filtered = filtered.filter(order => order.paymentMode === filters.paymentMode);
    }

    // Area filter
    if (filters.area && filters.area !== 'all') {
        filtered = filtered.filter(order => order.area === filters.area);
    }

    // Date from filter
    if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        filtered = filtered.filter(order => {
            const orderDate = order.createdAt instanceof Date
                ? order.createdAt
                : new Date((order.createdAt as any).seconds * 1000);
            return orderDate >= fromDate;
        });
    }

    // Date to filter
    if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(order => {
            const orderDate = order.createdAt instanceof Date
                ? order.createdAt
                : new Date((order.createdAt as any).seconds * 1000);
            return orderDate <= toDate;
        });
    }

    return filtered;
}

/**
 * Get unique areas from orders
 */
export function getUniqueAreas(orders: Order[]): string[] {
    const areas = new Set(orders.map(o => o.area).filter(Boolean));
    return Array.from(areas).sort();
}

/**
 * Get order statistics by status
 */
export function getOrderStatsByStatus(orders: Order[]): Record<string, number> {
    return orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
}

/**
 * Get order statistics by payment mode
 */
export function getOrderStatsByPaymentMode(orders: Order[]): Record<string, number> {
    return orders.reduce((acc, order) => {
        const mode = order.paymentMode || 'Unknown';
        acc[mode] = (acc[mode] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
}

/**
 * Sort orders by date (newest first)
 */
export function sortOrdersByDate(orders: Order[], ascending = false): Order[] {
    return [...orders].sort((a, b) => {
        const dateA = a.createdAt instanceof Date
            ? a.createdAt
            : new Date((a.createdAt as any).seconds * 1000);
        const dateB = b.createdAt instanceof Date
            ? b.createdAt
            : new Date((b.createdAt as any).seconds * 1000);

        return ascending
            ? dateA.getTime() - dateB.getTime()
            : dateB.getTime() - dateA.getTime();
    });
}

/**
 * Sort orders by total amount
 */
export function sortOrdersByAmount(orders: Order[], ascending = false): Order[] {
    return [...orders].sort((a, b) => {
        return ascending
            ? a.totalAmount - b.totalAmount
            : b.totalAmount - a.totalAmount;
    });
}

/**
 * Get orders for today
 */
export function getTodayOrders(orders: Order[]): Order[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return orders.filter(order => {
        const orderDate = order.createdAt instanceof Date
            ? order.createdAt
            : new Date((order.createdAt as any).seconds * 1000);
        return orderDate >= today && orderDate < tomorrow;
    });
}

/**
 * Get pending orders (PENDING or CONFIRMED status)
 */
export function getPendingOrders(orders: Order[]): Order[] {
    return orders.filter(o =>
        o.status === 'PENDING' ||
        o.status === 'CONFIRMED' ||
        o.status === 'PENDING_PAYMENT'
    );
}
