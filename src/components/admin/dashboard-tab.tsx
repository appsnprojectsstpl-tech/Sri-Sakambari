'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from './stats-card';
import { calculateDashboardStats } from '@/lib/admin-analytics';
import { Order, Product } from '@/lib/types';
import {
    DollarSign,
    ShoppingCart,
    Users,
    TrendingUp,
    Package,
    Clock,
    Loader2
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
    const stats = useMemo(() => {
        if (!orders || !products) return null;
        return calculateDashboardStats(orders, products);
    }, [orders, products]);

    const revenueTrend = useMemo(() => {
        if (!stats) return { value: 0, isPositive: true };
        const change = stats.yesterdayRevenue > 0
            ? ((stats.todayRevenue - stats.yesterdayRevenue) / stats.yesterdayRevenue) * 100
            : 0;
        return {
            value: Math.round(change),
            isPositive: change >= 0
        };
    }, [stats]);

    const ordersTrend = useMemo(() => {
        if (!stats) return { value: 0, isPositive: true };
        const change = stats.yesterdayOrders > 0
            ? ((stats.totalOrders - stats.yesterdayOrders) / stats.yesterdayOrders) * 100
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

    const recentOrders = useMemo(() => {
        if (!orders) return [];
        return orders
            .filter(o => {
                const orderDate = o.createdAt instanceof Date ? o.createdAt : new Date((o.createdAt as any).seconds * 1000);
                const today = new Date();
                return orderDate.toDateString() === today.toDateString();
            })
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
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Today's Revenue"
                    value={`₹${stats.todayRevenue.toLocaleString('en-IN')}`}
                    icon={<DollarSign className="h-4 w-4" />}
                    trend={revenueTrend}
                />
                <StatsCard
                    title="Today's Orders"
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
                    subtitle="Today"
                />
            </div>

            {/* Charts Row */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Revenue Trend */}
                <Card>
                    <CardHeader>
                        <CardTitle>Revenue Trend</CardTitle>
                        <CardDescription>Last 7 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={stats.revenueByDay}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip
                                    formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#3b82f6"
                                    fillOpacity={1}
                                    fill="url(#colorRevenue)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Order Status Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle>Order Status</CardTitle>
                        <CardDescription>Today's orders breakdown</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {statusData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={80}
                                        fill="#8884d8"
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
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                No orders today
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
                        <CardTitle>Top Products</CardTitle>
                        <CardDescription>Best sellers today</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {stats.topProducts.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">Revenue</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stats.topProducts.map((product, index) => (
                                        <TableRow key={product.productId}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">
                                                        {index + 1}
                                                    </Badge>
                                                    {product.name}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">{product.quantity}</TableCell>
                                            <TableCell className="text-right font-semibold">
                                                ₹{product.revenue.toLocaleString('en-IN')}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                                <Package className="h-8 w-8 mb-2" />
                                <p>No sales today</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Orders */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Orders</CardTitle>
                        <CardDescription>Latest orders today</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {recentOrders.length > 0 ? (
                            <div className="space-y-3">
                                {recentOrders.map((order) => (
                                    <div
                                        key={order.id}
                                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">#{order.id.slice(0, 8)}</p>
                                            <p className="text-xs text-muted-foreground">{order.name}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <p className="font-semibold">₹{order.totalAmount}</p>
                                            <Badge variant={
                                                order.status === 'DELIVERED' ? 'default' :
                                                    order.status === 'CANCELLED' ? 'destructive' :
                                                        'secondary'
                                            }>
                                                {order.status}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                                <Clock className="h-8 w-8 mb-2" />
                                <p>No orders yet today</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Category Performance */}
            {stats.categoryRevenue.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Category Performance</CardTitle>
                        <CardDescription>Revenue by category today</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={stats.categoryRevenue}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="category" />
                                <YAxis />
                                <Tooltip
                                    formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`}
                                />
                                <Legend />
                                <Bar dataKey="revenue" fill="#3b82f6" name="Revenue (₹)" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
