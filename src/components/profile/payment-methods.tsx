'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CreditCard, Plus, Trash2, Star, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import type { User, PaymentMethod } from '@/lib/types';

interface PaymentMethodsProps {
    user: User;
}

export default function PaymentMethods({ user }: PaymentMethodsProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isAddDialogOpen, setAddDialogOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Fetch Payment Methods
    const { data: methods } = useCollection<PaymentMethod>(`users/${user.id}/paymentMethods`);

    // Form State
    const [newMethod, setNewMethod] = useState<{
        type: 'card' | 'upi';
        brand?: string;
        last4?: string;
        upiId?: string;
    }>({
        type: 'upi',
        upiId: '',
    });

    const handleSetDefault = async (id: string, currentMethods: PaymentMethod[] = []) => {
        const batch = writeBatch(firestore);

        // Disable current default
        const currentDefault = currentMethods.find(m => m.isDefault);
        if (currentDefault) {
            batch.update(doc(firestore, `users/${user.id}/paymentMethods`, currentDefault.id), { isDefault: false });
        }

        // Enable new default
        batch.update(doc(firestore, `users/${user.id}/paymentMethods`, id), { isDefault: true });

        try {
            await batch.commit();
            toast({
                title: 'Default Updated',
                description: 'Default payment method changed successfully.',
            });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update default method.' });
        }
    };

    const handleRemove = async (id: string) => {
        if (!confirm('Remove this payment method?')) return;
        try {
            await deleteDoc(doc(firestore, `users/${user.id}/paymentMethods`, id));
            toast({ title: 'Removed', description: 'Payment method removed successfully.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to remove payment method.' });
        }
    };

    const handleAddMethod = async () => {
        if (newMethod.type === 'upi' && !newMethod.upiId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter UPI ID' });
            return;
        }
        if (newMethod.type === 'card' && (!newMethod.last4 || !newMethod.brand)) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter card details' });
            return;
        }

        setLoading(true);
        try {
            await addDoc(collection(firestore, `users/${user.id}/paymentMethods`), {
                ...newMethod,
                isDefault: (methods?.length || 0) === 0 // Make default if first one
            });
            setAddDialogOpen(false);
            setNewMethod({ type: 'upi', upiId: '' }); // Reset
            toast({ title: 'Success', description: 'Payment method added successfully.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to add payment method.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Methods
                </CardTitle>
                <CardDescription>Manage your saved payment methods (Simulated)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Payment Methods List */}
                <div className="space-y-3">
                    {methods?.map((method) => (
                        <div
                            key={method.id}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    {method.type === 'upi' ? <Smartphone className="h-5 w-5 text-primary" /> : <CreditCard className="h-5 w-5 text-primary" />}
                                </div>
                                <div>
                                    {method.type === 'card' ? (
                                        <>
                                            <p className="font-medium">{method.brand} •••• {method.last4}</p>
                                            <p className="text-xs text-muted-foreground">Credit/Debit Card</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="font-medium">{method.upiId}</p>
                                            <p className="text-xs text-muted-foreground">UPI</p>
                                        </>
                                    )}
                                </div>
                                {method.isDefault && (
                                    <Badge variant="secondary" className="ml-2">
                                        <Star className="h-3 w-3 mr-1 fill-current" />
                                        Default
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {!method.isDefault && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleSetDefault(method.id, methods || [])}
                                    >
                                        Set Default
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRemove(method.id)}
                                    disabled={method.isDefault}
                                >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        </div>
                    ))}

                    {(!methods || methods.length === 0) && (
                        <p className="text-center text-muted-foreground py-4">No saved payment methods.</p>
                    )}
                </div>

                {/* Add New Button */}
                <Dialog open={isAddDialogOpen} onOpenChange={setAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="w-full">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Payment Method
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Payment Method</DialogTitle>
                            <DialogDescription>Save a card or UPI ID for faster checkout.</DialogDescription>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            <RadioGroup
                                defaultValue="upi"
                                value={newMethod.type}
                                onValueChange={(v: 'card' | 'upi') => setNewMethod({ type: v, upiId: '', brand: '', last4: '' })}
                                className="flex gap-4 mb-4"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="upi" id="upi" />
                                    <Label htmlFor="upi">UPI ID</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="card" id="card" />
                                    <Label htmlFor="card">Card (Simulated)</Label>
                                </div>
                            </RadioGroup>

                            {newMethod.type === 'upi' ? (
                                <div className="space-y-2">
                                    <Label>UPI ID</Label>
                                    <Input
                                        placeholder="username@okicici"
                                        value={newMethod.upiId}
                                        onChange={(e) => setNewMethod({ ...newMethod, upiId: e.target.value })}
                                    />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Brand</Label>
                                        <Input
                                            placeholder="Visa/Mastercard"
                                            value={newMethod.brand}
                                            onChange={(e) => setNewMethod({ ...newMethod, brand: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Last 4 Digits</Label>
                                        <Input
                                            placeholder="1234"
                                            maxLength={4}
                                            value={newMethod.last4}
                                            onChange={(e) => setNewMethod({ ...newMethod, last4: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleAddMethod} disabled={loading}>{loading ? 'Saving...' : 'Save Method'}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Info */}
                <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                        🔒 Your payment information is securely encrypted and stored. We never share your payment details.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
