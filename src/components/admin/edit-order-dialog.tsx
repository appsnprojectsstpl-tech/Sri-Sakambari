'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFirestore } from '@/firebase';
import { doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Product, Order, OrderItem } from '@/lib/types';
import { Trash2 } from 'lucide-react';
import { settings } from '@/lib/settings';

interface EditOrderDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    order: Order;
    products: Product[];
    onOrderUpdated: () => void;
}

export default function EditOrderDialog({ isOpen, onOpenChange, order, products, onOrderUpdated }: EditOrderDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<OrderItem[]>(order.items);
    const [productSearch, setProductSearch] = useState('');

    const calculateTotal = (currentItems: OrderItem[]) => {
        return currentItems.reduce((acc, item) => {
            return acc + (item.priceAtOrder * item.qty) + (item.cutCharge || 0);
        }, 0);
    };

    const handleAddItem = (product: Product) => {
        setItems(prev => {
            const existing = prev.find(i => i.productId === product.id && i.isCut === false);
            if (existing) {
                return prev.map(i => i.productId === product.id && i.isCut === false ? { ...i, qty: i.qty + 1 } : i);
            }
            return [...prev, {
                productId: product.id,
                qty: 1,
                priceAtOrder: product.pricePerUnit,
                isCut: false,
                cutCharge: 0,
                name: product.name,
                name_te: product.name_te,
                unit: product.unit
            }];
        });
        setProductSearch('');
    };

    const handleUpdateQty = (idx: number, newQty: number) => {
        if (newQty < 0) return;
        setItems(prev => {
            const newItems = [...prev];
            if (newQty === 0) {
                newItems.splice(idx, 1);
            } else {
                newItems[idx].qty = newQty;
            }
            return newItems;
        });
    };

    const handleSave = async () => {
        if (!firestore) return;
        setLoading(true);
        try {
            const newTotal = calculateTotal(items);
            await updateDoc(doc(firestore, 'orders', order.id), {
                items: items,
                totalAmount: newTotal,
                updatedAt: serverTimestamp()
            });

            toast({ title: 'Order Updated', description: `New Total: ₹${newTotal.toFixed(2)}` });
            onOrderUpdated();
            onOpenChange(false);
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase())
    ).slice(0, 5);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Edit Order #{order.id}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Add Item Search */}
                    <div className="relative">
                        <Input
                            placeholder="Search to add product..."
                            value={productSearch}
                            onChange={e => setProductSearch(e.target.value)}
                        />
                        {productSearch && (
                            <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                                {filteredProducts.map(product => (
                                    <div key={product.id} className="p-2 hover:bg-gray-50 flex justify-between cursor-pointer"
                                        onClick={() => handleAddItem(product)}
                                    >
                                        <span>{product.name}</span>
                                        <span className="text-sm text-gray-500">₹{product.pricePerUnit}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Order Items List */}
                    <div className="border rounded-md p-2 max-h-[40vh] overflow-y-auto space-y-2 bg-gray-50">
                        {items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white p-2 rounded shadow-sm">
                                <div className="flex-1">
                                    <p className="font-medium text-sm">{item.name || 'Unknown'}</p>
                                    <p className="text-xs text-gray-500">₹{item.priceAtOrder} x {item.qty}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm bg-gray-100 px-2 py-1 rounded">x {item.qty}</span>
                                    <Button size="icon" variant="ghost" className="text-red-500 h-8 w-8" onClick={() => handleUpdateQty(idx, 0)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between items-center font-bold text-lg">
                        <span>New Total:</span>
                        <span>₹{calculateTotal(items).toFixed(2)}</span>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={loading}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
