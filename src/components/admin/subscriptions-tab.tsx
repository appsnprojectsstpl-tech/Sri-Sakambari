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
    DropdownMenuLabel,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Input as SearchInput } from "@/components/ui/input"; // Alias if needed
import { Subscription, User, Product } from '@/lib/types';
import {
    MoreHorizontal,
    MapPin,
    Calendar,
    Clock,
    CheckCircle2,
    PauseCircle,
    Search,
    Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface SubscriptionsTabProps {
    subscriptions: Subscription[];
    users: User[];
    products: Product[];
    loading: boolean;
    onUpdate?: () => void;
}

export default function SubscriptionsTab({
    subscriptions,
    users,
    products,
    loading,
    onUpdate
}: SubscriptionsTabProps) {
    const { toast } = useToast();
    const firestore = useFirestore();

    // Local Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
    const [areaFilter, setAreaFilter] = useState('all');

    const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    // Get unique areas from subscriptions
    const uniqueAreas = Array.from(new Set(subscriptions.map(s => s.area))).sort();

    // Derived Data
    const filteredSubscriptions = subscriptions.filter(sub => {
        const customer = users.find(u => u.id === sub.customerId);
        const matchesSearch =
            sub.planName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sub.id.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus =
            statusFilter === 'all' ? true :
                statusFilter === 'active' ? sub.isActive :
                    !sub.isActive;

        const matchesArea = areaFilter === 'all' || sub.area === areaFilter;

        return matchesSearch && matchesStatus && matchesArea;
    });

    // Actions
    const handleToggleStatus = async (sub: Subscription) => {
        if (!firestore) return;
        try {
            await updateDoc(doc(firestore, 'subscriptions', sub.id), {
                isActive: !sub.isActive
            });
            toast({
                title: "Status Updated",
                description: `Subscription is now ${!sub.isActive ? 'Active' : 'Paused'}`
            });
            if (onUpdate) onUpdate();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Update Failed", description: error.message });
        }
    };

    const handleViewDetails = (sub: Subscription) => {
        setSelectedSub(sub);
        setDetailOpen(true);
    };

    return (
        <div className="space-y-4">
            {/* Filters Bar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-card p-4 rounded-lg shadow-sm border">
                <div className="flex flex-1 gap-2 w-full md:w-auto overflow-x-auto">
                    <div className="relative w-full md:w-[250px]">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search subscriptions..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8"
                        />
                    </div>

                    <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                        <SelectTrigger className="w-[130px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="paused">Paused</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={areaFilter} onValueChange={setAreaFilter}>
                        <SelectTrigger className="w-[150px]">
                            <div className="flex items-center gap-2 truncate">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="Area" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Areas</SelectItem>
                            {uniqueAreas.map(area => (
                                <SelectItem key={area} value={area}>{area}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Content */}
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Plan Name</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Frequency</TableHead>
                            <TableHead>Area</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">Loading subscriptions...</TableCell>
                            </TableRow>
                        ) : filteredSubscriptions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No subscriptions found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredSubscriptions.map((sub) => {
                                const customer = users.find(u => u.id === sub.customerId);
                                return (
                                    <TableRow key={sub.id} className="hover:bg-muted/5 group">
                                        <TableCell className="font-medium">
                                            {sub.planName}
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                {sub.items.length} item(s)
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div>{customer?.name || 'Unknown'}</div>
                                            <div className="text-xs text-muted-foreground">{customer?.phone}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-normal capitalize">
                                                {sub.frequency.toLowerCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1 text-sm">
                                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                                {sub.area}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={sub.isActive ? 'default' : 'secondary'} className="gap-1 pl-1.5">
                                                {sub.isActive ? <CheckCircle2 className="h-3 w-3" /> : <PauseCircle className="h-3 w-3" />}
                                                {sub.isActive ? 'Active' : 'Paused'}
                                            </Badge>
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
                                                    <DropdownMenuItem onClick={() => handleViewDetails(sub)}>
                                                        View Details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleToggleStatus(sub)}>
                                                        {sub.isActive ? 'Pause Subscription' : 'Resume Subscription'}
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
                <div className="p-4 border-t text-sm text-muted-foreground text-center md:text-left">
                    Showing {filteredSubscriptions.length} of {subscriptions.length} subscriptions
                </div>
            </div>

            {/* Details Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Subscription Details</DialogTitle>
                        <DialogDescription>
                            Started on {selectedSub?.startDate ? (() => {
                                try {
                                    const date = selectedSub.startDate instanceof Date
                                        ? selectedSub.startDate
                                        : (selectedSub.startDate as any).seconds
                                            ? new Date((selectedSub.startDate as any).seconds * 1000)
                                            : new Date(selectedSub.startDate);
                                    return format(date, 'PPP');
                                } catch (e) {
                                    return 'Invalid Date';
                                }
                            })() : 'Unknown Date'}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSub && (
                        <div className="grid gap-6">
                            <div className="grid md:grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium">Customer</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-sm">
                                        <div className="font-semibold">{users.find(u => u.id === selectedSub.customerId)?.name || 'Unknown'}</div>
                                        <div className="text-muted-foreground">{users.find(u => u.id === selectedSub.customerId)?.phone}</div>
                                        <div className="mt-2">{selectedSub.area}</div>
                                        <div className="text-xs text-muted-foreground mt-1">Slot: {selectedSub.deliverySlot}</div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium">Status Check</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span>Status:</span>
                                            <Badge variant={selectedSub.isActive ? 'default' : 'secondary'}>{selectedSub.isActive ? 'Active' : 'Paused'}</Badge>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span>Frequency:</span>
                                            <span className="font-medium capitalize">{selectedSub.frequency.toLowerCase()}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <div>
                                <h3 className="font-semibold mb-2">Included Items</h3>
                                <div className="rounded-md border p-0 overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/30">
                                                <TableHead>Product</TableHead>
                                                <TableHead className="text-right">Qty</TableHead>
                                                <TableHead className="text-right">Est. Price</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedSub.items.map((item, i) => {
                                                const product = products.find(p => p.id === item.productId);
                                                return (
                                                    <TableRow key={i}>
                                                        <TableCell>
                                                            <div className="font-medium">{product?.name || 'Unknown Product'}</div>
                                                            <div className="text-xs text-muted-foreground">{product?.unit}</div>
                                                        </TableCell>
                                                        <TableCell className="text-right">{item.qty}</TableCell>
                                                        <TableCell className="text-right text-muted-foreground">
                                                            ₹{(product?.pricePerUnit || 0) * item.qty}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                            <TableRow className="bg-muted/50 font-medium">
                                                <TableCell colSpan={2}>Total Daily Value</TableCell>
                                                <TableCell className="text-right">
                                                    ₹{selectedSub.items.reduce((acc, item) => {
                                                        const p = products.find(prod => prod.id === item.productId);
                                                        return acc + ((p?.pricePerUnit || 0) * item.qty);
                                                    }, 0)}
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                                <div>
                                    <span className="font-semibold">Subscription ID:</span>
                                    <p className="font-mono mt-0.5">{selectedSub.id}</p>
                                </div>
                                {selectedSub.notes && (
                                    <div className="col-span-2 bg-muted/30 p-3 rounded-md border mt-2">
                                        <h4 className="font-semibold uppercase tracking-wider mb-1">Notes</h4>
                                        <p className="text-sm text-foreground">{selectedSub.notes}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
