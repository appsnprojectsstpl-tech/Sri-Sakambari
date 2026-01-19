'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search, X, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface OrderFilters {
    searchTerm: string;
    status: string;
    paymentMode: string;
    area: string;
    dateFrom: string;
    dateTo: string;
}

interface OrderFiltersBarProps {
    filters: OrderFilters;
    onFiltersChange: (filters: OrderFilters) => void;
    areas?: string[];
    totalOrders: number;
    filteredCount: number;
}

export function OrderFiltersBar({
    filters,
    onFiltersChange,
    areas = [],
    totalOrders,
    filteredCount
}: OrderFiltersBarProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const updateFilter = (key: keyof OrderFilters, value: string) => {
        onFiltersChange({ ...filters, [key]: value });
    };

    const clearFilters = () => {
        onFiltersChange({
            searchTerm: '',
            status: 'all',
            paymentMode: 'all',
            area: 'all',
            dateFrom: '',
            dateTo: ''
        });
    };

    const hasActiveFilters =
        filters.searchTerm ||
        filters.status !== 'all' ||
        filters.paymentMode !== 'all' ||
        filters.area !== 'all' ||
        filters.dateFrom ||
        filters.dateTo;

    const activeFilterCount = [
        filters.searchTerm,
        filters.status !== 'all',
        filters.paymentMode !== 'all',
        filters.area !== 'all',
        filters.dateFrom,
        filters.dateTo
    ].filter(Boolean).length;

    return (
        <Card className="mb-4">
            <CardContent className="pt-6">
                <div className="space-y-4">
                    {/* Search Bar - Always Visible */}
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by Order ID, Customer Name, or Phone..."
                                value={filters.searchTerm}
                                onChange={(e) => updateFilter('searchTerm', e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? 'Hide' : 'More'} Filters
                            {activeFilterCount > 0 && (
                                <Badge variant="secondary" className="ml-2">
                                    {activeFilterCount}
                                </Badge>
                            )}
                        </Button>
                        {hasActiveFilters && (
                            <Button variant="ghost" size="icon" onClick={clearFilters}>
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    {/* Advanced Filters - Collapsible */}
                    {isExpanded && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                            {/* Status Filter */}
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={filters.status} onValueChange={(v) => updateFilter('status', v)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Statuses</SelectItem>
                                        <SelectItem value="PENDING">Pending</SelectItem>
                                        <SelectItem value="PENDING_PAYMENT">Pending Payment</SelectItem>
                                        <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                                        <SelectItem value="OUT_FOR_DELIVERY">Out for Delivery</SelectItem>
                                        <SelectItem value="DELIVERED">Delivered</SelectItem>
                                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Payment Mode Filter */}
                            <div className="space-y-2">
                                <Label>Payment Mode</Label>
                                <Select value={filters.paymentMode} onValueChange={(v) => updateFilter('paymentMode', v)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Modes</SelectItem>
                                        <SelectItem value="COD">Cash on Delivery</SelectItem>
                                        <SelectItem value="ONLINE">Online Payment</SelectItem>
                                        <SelectItem value="UPI">UPI</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Area Filter */}
                            <div className="space-y-2">
                                <Label>Delivery Area</Label>
                                <Select value={filters.area} onValueChange={(v) => updateFilter('area', v)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Areas</SelectItem>
                                        {areas.map((area) => (
                                            <SelectItem key={area} value={area}>
                                                {area}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Date From */}
                            <div className="space-y-2">
                                <Label>Date From</Label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="date"
                                        value={filters.dateFrom}
                                        onChange={(e) => updateFilter('dateFrom', e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>

                            {/* Date To */}
                            <div className="space-y-2">
                                <Label>Date To</Label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="date"
                                        value={filters.dateTo}
                                        onChange={(e) => updateFilter('dateTo', e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Results Count */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
                        <span>
                            Showing <strong>{filteredCount}</strong> of <strong>{totalOrders}</strong> orders
                        </span>
                        {hasActiveFilters && (
                            <Button variant="link" size="sm" onClick={clearFilters} className="h-auto p-0">
                                Clear all filters
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
