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

export type TimeRange = 'today' | 'week' | 'month';

export interface DashboardStats {
    totalRevenue: number;
    previousRevenue: number;
    totalOrders: number;
    previousOrders: number;
    activeCustomers: number;
    avgOrderValue: number;
    ordersByStatus: Record<string, number>;
    revenueChartData: { name: string; value: number }[];
    topProducts: { productId: string; name: string; quantity: number; revenue: number }[];
    categoryRevenue: { category: string; revenue: number }[];
}

export function calculateDashboardStats(
    orders: Order[],
    products: Product[],
    range: TimeRange
): DashboardStats {
    const now = new Date();
    const productMap = new Map(products.map(p => [p.id, p]));

    let startDate: Date;
    let previousStartDate: Date;
    let previousEndDate: Date;

    // Define Ranges
    switch (range) {
        case 'week':
            startDate = subDays(startOfDay(now), 7);
            previousStartDate = subDays(startOfDay(now), 14);
            previousEndDate = subDays(endOfDay(now), 7);
            break;
        case 'month':
            startDate = subDays(startOfDay(now), 30);
            previousStartDate = subDays(startOfDay(now), 60);
            previousEndDate = subDays(endOfDay(now), 30);
            break;
        case 'today':
        default:
            startDate = startOfDay(now);
            previousStartDate = startOfDay(subDays(now, 1));
            previousEndDate = endOfDay(subDays(now, 1));
            break;
    }

    // Filter Orders
    const currentOrders = orders.filter(o => {
        const date = o.createdAt instanceof Date ? o.createdAt : new Date((o.createdAt as any).seconds * 1000);
        return date >= startDate;
    });

    const previousOrders = orders.filter(o => {
        const date = o.createdAt instanceof Date ? o.createdAt : new Date((o.createdAt as any).seconds * 1000);
        return date >= previousStartDate && date <= previousEndDate;
    });

    // 1. Revenue
    const totalRevenue = currentOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const previousRevenue = previousOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    // 2. Orders
    const totalOrdersCount = currentOrders.length;
    const previousOrdersCount = previousOrders.length;

    // 3. Active Customers (always last 30 days regardless of view)
    const thirtyDaysAgo = subDays(now, 30);
    const recentOrders = orders.filter(o => {
        const date = o.createdAt instanceof Date ? o.createdAt : new Date((o.createdAt as any).seconds * 1000);
        return date >= thirtyDaysAgo;
    });
    const activeCustomers = new Set(recentOrders.map(o => o.customerId)).size;

    // 4. Avg Order Value
    const avgOrderValue = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;

    // 5. Orders by Status
    const ordersByStatus = currentOrders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // 6. Revenue Chart Data
    // For 'today', show hourly? No, simple daily breakdown is robust enough for now.
    // Let's stick to Daily breakdown for Week/Month, and maybe just single bar for Today or 4-hour chunks?
    // To keep it simple: generic "Revenue Trend" over the selected period.
    const revenueChartData: { name: string; value: number }[] = [];

    if (range === 'today') {
        // Hourly buckets
        const hours = Array.from({ length: 24 }, (_, i) => i);
        revenueChartData.push(...hours.map(h => ({ name: `${h}:00`, value: 0 })));

        currentOrders.forEach(o => {
            const date = o.createdAt instanceof Date ? o.createdAt : new Date((o.createdAt as any).seconds * 1000);
            const hour = date.getHours();
            revenueChartData[hour].value += o.totalAmount;
        });
    } else {
        // Daily buckets
        const days = range === 'week' ? 7 : 30;
        const bucketMap = new Map<string, number>();

        // Initialize last N days with 0
        for (let i = 0; i < days; i++) {
            const d = subDays(now, i);
            bucketMap.set(format(d, 'MMM dd'), 0);
        }

        currentOrders.forEach(o => {
            const date = o.createdAt instanceof Date ? o.createdAt : new Date((o.createdAt as any).seconds * 1000);
            const key = format(date, 'MMM dd');
            if (bucketMap.has(key)) {
                bucketMap.set(key, (bucketMap.get(key) || 0) + o.totalAmount);
            }
        });

        // Convert to array (reverse to show chronological)
        revenueChartData.push(...Array.from(bucketMap.entries()).map(([name, value]) => ({ name, value })).reverse());
    }

    // 7. Top Products
    const productSales = new Map<string, { quantity: number; revenue: number; name: string }>();

    currentOrders.forEach(order => {
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

    // 8. Category Revenue
    const categoryRevenue = currentOrders.reduce((acc, order) => {
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
        totalRevenue,
        previousRevenue,
        totalOrders: totalOrdersCount,
        previousOrders: previousOrdersCount,
        activeCustomers,
        avgOrderValue,
        ordersByStatus,
        revenueChartData,
        topProducts,
        categoryRevenue
    };
}
