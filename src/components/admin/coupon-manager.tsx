'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, Tag } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Coupon } from '@/lib/types';
import { format } from 'date-fns';

export default function CouponManager() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isAddDialogOpen, setAddDialogOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Fetch Coupons
    const { data: coupons } = useCollection<Coupon>('coupons');

    // Form State
    const [newCoupon, setNewCoupon] = useState<Partial<Coupon>>({
        code: '',
        type: 'PERCENTAGE',
        value: 0,
        minOrderValue: 0,
        isActive: true,
        startDate: new Date().toISOString().split('T')[0],
        expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    });

    const handleAddCoupon = async () => {
        if (!newCoupon.code || !newCoupon.value) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please fill all required fields' });
            return;
        }

        setLoading(true);
        try {
            await addDoc(collection(firestore, 'coupons'), {
                ...newCoupon,
                code: newCoupon.code.toUpperCase(),
                usedCount: 0,
                createdAt: serverTimestamp(),
            });

            toast({ title: 'Success', description: 'Coupon created successfully' });
            setAddDialogOpen(false);
            // Reset form
            setNewCoupon({
                code: '',
                type: 'PERCENTAGE',
                value: 0,
                minOrderValue: 0,
                isActive: true,
                startDate: new Date().toISOString().split('T')[0],
                expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
            });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to create coupon' });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCoupon = async (id: string) => {
        if (!confirm('Are you sure you want to delete this coupon?')) return;

        try {
            await deleteDoc(doc(firestore, 'coupons', id));
            toast({ title: 'Deleted', description: 'Coupon deleted successfully' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete coupon' });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Coupon Management</CardTitle>
                <CardDescription>Create and manage discount coupons for customers</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex justify-end mb-4">
                    <Dialog open={isAddDialogOpen} onOpenChange={setAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add New Coupon
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add New Coupon</DialogTitle>
                                <DialogDescription>Create a new discount code for your customers.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="code">Coupon Code</Label>
                                        <Input
                                            id="code"
                                            placeholder="e.g. SAVE20"
                                            value={newCoupon.code}
                                            onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="type">Type</Label>
                                        <Select
                                            value={newCoupon.type}
                                            onValueChange={(val: 'PERCENTAGE' | 'FLAT') => setNewCoupon({ ...newCoupon, type: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                                                <SelectItem value="FLAT">Flat Amount (₹)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="value">Value {newCoupon.type === 'PERCENTAGE' ? '(%)' : '(₹)'}</Label>
                                        <Input
                                            id="value"
                                            type="number"
                                            value={newCoupon.value}
                                            onChange={(e) => setNewCoupon({ ...newCoupon, value: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="minOrder">Min Order Value (₹)</Label>
                                        <Input
                                            id="minOrder"
                                            type="number"
                                            value={newCoupon.minOrderValue}
                                            onChange={(e) => setNewCoupon({ ...newCoupon, minOrderValue: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="expiry">Expiry Date</Label>
                                        <Input
                                            id="expiry"
                                            type="date"
                                            value={newCoupon.expiryDate}
                                            onChange={(e) => setNewCoupon({ ...newCoupon, expiryDate: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleAddCoupon} disabled={loading}>{loading ? 'Creating...' : 'Create Coupon'}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Code</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Value</TableHead>
                                <TableHead>Min Order</TableHead>
                                <TableHead>Used</TableHead>
                                <TableHead>Expiry</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {coupons?.map((coupon) => (
                                <TableRow key={coupon.id}>
                                    <TableCell className="font-mono font-bold">{coupon.code}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{coupon.type}</Badge>
                                    </TableCell>
                                    <TableCell>{coupon.type === 'PERCENTAGE' ? `${coupon.value}%` : `₹${coupon.value}`}</TableCell>
                                    <TableCell>₹{coupon.minOrderValue}</TableCell>
                                    <TableCell>{coupon.usedCount || 0}</TableCell>
                                    <TableCell>{format(new Date(coupon.expiryDate), 'MMM d, yyyy')}</TableCell>
                                    <TableCell>
                                        <Badge variant={coupon.isActive ? 'outline' : 'secondary'} className={coupon.isActive ? "bg-green-50 text-green-700 border-green-200" : ""}>
                                            {coupon.isActive ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Button size="sm" variant="ghost" className="text-destructive h-8 w-8 p-0" onClick={() => handleDeleteCoupon(coupon.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {(!coupons || coupons.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                        No coupons found. Create your first coupon!
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
