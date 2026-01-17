'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, ShoppingCart, Wallet } from 'lucide-react';
import type { Order } from '@/lib/types';
import { useMemo } from 'react';

interface AnalyticsDashboardProps {
    orders: Order[];
}

export default function AnalyticsDashboard({ orders }: AnalyticsDashboardProps) {
    const analytics = useMemo(() => {
        const totalSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
        const totalOrders = orders.length;
        const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

        // Calculate monthly spending
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthlySpent = orders
            .filter(order => {
                const orderDate = order.createdAt instanceof Date
                    ? order.createdAt
                    : new Date((order.createdAt as any).seconds * 1000);
                return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
            })
            .reduce((sum, order) => sum + order.totalAmount, 0);

        // Calculate savings (mock - you can calculate from actual discounts)
        const totalSavings = totalSpent * 0.15; // Assume 15% average savings

        return {
            totalSpent,
            totalOrders,
            avgOrderValue,
            monthlySpent,
            totalSavings
        };
    }, [orders]);

    const stats = [
        {
            title: 'Total Spent',
            value: `₹${analytics.totalSpent.toFixed(0)}`,
            icon: Wallet,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50 dark:bg-blue-950'
        },
        {
            title: 'Total Orders',
            value: analytics.totalOrders.toString(),
            icon: ShoppingCart,
            color: 'text-green-600',
            bgColor: 'bg-green-50 dark:bg-green-950'
        },
        {
            title: 'Avg Order Value',
            value: `₹${analytics.avgOrderValue.toFixed(0)}`,
            icon: TrendingUp,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50 dark:bg-purple-950'
        },
        {
            title: 'This Month',
            value: `₹${analytics.monthlySpent.toFixed(0)}`,
            icon: BarChart3,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50 dark:bg-orange-950'
        }
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Spending Insights
                </CardTitle>
                <CardDescription>Your shopping analytics at a glance</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4">
                    {stats.map((stat) => {
                        const Icon = stat.icon;
                        return (
                            <div key={stat.title} className={`p-4 rounded-lg ${stat.bgColor}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <Icon className={`h-5 w-5 ${stat.color}`} />
                                </div>
                                <p className="text-2xl font-bold">{stat.value}</p>
                                <p className="text-xs text-muted-foreground mt-1">{stat.title}</p>
                            </div>
                        );
                    })}
                </div>

                {analytics.totalSavings > 0 && (
                    <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                        <p className="text-sm font-medium text-green-900 dark:text-green-100">
                            💰 You've saved ₹{analytics.totalSavings.toFixed(0)} with offers!
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
