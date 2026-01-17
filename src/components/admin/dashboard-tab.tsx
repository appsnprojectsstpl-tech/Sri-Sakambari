import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Order, Product } from '@/lib/types';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart } from 'recharts';
import { Loader2 } from 'lucide-react';

interface DashboardTabProps {
    orders: Order[];
    products: Product[];
    loading: boolean;
}

export default function DashboardTab({ orders, products, loading }: DashboardTabProps) {

    const stats = useMemo(() => {
        if (!orders) return { dailyRevenue: [], topProducts: [] };

        // 1. Daily Revenue (Last 7 days)
        const dailyMap = new Map<string, number>();
        const today = new Date();

        // Initialize last 7 days with 0
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            dailyMap.set(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), 0);
        }

        orders.forEach(order => {
            if (order.status === 'CANCELLED') return;
            const d = new Date(order.createdAt as any); // Firebase TS handle
            const key = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            if (dailyMap.has(key)) {
                dailyMap.set(key, (dailyMap.get(key) || 0) + (order.totalAmount || 0));
            }
        });

        const dailyRevenue = Array.from(dailyMap.entries()).map(([date, amount]) => ({
            date,
            amount
        }));

        // 2. Top Products
        const productCount = new Map<string, number>();
        orders.forEach(order => {
            if (order.status === 'CANCELLED') return;
            order.items.forEach(item => {
                productCount.set(item.productId, (productCount.get(item.productId) || 0) + item.quantity);
            });
        });

        const topProducts = Array.from(productCount.entries())
            .map(([id, count]) => {
                const product = products.find(p => p.id === id);
                return {
                    name: product?.name || 'Unknown',
                    count
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return { dailyRevenue, topProducts };

    }, [orders, products]);

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Revenue (Last 7 Days)</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={stats.dailyRevenue}>
                                <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                                <Tooltip />
                                <Bar dataKey="amount" fill="#adfa1d" radius={[4, 4, 0, 0]} className="fill-primary" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Top Selling Products</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats.topProducts.map((p, i) => (
                                <div key={i} className="flex items-center">
                                    <div className="ml-4 space-y-1">
                                        <p className="text-sm font-medium leading-none">{p.name}</p>
                                    </div>
                                    <div className="ml-auto font-medium">
                                        {p.count} sold
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
