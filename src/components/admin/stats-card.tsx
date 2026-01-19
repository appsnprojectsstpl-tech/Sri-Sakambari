import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    subtitle?: string;
}

export function StatsCard({ title, value, icon, trend, subtitle }: StatsCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <div className="text-muted-foreground">{icon}</div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {trend && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        {trend.isPositive ? (
                            <TrendingUp className="h-3 w-3 text-green-600" />
                        ) : trend.value === 0 ? (
                            <Minus className="h-3 w-3 text-gray-600" />
                        ) : (
                            <TrendingDown className="h-3 w-3 text-red-600" />
                        )}
                        <span className={cn(
                            trend.isPositive ? "text-green-600" : trend.value === 0 ? "text-gray-600" : "text-red-600"
                        )}>
                            {Math.abs(trend.value)}%
                        </span>
                        <span>from yesterday</span>
                    </div>
                )}
                {subtitle && (
                    <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
                )}
            </CardContent>
        </Card>
    );
}
