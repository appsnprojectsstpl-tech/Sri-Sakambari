'use client';

import { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Order, User, Product } from '@/lib/types';
import {
    Search,
    Filter,
    MoreHorizontal,
    User as UserIcon,
    MapPin,
    Clock,
    Truck,
    CheckCircle,
    XCircle,
    AlertCircle,
    Download,
    Database,
    ArrowLeft,
    ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { createNotification } from '@/firebase';
import { t } from '@/lib/translations'; // Assuming you have this
import { useLanguage } from '@/context/language-context'; // Assuming this too
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { OrderFiltersBar, OrderFilters } from './order-filters-bar';
import { filterOrders, getUniqueAreas } from '@/lib/order-utils'; // Reuse existing utils

interface OrdersTabProps {
    orders: Order[];
    users: User[];
    products: Product[];
    loading: boolean;
    onOrderUpdate?: () => void;
    // Pagination props
    pageIndex: number;
    onNextPage: () => void;
    onPrevPage: () => void;
    hasMore: boolean;
    onExport: () => void;
    onMigrate: () => void;
}

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    PENDING: "outline",
    PENDING_PAYMENT: "destructive",
    CONFIRMED: "default",
    OUT_FOR_DELIVERY: "secondary",
    DELIVERED: "default",
    CANCELLED: "destructive",
};

export default function OrdersTab({
    orders,
    users,
    products,
    loading,
    onOrderUpdate,
    pageIndex,
    onNextPage,
    onPrevPage,
    hasMore,
    onExport,
    onMigrate
}: OrdersTabProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { language } = useLanguage();

    // Filters State
    const [filters, setFilters] = useState<OrderFilters>({
        searchTerm: '',
        status: 'all',
        paymentMode: 'all',
        area: 'all',
        dateFrom: '',
        dateTo: ''
    });

    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    // Derived Data
    const filteredOrders = filterOrders(orders, filters, users);
    const deliveryStaff = users.filter(u => u.role === 'delivery');
    const uniqueAreas = getUniqueAreas(orders);

    // Actions
    const handleStatusChange = async (orderId: string, newStatus: Order['status']) => {
        if (!firestore) return;
        try {
            await setDoc(doc(firestore, 'orders', orderId), { status: newStatus }, { merge: true });

            // Notify Customer
            const order = orders.find(o => o.id === orderId);
            if (order) {
                await addDoc(collection(firestore, 'notifications'), {
                    userId: order.customerId,
                    title: `Order Update: ${newStatus.replace(/_/g, ' ')}`,
                    message: `Your Order #${orderId} is now ${newStatus.toLowerCase().replace(/_/g, ' ')}.`,
                    isRead: false,
                    createdAt: serverTimestamp(),
                    type: 'order',
                    linkId: orderId
                });
            }

            toast({ title: "Status Updated", description: `Order marked as ${newStatus}` });
            if (onOrderUpdate) onOrderUpdate();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Update Failed", description: error.message });
        }
    };

    const handleAssignDriver = async (orderId: string, staff: User) => {
        if (!firestore) return;
        try {
            // Logic to auto-confirm if pending
            const currentOrder = orders.find(o => o.id === orderId);
            const newStatus = currentOrder?.status === 'PENDING' ? 'CONFIRMED' : currentOrder?.status;

            await setDoc(doc(firestore, 'orders', orderId), {
                deliveryPartnerId: staff.id,
                status: newStatus
            }, { merge: true });

            await createNotification(
                firestore,
                staff.id,
                'New Order Assigned',
                `You have been assigned order #${orderId}`
            );

            toast({ title: "Driver Assigned", description: `${staff.name} assigned to #${orderId}` });
            if (onOrderUpdate) onOrderUpdate();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Assignment Failed", description: error.message });
        }
    };

    const handleViewDetails = (order: Order) => {
        setSelectedOrder(order);
        setDetailOpen(true);
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-card p-4 rounded-lg shadow-sm border">
                <OrderFiltersBar
                    filters={filters}
                    onFiltersChange={setFilters}
                    areas={uniqueAreas}
                    totalOrders={orders.length} // Should strictly be total count from DB, but this works for page view
                    filteredCount={filteredOrders.length}
                />
                <div className="flex gap-2 w-full md:w-auto">
                    <Button variant="outline" size="sm" onClick={onMigrate} className="flex-1 md:flex-none">
                        <Database className="mr-2 h-4 w-4" /> Migrate
                    </Button>
                    <Button variant="default" size="sm" onClick={onExport} className="flex-1 md:flex-none">
                        <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md border bg-card overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[100px]">Order ID</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Driver</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">Loading orders...</TableCell>
                            </TableRow>
                        ) : filteredOrders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    No orders found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredOrders.map((order) => {
                                const customer = users.find(u => u.id === order.customerId);
                                const driver = users.find(u => u.id === order.deliveryPartnerId);
                                const date = order.createdAt instanceof Date
                                    ? order.createdAt
                                    : new Date((order.createdAt as any).seconds * 1000);

                                return (
                                    <TableRow key={order.id} className="hover:bg-muted/5 group">
                                        <TableCell className="font-mono text-xs font-medium">
                                            #{order.id.slice(0, 6)}
                                            <div className="text-[10px] text-muted-foreground mt-1">
                                                {format(date, 'MMM d, h:mm a')}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm">{customer?.name || 'Unknown'}</span>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" /> {order.area}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm max-w-[200px] truncate" title={order.items.map(i => i.name).join(', ')}>
                                                {order.items.length} items
                                                <span className="text-muted-foreground text-xs ml-1">
                                                    ({order.items.slice(0, 2).map(i => i.name?.split(' ')[0]).join(', ')}{order.items.length > 2 ? '...' : ''})
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-semibold">
                                            ₹{order.totalAmount}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={STATUS_COLORS[order.status] || 'default'} className="whitespace-nowrap">
                                                {order.status.replace(/_/g, ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 text-xs w-[120px] justify-start px-2">
                                                        {driver ? (
                                                            <div className="flex items-center gap-2">
                                                                <Truck className="h-3 w-3 text-primary" />
                                                                <span className="truncate">{driver.name.split(' ')[0]}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground">Assign Driver</span>
                                                        )}
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" className="w-[180px]">
                                                    <DropdownMenuLabel>Select Driver</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    {deliveryStaff.length > 0 ? deliveryStaff.map(staff => (
                                                        <DropdownMenuItem key={staff.id} onClick={() => handleAssignDriver(order.id, staff)}>
                                                            {staff.name}
                                                        </DropdownMenuItem>
                                                    )) : <div className="p-2 text-xs text-muted-foreground">No active drivers</div>}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleViewDetails(order)}>
                                                        View Details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'CONFIRMED')}>
                                                        Mark Confirmed
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'OUT_FOR_DELIVERY')}>
                                                        Mark Out For Delivery
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'DELIVERED')}>
                                                        Mark Delivered
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-destructive" onClick={() => handleStatusChange(order.id, 'CANCELLED')}>
                                                        Cancel Order
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {loading ? (
                    <div className="p-8 text-center bg-card rounded-lg border">Loading orders...</div>
                ) : filteredOrders.length === 0 ? (
                    <div className="p-8 text-center bg-card rounded-lg border text-muted-foreground">No orders found.</div>
                ) : (
                    filteredOrders.map((order) => {
                        const customer = users.find(u => u.id === order.customerId);
                        const driver = users.find(u => u.id === order.deliveryPartnerId);
                        const date = order.createdAt instanceof Date
                            ? order.createdAt
                            : new Date((order.createdAt as any).seconds * 1000);

                        return (
                            <Card key={order.id} className="overflow-hidden border-2">
                                <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 bg-muted/20 border-b">
                                    <div className="space-y-1">
                                        <CardTitle className="text-base font-mono">#{order.id.slice(0, 8)}</CardTitle>
                                        <CardDescription className="text-[10px]">{format(date, 'MMM d, h:mm a')}</CardDescription>
                                    </div>
                                    <Badge variant={STATUS_COLORS[order.status] || 'default'}>
                                        {order.status.replace(/_/g, ' ')}
                                    </Badge>
                                </CardHeader>
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-bold text-sm">{customer?.name || 'Unknown'}</div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                <MapPin className="h-3 w-3" /> {order.area}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-primary">₹{order.totalAmount}</div>
                                            <div className="text-[10px] text-muted-foreground">{order.paymentMode}</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded text-xs">
                                        <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="flex-1 text-left font-medium">
                                                    {driver ? driver.name : <span className="text-orange-600">Assign Driver</span>}
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="w-[200px]">
                                                <DropdownMenuLabel>Select Driver</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {deliveryStaff.map(staff => (
                                                    <DropdownMenuItem key={staff.id} onClick={() => handleAssignDriver(order.id, staff)}>
                                                        {staff.name}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <div className="pt-2 flex gap-2">
                                        <Button variant="outline" size="sm" className="flex-1 h-9 text-xs" onClick={() => handleViewDetails(order)}>
                                            Details
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button size="sm" className="flex-1 h-9 text-xs">Update Status</Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-[180px]">
                                                <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'CONFIRMED')}>Confirm</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'OUT_FOR_DELIVERY')}>Out for Delivery</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'DELIVERED')}>Mark Delivered</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-destructive" onClick={() => handleStatusChange(order.id, 'CANCELLED')}>Cancel Order</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Pagination Footer */}
            <div className="flex items-center justify-between p-4 border-t bg-card rounded-lg border">
                <div className="text-sm text-muted-foreground hidden sm:block">
                    Showing {filteredOrders.length} results
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onPrevPage}
                        disabled={pageIndex === 0 || loading}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" /> Previous
                    </Button>
                    <div className="text-sm font-medium">Page {pageIndex + 1}</div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onNextPage}
                        disabled={!hasMore || loading}
                    >
                        Next <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                </div>
            </div>

            {/* Order Details Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Order Details #{selectedOrder?.id?.slice(0, 8)}</DialogTitle>
                        <DialogDescription>
                            Placed on {selectedOrder?.createdAt && format(
                                selectedOrder.createdAt instanceof Date ? selectedOrder.createdAt : new Date((selectedOrder.createdAt as any).seconds * 1000),
                                "PPpp"
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedOrder && (
                        <div className="grid gap-6">
                            {/* Customer Info */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium">Customer</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-sm">
                                        <div className="font-semibold">{users.find(u => u.id === selectedOrder.customerId)?.name || 'Unknown'}</div>
                                        <div className="text-muted-foreground">{users.find(u => u.id === selectedOrder.customerId)?.phone}</div>
                                        <div className="mt-2">{selectedOrder.address}</div>
                                        <div>{selectedOrder.area}, {selectedOrder.pincode}</div>
                                        {selectedOrder.landmark && <div className="text-xs italic mt-1">Landmark: {selectedOrder.landmark}</div>}
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium">Order Info</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-sm space-y-1">
                                        <div className="flex justify-between">
                                            <span>Status:</span>
                                            <Badge variant={STATUS_COLORS[selectedOrder.status]}>{selectedOrder.status}</Badge>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Payment:</span>
                                            <span className="font-medium">{selectedOrder.paymentMode}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Driver:</span>
                                            <span className="font-medium">{users.find(u => u.id === selectedOrder.deliveryPartnerId)?.name || 'Unassigned'}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Order Items */}
                            <div>
                                <h3 className="font-semibold mb-2">Items</h3>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Product</TableHead>
                                                <TableHead className="text-right">Price</TableHead>
                                                <TableHead className="text-right">Qty</TableHead>
                                                <TableHead className="text-right">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedOrder.items.map((item, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell>
                                                        <div>{item.name}</div>
                                                        {item.selectedVariant && (
                                                            <div className="text-xs text-muted-foreground">
                                                                Variant: {item.selectedVariant.unit}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">₹{item.priceAtOrder}</TableCell>
                                                    <TableCell className="text-right">{item.qty}</TableCell>
                                                    <TableCell className="text-right font-medium">₹{item.priceAtOrder * item.qty}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            {/* Summary */}
                            <div className="flex justify-end">
                                <div className="w-[200px] space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Subtotal</span>
                                        <span>₹{selectedOrder.items.reduce((sum, i) => sum + (i.priceAtOrder * i.qty), 0)}</span>
                                    </div>
                                    {/* Add Delivery/Tax logic if widely used, currently simplified */}
                                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                                        <span>Total</span>
                                        <span>₹{selectedOrder.totalAmount}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
