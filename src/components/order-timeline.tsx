'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Clock, Package, Truck, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderTimelineProps {
    status: string;
    createdAt: Date;
    confirmedAt?: Date;
    deliveredAt?: Date;
    cancelledAt?: Date;
}

const STATUSES = [
    { key: 'PENDING', label: 'Order Placed', icon: Circle },
    { key: 'CONFIRMED', label: 'Confirmed', icon: CheckCircle2 },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: Truck },
    { key: 'DELIVERED', label: 'Delivered', icon: Package },
];

export function OrderTimeline({ status, createdAt, confirmedAt, deliveredAt, cancelledAt }: OrderTimelineProps) {
    if (status === 'CANCELLED') {
        return (
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                <XCircle className="h-6 w-6 text-red-600" />
                <div>
                    <p className="font-semibold text-red-900">Order Cancelled</p>
                    {cancelledAt && (
                        <p className="text-sm text-red-700">
                            {new Date(cancelledAt).toLocaleString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'short'
                            })}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    const currentIndex = STATUSES.findIndex(s => s.key === status);

    return (
        <div className="space-y-4">
            {STATUSES.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = index <= currentIndex;
                const isCurrent = index === currentIndex;
                const isLast = index === STATUSES.length - 1;

                return (
                    <div key={step.key} className="relative">
                        <div className="flex items-start gap-4">
                            {/* Icon */}
                            <div className={cn(
                                "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                                isCompleted
                                    ? "bg-primary border-primary text-white"
                                    : "bg-white border-gray-300 text-gray-400"
                            )}>
                                <Icon className="h-5 w-5" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 pb-8">
                                <p className={cn(
                                    "font-semibold",
                                    isCompleted ? "text-gray-900" : "text-gray-500"
                                )}>
                                    {step.label}
                                </p>
                                {isCompleted && (
                                    <p className="text-sm text-gray-600 mt-1">
                                        {index === 0 && createdAt && (
                                            new Date(createdAt).toLocaleString('en-IN', {
                                                dateStyle: 'medium',
                                                timeStyle: 'short'
                                            })
                                        )}
                                        {index === 1 && confirmedAt && (
                                            new Date(confirmedAt).toLocaleString('en-IN', {
                                                dateStyle: 'medium',
                                                timeStyle: 'short'
                                            })
                                        )}
                                        {index === 3 && deliveredAt && (
                                            new Date(deliveredAt).toLocaleString('en-IN', {
                                                dateStyle: 'medium',
                                                timeStyle: 'short'
                                            })
                                        )}
                                    </p>
                                )}
                                {isCurrent && !isCompleted && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <Clock className="h-4 w-4 text-primary animate-pulse" />
                                        <span className="text-sm text-primary font-medium">In Progress</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Connector Line */}
                        {!isLast && (
                            <div className={cn(
                                "absolute left-5 top-10 w-0.5 h-full -ml-px",
                                isCompleted ? "bg-primary" : "bg-gray-300"
                            )} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
