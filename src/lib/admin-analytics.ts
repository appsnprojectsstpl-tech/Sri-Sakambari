import { Order, Product } from '@/lib/types';
import { isToday, isYesterday, subDays, format, startOfDay, endOfDay } from 'date-fns';

export interface DashboardStats {
    todayRevenue: number;
    yesterdayRevenue: number;
    totalOrders: number;
    yesterdayOrders: number;
    activeCustomers: number;
    avgOrderValue: number;
    ordersByStatus: Record<string, number>;
    revenueByDay: { date: string; revenue: number }[];
    topProducts: { productId: string; name: string; quantity: number; revenue: number }[];
    categoryRevenue: { category: string; revenue: number }[];
}

export function calculateDashboardStats(
    orders: Order[],
    products: Product[]
): DashboardStats {
    const now = new Date();
    const productMap = new Map(products.map(p => [p.id, p]));

    // Filter orders
    const todayOrders = orders.filter(o => {
        const orderDate = o.createdAt instanceof Date ? o.createdAt : new Date((o.createdAt as any).seconds * 1000);
        return isToday(orderDate);
    });

    const yesterdayOrders = orders.filter(o => {
        const orderDate = o.createdAt instanceof Date ? o.createdAt : new Date((o.createdAt as any).seconds * 1000);
        return isYesterday(orderDate);
    });

    // Revenue calculations
    const todayRevenue = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const yesterdayRevenue = yesterdayOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    // Order counts
    const totalOrders = todayOrders.length;
    const yesterdayOrdersCount = yesterdayOrders.length;

    // Active customers (unique customers in last 30 days)
    const thirtyDaysAgo = subDays(now, 30);
    const recentOrders = orders.filter(o => {
        const orderDate = o.createdAt instanceof Date ? o.createdAt : new Date((o.createdAt as any).seconds * 1000);
        return orderDate >= thirtyDaysAgo;
    });
    const activeCustomers = new Set(recentOrders.map(o => o.customerId)).size;

    // Average order value
    const avgOrderValue = totalOrders > 0 ? todayRevenue / totalOrders : 0;

    // Orders by status
    const ordersByStatus = todayOrders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Revenue by day (last 7 days)
    const revenueByDay = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(now, 6 - i);
        const dayOrders = orders.filter(o => {
            const orderDate = o.createdAt instanceof Date ? o.createdAt : new Date((o.createdAt as any).seconds * 1000);
            return orderDate >= startOfDay(date) && orderDate <= endOfDay(date);
        });
        return {
            date: format(date, 'MMM dd'),
            revenue: dayOrders.reduce((sum, o) => sum + o.totalAmount, 0)
        };
    });

    // Top products
    const productSales = new Map<string, { quantity: number; revenue: number; name: string }>();

    todayOrders.forEach(order => {
        order.items.forEach(item => {
            const existing = productSales.get(item.productId) || { quantity: 0, revenue: 0, name: '' };
            const product = productMap.get(item.productId);
            productSales.set(item.productId, {
                quantity: existing.quantity + item.qty,
                revenue: existing.revenue + (item.priceAtOrder * item.qty),
                name: product?.name || item.name || 'Unknown Product'
            });
        });
    });

    const topProducts = Array.from(productSales.entries())
        .map(([productId, data]) => ({
            productId,
            name: data.name,
            quantity: data.quantity,
            revenue: data.revenue
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

    // Category revenue
    const categoryRevenue = todayOrders.reduce((acc, order) => {
        order.items.forEach(item => {
            const product = productMap.get(item.productId);
            const category = product?.category || 'Other';
            const revenue = item.priceAtOrder * item.qty;

            const existing = acc.find(c => c.category === category);
            if (existing) {
                existing.revenue += revenue;
            } else {
                acc.push({ category, revenue });
            }
        });
        return acc;
    }, [] as { category: string; revenue: number }[]);

    return {
        todayRevenue,
        yesterdayRevenue,
        totalOrders,
        yesterdayOrders: yesterdayOrdersCount,
        activeCustomers,
        avgOrderValue,
        ordersByStatus,
        revenueByDay,
        topProducts,
        categoryRevenue
    };
}
