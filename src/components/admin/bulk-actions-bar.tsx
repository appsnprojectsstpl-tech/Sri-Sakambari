'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Order, User } from '@/lib/types';
import { CheckSquare, MoreVertical, UserPlus, Trash2, FileText } from 'lucide-react';

interface BulkActionsBarProps {
    selectedOrders: string[];
    totalOrders: number;
    onSelectAll: () => void;
    onClearSelection: () => void;
    onBulkStatusUpdate: (status: string) => void;
    onBulkAssign: (partnerId: string) => void;
    onBulkDelete: () => void;
    deliveryPartners: User[];
}

export function BulkActionsBar({
    selectedOrders,
    totalOrders,
    onSelectAll,
    onClearSelection,
    onBulkStatusUpdate,
    onBulkAssign,
    onBulkDelete,
    deliveryPartners
}: BulkActionsBarProps) {
    const selectedCount = selectedOrders.length;
    const allSelected = selectedCount === totalOrders && totalOrders > 0;

    if (selectedCount === 0) return null;

    return (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-full shadow-lg px-6 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-5">
            <div className="flex items-center gap-2">
                <Checkbox
                    checked={allSelected}
                    onCheckedChange={allSelected ? onClearSelection : onSelectAll}
                />
                <span className="font-semibold">
                    {selectedCount} selected
                </span>
            </div>

            <div className="h-6 w-px bg-primary-foreground/20" />

            {/* Update Status */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm">
                        <CheckSquare className="h-4 w-4 mr-2" />
                        Update Status
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => onBulkStatusUpdate('CONFIRMED')}>
                        Mark as Confirmed
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onBulkStatusUpdate('OUT_FOR_DELIVERY')}>
                        Mark as Out for Delivery
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onBulkStatusUpdate('DELIVERED')}>
                        Mark as Delivered
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onBulkStatusUpdate('CANCELLED')}>
                        Mark as Cancelled
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Assign Partner */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Assign Partner
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    {deliveryPartners.map((partner) => (
                        <DropdownMenuItem key={partner.id} onClick={() => onBulkAssign(partner.id)}>
                            {partner.name}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* More Actions */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem>
                        <FileText className="h-4 w-4 mr-2" />
                        Print Invoices
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onBulkDelete} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Selected
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="sm" onClick={onClearSelection}>
                Clear
            </Button>
        </div>
    );
}
