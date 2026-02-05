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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Coupon } from '@/lib/types';
import {
    PlusCircle,
    Trash2,
    Edit,
    Tag,
    Clock,
    CheckCircle,
    XCircle,
    Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Checkbox } from "@/components/ui/checkbox";

interface CouponsTabProps {
    coupons: Coupon[];
    loading: boolean;
    onUpdate?: () => void;
}

export default function CouponsTab({
    coupons = [],
    loading: dataLoading,
    onUpdate
}: CouponsTabProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isDialogOpen, setDialogOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState<Partial<Coupon> | null>(null);

    const handleEditClick = (coupon: Coupon) => {
        setEditingCoupon(coupon);
        setDialogOpen(true);
    };

    const handleCreateClick = () => {
        setEditingCoupon({
            code: '',
            type: 'FLAT',
            value: 0,
            minOrderValue: 0,
            maxDiscount: 0,
            isActive: true,
            usageLimit: 100,
            usedCount: 0,
            startDate: new Date().toISOString().split('T')[0],
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            description: ''
        });
        setDialogOpen(true);
    };

    const handleDeleteCoupon = async (id: string) => {
        if (!firestore) return;
        if (!confirm('Are you sure you want to delete this coupon?')) return;

        try {
            await deleteDoc(doc(firestore, 'coupons', id));
            toast({ title: 'Deleted', description: 'Coupon deleted successfully' });
            if (onUpdate) onUpdate();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete coupon' });
        }
    };

    const handleSaveCoupon = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !editingCoupon) return;
        setLoading(true);

        const formData = new FormData(e.currentTarget as HTMLFormElement);
        const isActive = formData.get('isActive') === 'on';

        const couponData = {
            code: (formData.get('code') as string).toUpperCase(),
            type: formData.get('type') as 'FLAT' | 'PERCENTAGE',
            value: parseFloat(formData.get('value') as string) || 0,
            minOrderValue: parseFloat(formData.get('minOrderValue') as string) || 0,
            maxDiscount: parseFloat(formData.get('maxDiscount') as string) || 0,
            usageLimit: parseInt(formData.get('usageLimit') as string) || 0,
            startDate: formData.get('startDate') as string,
            expiryDate: formData.get('expiryDate') as string,
            isActive: isActive,
            description: formData.get('description') as string,
            usedCount: editingCoupon.usedCount || 0
        };

        try {
            if (editingCoupon.id) {
                await setDoc(doc(firestore, 'coupons', editingCoupon.id), couponData, { merge: true });
                toast({ title: "Coupon Updated" });
            } else {
                await addDoc(collection(firestore, 'coupons'), {
                    ...couponData,
                    createdAt: serverTimestamp()
                });
                toast({ title: "Coupon Created" });
            }
            setDialogOpen(false);
            if (onUpdate) onUpdate();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-card p-4 rounded-lg shadow-sm border">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Tag className="h-5 w-5" /> Coupons ({coupons.length})
                    </h2>
                    <p className="text-sm text-muted-foreground">Manage discount codes and offers</p>
                </div>
                <Button onClick={handleCreateClick}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Coupon
                </Button>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Code</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Min Order</TableHead>
                            <TableHead>Usage</TableHead>
                            <TableHead>Expiry</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {dataLoading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">Loading coupons...</TableCell>
                            </TableRow>
                        ) : coupons.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                    No coupons found. Create your first one.
                                </TableCell>
                            </TableRow>
                        ) : (
                            coupons.map((coupon) => (
                                <TableRow key={coupon.id} className="hover:bg-muted/5">
                                    <TableCell className="font-mono font-bold tracking-wide">
                                        {coupon.code}
                                        {coupon.description && (
                                            <div className="text-xs text-muted-foreground font-sans font-normal mt-0.5 max-w-[200px] truncate">
                                                {coupon.description}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-xs">
                                            {coupon.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-semibold">
                                            {coupon.type === 'PERCENTAGE' ? `${coupon.value}%` : `₹${coupon.value}`}
                                        </div>
                                        {coupon.type === 'PERCENTAGE' && coupon.maxDiscount > 0 && (
                                            <div className="text-xs text-muted-foreground">
                                                Max ₹{coupon.maxDiscount}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {coupon.minOrderValue > 0 ? `₹${coupon.minOrderValue}` : 'None'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <span>{coupon.usedCount || 0}</span>
                                            <span className="text-muted-foreground">/ {coupon.usageLimit > 0 ? coupon.usageLimit : '∞'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col text-sm">
                                            <span className={new Date(coupon.expiryDate) < new Date() ? "text-destructive" : ""}>
                                                {format(new Date(coupon.expiryDate), 'MMM d, yyyy')}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {coupon.isActive ? (
                                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none">Active</Badge>
                                        ) : (
                                            <Badge variant="secondary">Inactive</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditClick(coupon)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteCoupon(coupon.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingCoupon?.id ? 'Edit Coupon' : 'Create New Coupon'}</DialogTitle>
                        <DialogDescription>
                            Configure discount rules and validity for this coupon.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveCoupon} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="code">Coupon Code</Label>
                                <Input
                                    id="code"
                                    name="code"
                                    defaultValue={editingCoupon?.code}
                                    placeholder="SUMMER50"
                                    required
                                    className="uppercase font-mono"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">Type</Label>
                                <Select name="type" defaultValue={editingCoupon?.type || 'FLAT'}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="FLAT">Flat Amount (₹)</SelectItem>
                                        <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="value">Discount Value</Label>
                                <Input
                                    id="value"
                                    name="value"
                                    type="number"
                                    defaultValue={editingCoupon?.value}
                                    required
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="minOrderValue">Min Order Value (₹)</Label>
                                <Input
                                    id="minOrderValue"
                                    name="minOrderValue"
                                    type="number"
                                    defaultValue={editingCoupon?.minOrderValue}
                                    min="0"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="maxDiscount">Max Discount (for %)</Label>
                                <Input
                                    id="maxDiscount"
                                    name="maxDiscount"
                                    type="number"
                                    defaultValue={editingCoupon?.maxDiscount}
                                    placeholder="Leave 0 for no limit"
                                    min="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="usageLimit">Usage Limit (Total)</Label>
                                <Input
                                    id="usageLimit"
                                    name="usageLimit"
                                    type="number"
                                    defaultValue={editingCoupon?.usageLimit}
                                    placeholder="0 for unlimited"
                                    min="0"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="startDate">Start Date</Label>
                                <Input
                                    id="startDate"
                                    name="startDate"
                                    type="date"
                                    defaultValue={editingCoupon?.startDate}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="expiryDate">Expiry Date</Label>
                                <Input
                                    id="expiryDate"
                                    name="expiryDate"
                                    type="date"
                                    defaultValue={editingCoupon?.expiryDate}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Input
                                id="description"
                                name="description"
                                defaultValue={editingCoupon?.description}
                                placeholder="e.g. Flat ₹50 off on orders above ₹500"
                            />
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                            <Checkbox id="isActive" name="isActive" defaultChecked={editingCoupon?.isActive} />
                            <Label htmlFor="isActive" className="cursor-pointer">Active - Allow customers to use this coupon</Label>
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editingCoupon?.id ? 'Update Coupon' : 'Create Coupon'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
