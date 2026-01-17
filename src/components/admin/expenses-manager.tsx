'use client';

import { useState, useEffect } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, query, where, orderBy, deleteDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Product } from '@/lib/types';
import { Trash2, TrendingDown, TrendingUp, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

const EXPENSE_TYPES = ['Petrol', 'Vehicle Maintenance', 'Packaging Material', 'Rent', 'Electricity', 'Staff Salary', 'Tea/Snacks', 'Other'];

export default function ExpensesManager({ products }: { products: Product[] }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Form States
    const [expenseType, setExpenseType] = useState('');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [wastageProduct, setWastageProduct] = useState('');
    const [wastageQty, setWastageQty] = useState('');
    const [wastageUnit, setWastageUnit] = useState('kg');

    // Fetch Expenses
    const { data: expenses } = useCollection<any>('expenses', {
        constraints: [['orderBy', 'createdAt', 'desc'] as any, ['limit', 50] as any]
    });

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore) return;
        setLoading(true);
        try {
            await addDoc(collection(firestore, 'expenses'), {
                type: 'EXPENSE',
                category: expenseType,
                amount: parseFloat(amount),
                note,
                createdAt: serverTimestamp(),
                date: new Date().toISOString().split('T')[0]
            });
            toast({ title: 'Expense Logged' });
            setAmount('');
            setNote('');
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleAddWastage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore) return;
        setLoading(true);
        try {
            const product = products.find(p => p.id === wastageProduct);
            const value = product ? product.pricePerUnit * parseFloat(wastageQty) : 0;

            await addDoc(collection(firestore, 'expenses'), {
                type: 'WASTAGE',
                category: 'Product Wastage',
                productName: product?.name || 'Unknown',
                productId: wastageProduct,
                qty: parseFloat(wastageQty),
                unit: wastageUnit,
                amount: value, // Estimated loss value
                note: note || 'Spoiled/Damaged',
                createdAt: serverTimestamp(),
                date: new Date().toISOString().split('T')[0]
            });
            toast({ title: 'Wastage Logged' });
            setWastageQty('');
            setNote('');
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore || !confirm('Delete this entry?')) return;
        await deleteDoc(doc(firestore, 'expenses', id));
    };

    const totalExpenses = expenses?.filter(e => e.type === 'EXPENSE').reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0;
    const totalWastage = expenses?.filter(e => e.type === 'WASTAGE').reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses (Last 50)</CardTitle>
                        <CardDescription className="text-2xl font-bold text-gray-900">₹{totalExpenses.toFixed(2)}</CardDescription>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Est. Wastage Value</CardTitle>
                        <CardDescription className="text-2xl font-bold text-red-600">₹{totalWastage.toFixed(2)}</CardDescription>
                    </CardHeader>
                </Card>
            </div>

            <Tabs defaultValue="expenses">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="expenses">Shop Expenses</TabsTrigger>
                    <TabsTrigger value="wastage">Product Wastage</TabsTrigger>
                </TabsList>

                {/* Expenses Tab */}
                <TabsContent value="expenses" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Log New Expense</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleAddExpense} className="flex flex-col sm:flex-row gap-4 items-end">
                                <div className="grid gap-2 flex-1">
                                    <Label>Type</Label>
                                    <Select value={expenseType} onValueChange={setExpenseType} required>
                                        <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                                        <SelectContent>
                                            {EXPENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2 w-32">
                                    <Label>Amount (₹)</Label>
                                    <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required />
                                </div>
                                <div className="grid gap-2 flex-1">
                                    <Label>Note (Optional)</Label>
                                    <Input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Pump at Vidyanagar" />
                                </div>
                                <Button type="submit" disabled={loading}>Add</Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Note</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {expenses?.filter(e => e.type === 'EXPENSE').map(expense => (
                                    <TableRow key={expense.id}>
                                        <TableCell>{expense.date}</TableCell>
                                        <TableCell>{expense.category}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{expense.note}</TableCell>
                                        <TableCell className="text-right font-medium">₹{expense.amount}</TableCell>
                                        <TableCell>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => handleDelete(expense.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                {/* Wastage Tab */}
                <TabsContent value="wastage" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Log Wastage</CardTitle>
                            <CardDescription>Track spoiled or damaged stock.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleAddWastage} className="flex flex-col sm:flex-row gap-4 items-end">
                                <div className="grid gap-2 flex-1">
                                    <Label>Product</Label>
                                    <Select value={wastageProduct} onValueChange={setWastageProduct} required>
                                        <SelectTrigger><SelectValue placeholder="Select Product" /></SelectTrigger>
                                        <SelectContent>
                                            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2 w-32">
                                    <Label>Qty</Label>
                                    <Input type="number" value={wastageQty} onChange={e => setWastageQty(e.target.value)} required />
                                </div>
                                <div className="grid gap-2 w-24">
                                    <Label>Unit</Label>
                                    <Select value={wastageUnit} onValueChange={setWastageUnit}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="kg">kg</SelectItem>
                                            <SelectItem value="gm">gm</SelectItem>
                                            <SelectItem value="pcs">pcs</SelectItem>
                                            <SelectItem value="liter">liter</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2 flex-1">
                                    <Label>Reason</Label>
                                    <Input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Rotten / Crushed" />
                                </div>
                                <Button type="submit" variant="destructive" disabled={loading}>Log Loss</Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Qty</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead className="text-right">Est. Value</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {expenses?.filter(e => e.type === 'WASTAGE').map(expense => (
                                    <TableRow key={expense.id}>
                                        <TableCell>{expense.date}</TableCell>
                                        <TableCell className="font-medium">{expense.productName}</TableCell>
                                        <TableCell>{expense.qty} {expense.unit}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{expense.note}</TableCell>
                                        <TableCell className="text-right text-red-600">₹{expense.amount.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => handleDelete(expense.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
