'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from './stats-card';
import { calculateDashboardStats, TimeRange } from '@/lib/admin-analytics';
import { Order, Product } from '@/lib/types';
import {
    DollarSign,
    ShoppingCart,
    Users,
    TrendingUp,
    Package,
    Clock,
    Loader2,
    Calendar,
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react';
import {
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DashboardTabProps {
    orders: Order[];
    products: Product[];
    loading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
    PENDING: '#f59e0b',
    PENDING_PAYMENT: '#ef4444',
    CONFIRMED: '#3b82f6',
    OUT_FOR_DELIVERY: '#8b5cf6',
    DELIVERED: '#10b981',
    CANCELLED: '#6b7280'
};

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function DashboardTab({ orders, products, loading }: DashboardTabProps) {
    const [timeRange, setTimeRange] = useState<TimeRange>('today');

    const stats = useMemo(() => {
        if (!orders || !products) return null;
        return calculateDashboardStats(orders, products, timeRange);
    }, [orders, products, timeRange]);

    const revenueTrend = useMemo(() => {
        if (!stats) return { value: 0, isPositive: true };
        const change = stats.previousRevenue > 0
            ? ((stats.totalRevenue - stats.previousRevenue) / stats.previousRevenue) * 100
            : 0;
        return {
            value: Math.round(change),
            isPositive: change >= 0
        };
    }, [stats]);

    const ordersTrend = useMemo(() => {
        if (!stats) return { value: 0, isPositive: true };
        const change = stats.previousOrders > 0
            ? ((stats.totalOrders - stats.previousOrders) / stats.previousOrders) * 100
            : 0;
        return {
            value: Math.round(change),
            isPositive: change >= 0
        };
    }, [stats]);

    const statusData = useMemo(() => {
        if (!stats) return [];
        return Object.entries(stats.ordersByStatus).map(([status, count]) => ({
            name: status.replace(/_/g, ' '),
            value: count
        }));
    }, [stats]);

    // Derived Recent Orders (using generic filtering logic for consistency, though specialized for view)
    const recentOrders = useMemo(() => {
        if (!orders) return [];
        // Just take top 5 most recent regardless of filter for the "Recent Activity" feed
        // Or should it respect the filter? Usually "Recent" implies global recent. 
        // Let's stick to global recent for this specific widget to show live activity.
        return [...orders]
            .sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt : new Date((a.createdAt as any).seconds * 1000);
                const dateB = b.createdAt instanceof Date ? b.createdAt : new Date((b.createdAt as any).seconds * 1000);
                return dateB.getTime() - dateA.getTime();
            })
            .slice(0, 5);
    }, [orders]);

    if (loading || !stats) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Time Range Filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Overview</h2>
                    <p className="text-sm text-muted-foreground">
                        Your store performance for {timeRange === 'today' ? 'today' : timeRange === 'week' ? 'the last 7 days' : 'the last 30 days'}.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Select value={timeRange} onValueChange={(v: TimeRange) => setTimeRange(v)}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="week">Last 7 Days</SelectItem>
                            <SelectItem value="month">Last 30 Days</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Total Revenue"
                    value={`₹${stats.totalRevenue.toLocaleString('en-IN')}`}
                    icon={<DollarSign className="h-4 w-4" />}
                    trend={revenueTrend}
                />
                <StatsCard
                    title="Orders"
                    value={stats.totalOrders}
                    icon={<ShoppingCart className="h-4 w-4" />}
                    trend={ordersTrend}
                />
                <StatsCard
                    title="Active Customers"
                    value={stats.activeCustomers}
                    icon={<Users className="h-4 w-4" />}
                    subtitle="Last 30 days"
                />
                <StatsCard
                    title="Avg Order Value"
                    value={`₹${Math.round(stats.avgOrderValue)}`}
                    icon={<TrendingUp className="h-4 w-4" />}
                    subtitle="For selected period"
                />
            </div>

            {/* Charts Row */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Revenue Trend */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Revenue Trend</CardTitle>
                        <CardDescription>
                            {timeRange === 'today' ? 'Hourly breakdown' : 'Daily breakdown'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={stats.revenueChartData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    minTickGap={32}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `₹${value}`}
                                    width={60}
                                />
                                <Tooltip
                                    formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`}
                                    labelStyle={{ color: '#666' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#3b82f6"
                                    fillOpacity={1}
                                    fill="url(#colorRevenue)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Order Status Distribution */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Order Status</CardTitle>
                        <CardDescription>Breakdown for selected period</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {statusData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={STATUS_COLORS[entry.name.replace(/ /g, '_')] || CHART_COLORS[index % CHART_COLORS.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground bg-muted/20 rounded-lg border-dashed border-2">
                                No orders in this period
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Bottom Row */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Top Products */}
                <Card>
                    <CardHeader>
                        <CardTitle>Top Selling Products</CardTitle>
                        <CardDescription>By revenue in selected period</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {stats.topProducts.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">#</TableHead>
                                        <TableHead>Product</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">Revenue</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stats.topProducts.map((product, index) => (
                                        <TableRow key={product.productId}>
                                            <TableCell className="font-medium text-muted-foreground">
                                                {index + 1}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {product.name}
                                            </TableCell>
                                            <TableCell className="text-right">{product.quantity}</TableCell>
                                            <TableCell className="text-right font-bold text-green-600">
                                                ₹{product.revenue.toLocaleString('en-IN')}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground bg-muted/20 rounded-lg">
                                <Package className="h-8 w-8 mb-2 opacity-20" />
                                <p>No sales yet</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Global Orders */}
                <Card>
                    <CardHeader>
                        <CardTitle>Live Activity</CardTitle>
                        <CardDescription>Most recent incoming orders</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recentOrders.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="pl-6">Order ID</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right pr-6">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentOrders.map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="pl-6">
                                                <div className="font-medium">#{order.id.slice(0, 6)}</div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {order.createdAt instanceof Date
                                                        ? order.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                        : 'Just now'} // Simplified for safety
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    order.status === 'DELIVERED' ? 'default' :
                                                        order.status === 'CANCELLED' ? 'destructive' :
                                                            order.status === 'CONFIRMED' ? 'secondary' :
                                                                'outline'
                                                } className="text-[10px] px-2 py-0.5">
                                                    {order.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-bold pr-6">
                                                ₹{order.totalAmount}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                                <Clock className="h-8 w-8 mb-2 opacity-20" />
                                <p>No recent orders</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Category Chart */}
            {stats.categoryRevenue.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Category Performance</CardTitle>
                        <CardDescription>Revenue distribution by category</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.categoryRevenue} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="category" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                                    <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} cursor={{ fill: 'transparent' }} />
                                    <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            )}

        </div>
    );
}
