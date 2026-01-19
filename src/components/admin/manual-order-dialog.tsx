'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp, runTransaction, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Product, User, Order } from '@/lib/types';
import { Search, Plus, Trash2, UserPlus, Calculator } from 'lucide-react';
import { settings } from '@/lib/settings';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ManualOrderDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    products: Product[];
    areas: any[]; // Using any to avoid importing Area type if not handy, but ideally strictly typed
}

export default function ManualOrderDialog({ isOpen, onOpenChange, products, areas }: ManualOrderDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Customer State
    const [phone, setPhone] = useState('');
    const [customer, setCustomer] = useState<User | null>(null);
    const [customerName, setCustomerName] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [customerArea, setCustomerArea] = useState('');
    const [deliverySlot, setDeliverySlot] = useState('');

    // Cart State
    const [cart, setCart] = useState<{ product: Product; qty: number; isCut: boolean }[]>([]);
    const [productSearch, setProductSearch] = useState('');

    // Reset form when opened
    useEffect(() => {
        if (isOpen) {
            setPhone('');
            setCustomer(null);
            setCustomerName('');
            setCustomerAddress('');
            setCustomerArea('');
            setCart([]);
            setProductSearch('');
            setDeliverySlot('');
        }
    }, [isOpen]);

    const handlePhoneSearch = async () => {
        if (!phone || phone.length < 10) return;
        setLoading(true);
        try {
            const q = query(collection(firestore, 'users'), where('phone', '==', phone));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const user = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as User;
                setCustomer(user);
                setCustomerName(user.name);
                setCustomerAddress(user.address || '');
                setCustomerArea(user.area || '');
                toast({ title: 'Customer Found', description: `Loaded details for ${user.name}` });
            } else {
                setCustomer(null);
                toast({ title: 'New Customer', description: 'Phone number not registered. Please enter details.' });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (product: Product, isCut: boolean) => {
        setCart(prev => {
            const existing = prev.find(i => i.product.id === product.id && i.isCut === isCut);
            if (existing) {
                return prev.map(i => i.product.id === product.id && i.isCut === isCut ? { ...i, qty: i.qty + 1 } : i);
            }
            return [{ product, qty: 1, isCut }, ...prev];
        });
    };

    const removeFromCart = (index: number) => {
        setCart(prev => prev.filter((_, i) => i !== index));
    };

    const updateQty = (index: number, newQty: number) => {
        if (newQty <= 0) {
            removeFromCart(index);
        } else {
            setCart(prev => prev.map((item, i) => i === index ? { ...item, qty: newQty } : item));
        }
    };

    const calculateTotal = () => {
        return cart.reduce((total, item) => {
            const itemPrice = item.product.pricePerUnit * item.qty;
            const cutCharge = item.isCut ? (item.product.cutCharge || settings.defaultCutCharge) * item.qty : 0;
            return total + itemPrice + cutCharge;
        }, 0);
    };

    // Filter products for search
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.name_te && p.name_te.includes(productSearch))
    ).slice(0, 10); // Limit to 10 suggestions

    const handlePlaceOrder = async () => {
        if (!firestore) return;

        // Basic Validation
        if (!customerName || !phone || !customerAddress || !customerArea) {
            toast({ variant: 'destructive', title: 'Missing Info', description: 'Name, Phone, Address and Area are required.' });
            return;
        }

        if (cart.length === 0) {
            toast({ variant: 'destructive', title: 'Empty Cart', description: 'Add products before placing order.' });
            return;
        }

        setLoading(true);

        try {
            // 1. Get or Create User ID (Pre-transaction)
            let userId = customer?.id;

            if (!userId) {
                const newUserRef = doc(collection(firestore, 'users'));
                userId = newUserRef.id;
                await setDoc(newUserRef, {
                    id: userId,
                    name: customerName,
                    phone: phone,
                    address: customerAddress,
                    area: customerArea,
                    role: 'customer',
                    createdAt: serverTimestamp(),
                    isManual: true
                });
            }

            // 2. Transaction: Counter + Order + Stock
            const counterRef = doc(firestore, 'orderCounters', 'main');

            const newOrderId = await runTransaction(firestore, async (transaction) => {
                // 2a. Read Counter
                const counterDoc = await transaction.get(counterRef);
                let lastId = counterDoc.exists() ? counterDoc.data().lastId || 0 : 0;
                const nextId = lastId + 1;
                const generatedId = `ORDER-${String(nextId).padStart(4, '0')}`;

                // 2b. Read Product Stocks
                const productReads = cart.map(item => ({
                    ref: doc(firestore, 'products', item.product.id),
                    qty: item.qty,
                    name: item.product.name
                }));
                const productSnapshots = await Promise.all(productReads.map(p => transaction.get(p.ref)));

                // 2c. Verify Stock
                productSnapshots.forEach((snap, index) => {
                    if (!snap.exists()) throw new Error(`Product ${productReads[index].name} not found.`);
                    const currentStock = snap.data().stock || 0;
                    if (currentStock < productReads[index].qty) {
                        throw new Error(`Insufficient stock for ${productReads[index].name}. Available: ${currentStock}`);
                    }
                });

                // 2d. Writes
                transaction.set(counterRef, { lastId: nextId }, { merge: true });

                productSnapshots.forEach((snap, index) => {
                    const newStock = (snap.data().stock || 0) - productReads[index].qty;
                    transaction.update(productReads[index].ref, { stock: newStock });
                });

                const orderData: Order = {
                    id: generatedId,
                    customerId: userId!, // We ensured userId is set above
                    name: customerName,
                    phone: phone,
                    address: customerAddress,
                    deliveryPlace: customerAddress,
                    items: cart.map(item => ({
                        productId: item.product.id,
                        qty: item.qty,
                        priceAtOrder: item.product.pricePerUnit,
                        isCut: item.isCut,
                        cutCharge: item.isCut ? (item.product.cutCharge || settings.defaultCutCharge) : 0,
                        name: item.product.name,
                        name_te: item.product.name_te,
                        unit: item.product.unit,
                    })),
                    totalAmount: calculateTotal(),
                    paymentMode: 'COD',
                    orderType: 'ONE_TIME',
                    area: customerArea,
                    deliveryDate: new Date().toISOString().split('T')[0],
                    deliverySlot: deliverySlot || 'Any Time',
                    status: 'CONFIRMED',
                    createdAt: serverTimestamp() as Timestamp,
                    agreedToTerms: true,
                    isManual: true
                };

                const orderRef = doc(firestore, 'orders', generatedId);
                transaction.set(orderRef, orderData);

                return generatedId;
            });

            toast({ title: 'Order Placed!', description: `Order #${newOrderId} created successfully.` });
            onOpenChange(false);

        } catch (error: any) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const selectedAreaObj = areas?.find(a => a.name === customerArea);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>Manual Order Entry</DialogTitle>
                    <DialogDescription>Place an order for a walk-in or phone customer.</DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Customer Details & Search */}
                    <div className="w-1/3 border-r bg-gray-50 p-6 flex flex-col gap-4 overflow-y-auto">
                        <h3 className="font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4" /> Customer Info</h3>

                        <div className="flex gap-2">
                            <Input
                                placeholder="Phone Number"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                maxLength={10}
                            />
                            <Button size="icon" variant="secondary" onClick={handlePhoneSearch} disabled={loading}>
                                <Search className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="space-y-3 mt-2">
                            <div className="grid gap-1.5">
                                <Label>Name</Label>
                                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer Name" />
                            </div>
                            <div className="grid gap-1.5">
                                <Label>Area</Label>
                                <Select value={customerArea} onValueChange={setCustomerArea}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Area" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {areas.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1.5">
                                <Label>Address</Label>
                                <Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="House No, Street..." />
                            </div>
                            <div className="grid gap-1.5">
                                <Label>Delivery Slot</Label>
                                <Select value={deliverySlot} onValueChange={setDeliverySlot} disabled={!customerArea}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Slot" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {selectedAreaObj?.defaultSlots?.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Right: Product Selection & Cart */}
                    <div className="flex-1 flex flex-col">

                        {/* Product Search */}
                        <div className="p-4 border-b bg-white">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    className="pl-9"
                                    placeholder="Search products to add..."
                                    value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)}
                                />
                            </div>

                            {/* Search Results Dropdown (Simulated) */}
                            {productSearch && (
                                <div className="absolute z-10 mt-1 w-[calc(100%-2rem)] bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    {filteredProducts.map(product => (
                                        <div key={product.id} className="p-2 hover:bg-gray-50 flex items-center justify-between cursor-pointer border-b last:border-0"
                                            onClick={() => { addToCart(product, false); setProductSearch(''); }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <img src={product.imageUrl} className="w-8 h-8 rounded object-cover" alt="" />
                                                <div>
                                                    <p className="font-medium text-sm">{product.name}</p>
                                                    <p className="text-xs text-gray-500">₹{product.pricePerUnit} / {product.unit}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); addToCart(product, false); }}>Add</Button>
                                                {product.category === 'Vegetables' && (
                                                    <Button size="sm" variant="ghost" className="text-primary" onClick={(e) => { e.stopPropagation(); addToCart(product, true); }}>Cut</Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Cart Items */}
                        <ScrollArea className="flex-1 p-4 bg-gray-50/50">
                            {cart.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-gray-400 flex-col gap-2">
                                    <Calculator className="w-12 h-12 opacity-20" />
                                    <p>Cart is empty</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {cart.map((item, idx) => (
                                        <div key={`${item.product.id}-${item.isCut}`} className="bg-white p-3 rounded-lg border flex items-center gap-3 shadow-sm">
                                            <div className="w-12 h-12 bg-gray-100 rounded flex-shrink-0 relative overflow-hidden">
                                                <img src={item.product.imageUrl} className="object-cover w-full h-full" alt="" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium truncate">{item.product.name}</p>
                                                    {item.isCut && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">CUT</span>}
                                                </div>
                                                <p className="text-sm text-gray-500">₹{item.product.pricePerUnit} {item.isCut ? `+ ₹${item.product.cutCharge || settings.defaultCutCharge}` : ''}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    className="w-16 h-8 text-center"
                                                    value={item.qty}
                                                    onChange={e => updateQty(idx, parseInt(e.target.value))}
                                                />
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => removeFromCart(idx)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>

                        {/* Footer Totals */}
                        <div className="p-4 bg-white border-t">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-lg font-bold">Total Amount</span>
                                <span className="text-2xl font-bold text-primary">₹{calculateTotal().toFixed(2)}</span>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                                <Button onClick={handlePlaceOrder} disabled={loading || cart.length === 0}>
                                    {loading ? 'Placing Order...' : 'Confirm Order'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
