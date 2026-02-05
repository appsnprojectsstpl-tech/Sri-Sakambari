'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { t, getProductName } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { doc, serverTimestamp, runTransaction, collection, Timestamp, query, where, getDocs, writeBatch } from 'firebase/firestore';
import type { CartItem, Area, Order, Product } from '@/lib/types';
import { Trash2, MessageSquare, Printer, Slice, Plus, Minus, ArrowLeft } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { settings } from '@/lib/settings';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { generateSalesOrderPDF } from '@/lib/pdf-utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Confetti } from '@/components/confetti';
import { safeLocalStorage, logger } from '@/lib/logger';
import dynamic from 'next/dynamic';

const AddressManager = dynamic(() => import('@/components/address-manager'), { ssr: false });

export default function CartPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { language } = useLanguage();
    const { data: areas } = useCollection<Area>('areas');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCheckoutOpen, setCheckoutOpen] = useState(false);
    const [isOrderSuccessOpen, setOrderSuccessOpen] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const { toast } = useToast();
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [whatsappUrl, setWhatsappUrl] = useState('');
    const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);
    const [lastPlacedOrderProducts, setLastPlacedOrderProducts] = useState<Product[]>([]);

    // Delivery Info State
    const [deliveryInfo, setDeliveryInfo] = useState({
        name: '',
        phone: '',
        address: '',
        deliveryPlace: '',
        area: '',
        pincode: ''
    });
    const [useDifferentDelivery, setUseDifferentDelivery] = useState(false);

    // Load Cart from LocalStorage
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const savedCart = safeLocalStorage.getItem('cart');
        if (savedCart) {
            try {
                setCart(JSON.parse(savedCart));
            } catch (e) {
                logger.error('Failed to parse cart', e);
                setCart([]);
            }
        }
        setIsInitialized(true);
    }, []);

    // Sync Cart to LocalStorage
    useEffect(() => {
        if (!isInitialized) return;

        if (cart.length > 0) {
            safeLocalStorage.setItem('cart', JSON.stringify(cart));
        } else {
            // Only clear if initialized and empty
            safeLocalStorage.removeItem('cart');
        }
    }, [cart, isInitialized]);

    // Auto-fill User Info
    useEffect(() => {
        if (user) {
            setDeliveryInfo({
                name: user.name || '',
                phone: user.phone || '',
                address: user.address || '',
                deliveryPlace: user.address || '',
                area: user.area || '',
                pincode: ''
            });
        }
    }, [user]);

    // Cart Actions
    const updateCartQuantity = (productId: string, isCut: boolean, quantity: number) => {
        setCart((prevCart) => {
            if (quantity <= 0) {
                return prevCart.filter(
                    (item) => !(item.product.id === productId && item.isCut === isCut)
                );
            }
            return prevCart.map((item) =>
                item.product.id === productId && item.isCut === isCut
                    ? { ...item, quantity }
                    : item
            );
        });
    };

    const clearCart = () => {
        setCart([]);
        safeLocalStorage.removeItem('cart');
    };

    // Calculations
    const cartTotal = useMemo(() => {
        return cart.reduce((total, item) => {
            const rawPrice = Number(item.product.pricePerUnit);
            const price = isNaN(rawPrice) ? 0 : rawPrice;
            const rawQty = Number(item.quantity);
            const quantity = isNaN(rawQty) ? 0 : rawQty;
            let cutCharge = 0;
            if (item.isCut) {
                const rawCut = Number(item.product.cutCharge);
                cutCharge = isNaN(rawCut) ? 10 : rawCut;
            }
            return total + (price * quantity) + (cutCharge * quantity);
        }, 0);
    }, [cart]);

    const finalTotal = cartTotal; // Already sanitized in useMemo logic above basically, but let's be safe
    const isMinOrderMet = finalTotal >= settings.minOrderValue;
    const FREE_DELIVERY_THRESHOLD = 100;
    const progressPercentage = Math.min((finalTotal / FREE_DELIVERY_THRESHOLD) * 100, 100);

    // Checkout Logic
    const handlePlaceOrder = async () => {
        if (!user || !firestore) {
            toast({ variant: "destructive", title: 'Authentication Error', description: 'You must be logged in.' });
            router.push('/login');
            return;
        }

        const requiredFields = ['name', 'phone', 'address', 'area'];
        if (useDifferentDelivery) requiredFields.push('deliveryPlace');

        for (const field of requiredFields) {
            if (!deliveryInfo[field as keyof typeof deliveryInfo]) {
                toast({ variant: "destructive", title: 'Missing Information', description: `Missing: ${field}` });
                return;
            }
        }

        if (!agreedToTerms) {
            toast({ variant: 'destructive', title: 'Terms & Conditions', description: 'Please agree to terms.' });
            return;
        }

        if (!isMinOrderMet) {
            toast({ variant: 'destructive', title: 'Minimum Order', description: `Minimum order is ${settings.minOrderValue}.` });
            return;
        }

        setIsPlacingOrder(true);

        try {
            const counterRef = doc(firestore, 'orderCounters', 'main');
            const { newOrderId } = await runTransaction(firestore, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                let lastId = 0;
                if (counterDoc.exists()) lastId = counterDoc.data()?.lastId || 0;
                const nextId = lastId + 1;
                const generatedId = `ORDER-${String(nextId).padStart(4, '0')}`;

                const productReads = cart.map(item => ({
                    ref: doc(firestore, 'products', item.product.id),
                    qty: item.quantity,
                    name: item.product.name
                }));
                const productSnapshots = await Promise.all(productReads.map(p => transaction.get(p.ref)));

                productSnapshots.forEach((snap, index) => {
                    if (!snap.exists()) throw new Error(`Product ${productReads[index].name} not found.`);
                    const currentStock = snap.data().stockQuantity || 0;
                    if (currentStock < productReads[index].qty) {
                        throw new Error(`Insufficient stock for ${productReads[index].name}.`);
                    }
                });

                transaction.set(counterRef, { lastId: nextId }, { merge: true });

                productSnapshots.forEach((snap, index) => {
                    const newStock = (snap.data().stockQuantity || 0) - productReads[index].qty;
                    transaction.update(productReads[index].ref, { stockQuantity: newStock });
                });

                const orderRef = doc(firestore, 'orders', generatedId);
                const newOrderData: Order = {
                    id: generatedId,
                    customerId: user.id,
                    name: deliveryInfo.name,
                    phone: deliveryInfo.phone,
                    address: deliveryInfo.address,
                    deliveryPlace: useDifferentDelivery ? deliveryInfo.deliveryPlace : deliveryInfo.address,
                    items: cart.map(item => ({
                        productId: item.product.id,
                        qty: item.quantity,
                        priceAtOrder: item.product.pricePerUnit,
                        isCut: item.isCut,
                        cutCharge: item.isCut ? (item.product.cutCharge || 0) : 0,
                        name: item.product.name,
                        name_te: item.product.name_te,
                        unit: item.product.unit,
                    })),
                    totalAmount: finalTotal,
                    paymentMode: 'COD',
                    orderType: 'ONE_TIME',
                    area: deliveryInfo.area,
                    deliveryDate: new Date().toISOString().split('T')[0],
                    status: 'PENDING',
                    createdAt: serverTimestamp() as Timestamp,
                    agreedToTerms: true,
                    deliverySlot: ''
                };
                transaction.set(orderRef, newOrderData);
                return { newOrderId: generatedId };
            });

            // Set Local Last Order
            const orderPayload: Order = {
                id: newOrderId,
                customerId: user.id,
                name: deliveryInfo.name,
                phone: deliveryInfo.phone,
                address: deliveryInfo.address,
                deliveryPlace: useDifferentDelivery ? deliveryInfo.deliveryPlace : deliveryInfo.address,
                items: cart.map(item => ({
                    productId: item.product.id,
                    qty: item.quantity,
                    priceAtOrder: item.product.pricePerUnit,
                    isCut: item.isCut,
                    cutCharge: item.isCut ? (item.product.cutCharge || 0) : 0,
                    name: item.product.name,
                    name_te: item.product.name_te,
                    unit: item.product.unit,
                })),
                totalAmount: finalTotal,
                paymentMode: 'COD',
                orderType: 'ONE_TIME',
                area: deliveryInfo.area,
                deliveryDate: new Date().toISOString().split('T')[0],
                status: 'PENDING',
                createdAt: Timestamp.now(),
                agreedToTerms: true,
                deliverySlot: ''
            };

            setLastPlacedOrder(orderPayload);
            setLastPlacedOrderProducts(cart.map(item => item.product));

            // Notify Admins
            const adminsSnapshot = await getDocs(query(collection(firestore, 'users'), where('role', '==', 'admin')));
            const batch = writeBatch(firestore);
            adminsSnapshot.docs.forEach(d => {
                const notifRef = doc(collection(firestore, 'notifications'));
                batch.set(notifRef, {
                    userId: d.id,
                    title: 'New Order Received',
                    message: `Order #${newOrderId} placed by ${user.name} for ₹${finalTotal}`,
                    isRead: false,
                    createdAt: serverTimestamp(),
                    type: 'order',
                    linkId: newOrderId
                });
            });
            await batch.commit().catch(e => console.error("Admin Notify Error", e));

            // WhatsApp Link
            const message = t('whatsappOrderConfirmation', language).replace('{ORDER_ID}', newOrderId);
            setWhatsappUrl(`https://wa.me/${settings.ownerPhone}?text=${encodeURIComponent(message)}`);

            setCheckoutOpen(false);
            clearCart();
            setOrderSuccessOpen(true);
            toast({ title: 'Order Placed!', description: 'Thank you for your purchase.' });

        } catch (error: any) {
            toast({ variant: "destructive", title: 'Order Failed', description: error.message });
        } finally {
            setIsPlacingOrder(false);
        }
    };

    const handlePrintOrder = () => {
        if (lastPlacedOrder && lastPlacedOrderProducts.length > 0) {
            generateSalesOrderPDF(lastPlacedOrder, lastPlacedOrderProducts, language);
        }
    };

    const handleProceed = () => {
        if (!user) {
            router.push('/login');
            return;
        }
        setCheckoutOpen(true);
    };

    const termsAndConditions = [
        "once material delivered will not be returned back",
        `min order value - ${settings.minOrderValue}/-`,
        "delivery charges will be free within 3 kms surrounding New Nallakunta",
        "more than 3 kms surrounding New Nallakunta, delivery charges will be extra"
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
            {/* Simple Header for Cart Page */}
            <div className="sticky top-0 z-50 bg-white border-b shadow-sm px-4 h-16 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10">
                    <ArrowLeft className="w-6 h-6" />
                </Button>
                <h1 className="text-xl font-headline font-bold text-gray-900">{t('yourCart', language)}</h1>
            </div>

            <div className="flex-1 container max-w-2xl mx-auto p-4 space-y-4">
                {/* Progress/Free Delivery Nudge */}
                {cart.length > 0 && (
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-2">
                        <div className="flex justify-between text-xs font-semibold">
                            <span className={finalTotal >= FREE_DELIVERY_THRESHOLD ? 'text-primary' : 'text-muted-foreground'}>
                                {finalTotal >= FREE_DELIVERY_THRESHOLD
                                    ? 'Free Delivery Unlocked!'
                                    : `Add ₹${(FREE_DELIVERY_THRESHOLD - finalTotal).toFixed(0)} for Free Delivery`}
                            </span>
                            <span>{Math.round(progressPercentage)}%</span>
                        </div>
                        <Progress value={progressPercentage} className="h-2" />
                    </div>
                )}

// Cart Items
                {cart.length > 0 ? (
                    <div className="space-y-3">
                        <AnimatePresence mode="popLayout">
                            {cart.map((item) => (
                                <div key={`${item.product.id}-${item.isCut}`} className="relative group">
                                    {/* Swipe Background Layer - Behind Content */}
                                    <div className="absolute inset-0 bg-destructive/10 rounded-xl flex items-center justify-end pr-6 z-0">
                                        <Trash2 className="text-destructive h-6 w-6" />
                                    </div>

                                    {/* Draggable Foreground Layer */}
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0, x: 0 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="relative z-10 flex items-center gap-4 bg-white p-3 rounded-xl shadow-sm border border-gray-100 overflow-hidden touch-pan-y"
                                        drag="x"
                                        dragConstraints={{ left: -100, right: 0 }}
                                        dragElastic={0.1}
                                        style={{ touchAction: 'pan-y' }}
                                        onDragEnd={(_, info) => {
                                            if (info.offset.x < -60) {
                                                updateCartQuantity(item.product.id, item.isCut, 0);
                                            }
                                        }}
                                        whileDrag={{ scale: 0.98 }}
                                    >
                                        <div className="relative h-16 w-16 rounded-lg overflow-hidden shrink-0 bg-gray-50 border border-gray-100">
                                            <Image
                                                src={item.product.imageUrl || `https://picsum.photos/seed/${item.product.id}/100/100`}
                                                alt={item.product.name}
                                                fill
                                                className="object-cover"
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{getProductName(item.product, language)}</h4>
                                                {item.isCut && <Badge variant="outline" className="flex items-center gap-1 h-5 text-[10px] px-1 border-primary/30 text-primary bg-primary/5"><Slice className="h-3 w-3" />Cut</Badge>}
                                            </div>
                                            <p className="text-sm font-bold text-gray-900 mt-1">
                                                ₹{item.product.pricePerUnit}
                                                {item.isCut && <span className="text-muted-foreground font-normal text-xs ml-1">(+₹{item.product.cutCharge || settings.defaultCutCharge} cut)</span>}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8 rounded-full border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-colors"
                                                onClick={() => updateCartQuantity(item.product.id, item.isCut, Math.max(0, item.quantity - 1))}
                                            >
                                                <Minus className="h-4 w-4" strokeWidth={2.5} />
                                            </Button>
                                            <div className="w-6 flex items-center justify-center text-sm font-bold text-gray-900">
                                                {item.quantity}
                                            </div>
                                            <Button
                                                size="icon"
                                                className="h-8 w-8 rounded-full bg-primary text-white shadow-sm hover:bg-primary/90"
                                                onClick={() => updateCartQuantity(item.product.id, item.isCut, item.quantity + 1)}
                                            >
                                                <Plus className="h-4 w-4" strokeWidth={2.5} />
                                            </Button>
                                        </div>
                                    </motion.div>
                                </div>
                            ))}
                        </AnimatePresence>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="relative w-48 h-48 mb-6 opacity-80">
                            <Image
                                src="https://illustrations.popsy.co/amber/box.svg"
                                alt="Empty Box"
                                fill
                                className="object-contain"
                            />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">{t('cartEmpty', language)}</h3>
                        <p className="text-muted-foreground mb-8">{t('cartEmptyHint', language)}</p>
                        <Button onClick={() => router.push('/dashboard')} size="lg" className="rounded-full px-8">
                            Start Shopping
                        </Button>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 pb-8 z-40 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                    <div className="container max-w-2xl mx-auto space-y-3">
                        <div className="flex justify-between items-center text-lg font-bold">
                            <span className="text-gray-900">{t('total', language)}</span>
                            <span className="font-sans text-xl text-primary font-extrabold">&#8377;{finalTotal.toFixed(2)}</span>
                        </div>
                        {!isMinOrderMet && (
                            <p className="text-center text-sm text-destructive font-medium bg-destructive/10 p-1 rounded">
                                Minimum order: &#8377;{settings.minOrderValue}
                            </p>
                        )}
                        <Button className="w-full h-12 text-lg shadow-lg" size="lg" onClick={handleProceed} disabled={!isMinOrderMet}>
                            {t('proceedToCheckout', language)}
                        </Button>
                        <div className="relative flex items-center py-1">
                            <div className="flex-grow border-t border-muted"></div>
                            <span className="flex-shrink-0 mx-4 text-xs text-muted-foreground">OR</span>
                            <div className="flex-grow border-t border-muted"></div>
                        </div>
                        <Button
                            className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white shadow-lg"
                            size="lg"
                            onClick={() => {
                                const itemsList = cart.map(item =>
                                    `- ${getProductName(item.product, language)} (${item.product.unit}) x ${item.quantity} ${item.isCut ? '(Cut)' : ''}`
                                ).join('\n');
                                const text = `Hello, I want to order:\n\n${itemsList}\n\nTotal approx: ₹${finalTotal.toFixed(2)}`;
                                window.open(`https://wa.me/${settings.ownerPhone}?text=${encodeURIComponent(text)}`, '_blank');
                            }}
                        >
                            <MessageSquare className="mr-2 h-5 w-5" />
                            Order via WhatsApp
                        </Button>
                    </div>
                </div>
            )}

            {/* Checkout Dialog */}
            <Dialog open={isCheckoutOpen} onOpenChange={setCheckoutOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{t('placeOrderCOD', language)}</DialogTitle>
                        <DialogDescription>Review details before placing order.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-3">
                            <Label>Contact Info</Label>
                            <Input placeholder="Name" value={deliveryInfo.name} onChange={e => setDeliveryInfo({ ...deliveryInfo, name: e.target.value })} />
                            <Input placeholder="Phone" value={deliveryInfo.phone} onChange={e => setDeliveryInfo({ ...deliveryInfo, phone: e.target.value })} />
                        </div>

                        <div className="space-y-3">
                            <Label className="text-base font-semibold">Delivery Address</Label>

                            {user && (
                                <div className="p-3 border rounded-lg bg-gray-50/50">
                                    <Label className="text-sm mb-2 block text-muted-foreground">Select from Saved Addresses</Label>
                                    <AddressManager
                                        enableSelection={true}
                                        onSelect={(addr) => {
                                            setDeliveryInfo(prev => ({
                                                ...prev,
                                                address: `${addr.line1}${addr.line2 ? ', ' + addr.line2 : ''}`,
                                                area: addr.area || prev.area,
                                                pincode: addr.pincode || prev.pincode
                                            }));

                                            // Handle area selection logic if it matches our list
                                            if (addr.area && areas && areas.some(a => a.name === addr.area)) {
                                                // It's a valid area, so select it
                                                // The setDeliveryInfo above handles it, but we might want to ensure consistency
                                            }

                                            toast({ title: "Address Selected", description: `Using ${addr.label} address` });
                                        }}
                                    />
                                    <div className="relative flex items-center py-2">
                                        <div className="flex-grow border-t border-muted"></div>
                                        <span className="flex-shrink-0 mx-4 text-xs text-muted-foreground">OR ENTER MANUALLY</span>
                                        <div className="flex-grow border-t border-muted"></div>
                                    </div>
                                </div>
                            )}

                            <div className="grid gap-3">
                                <div className="grid gap-2">
                                    <Label htmlFor="area-select">Area / Location</Label>
                                    <Select onValueChange={(val) => {
                                        const area = areas?.find(a => a.name === val);
                                        setDeliveryInfo({ ...deliveryInfo, area: val, pincode: area?.pincode || '' });
                                    }} value={deliveryInfo.area}>
                                        <SelectTrigger id="area-select" className="bg-white"><SelectValue placeholder="Select Delivery Area" /></SelectTrigger>
                                        <SelectContent>
                                            {areas?.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                                            <SelectItem value="Other">Other (Custom Location)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="manual-address">Full Address</Label>
                                    <Textarea
                                        id="manual-address"
                                        placeholder="House No, Street, Landmark..."
                                        value={deliveryInfo.address}
                                        onChange={e => setDeliveryInfo({ ...deliveryInfo, address: e.target.value })}
                                        className="min-h-[80px] bg-white"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="pincode">Pincode</Label>
                                    <Input
                                        id="pincode"
                                        placeholder="5000XX"
                                        value={deliveryInfo.pincode}
                                        onChange={e => setDeliveryInfo({ ...deliveryInfo, pincode: e.target.value })}
                                        className="bg-white"
                                    />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Payment Method Section - Visual Only for now as COD is main */}
                        <div className="space-y-3">
                            <Label className="text-base font-semibold">Payment Method</Label>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="flex items-center space-x-3 border p-3 rounded-lg bg-primary/10 border-primary/20 cursor-pointer relative overflow-hidden">
                                    <div className="h-4 w-4 rounded-full border border-primary bg-primary flex items-center justify-center">
                                        <div className="h-2 w-2 rounded-full bg-white" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm">Cash on Delivery (COD)</p>
                                        <p className="text-xs text-muted-foreground">Pay when you receive your order</p>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-3 border p-3 rounded-lg opacity-60 cursor-not-allowed bg-gray-50">
                                    <div className="h-4 w-4 rounded-full border border-gray-300" />
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm text-gray-500">Online Payment / UPI</p>
                                        <p className="text-xs text-muted-foreground">Coming Soon</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex items-center space-x-2">
                            <Checkbox id="terms" checked={agreedToTerms} onCheckedChange={(c) => setAgreedToTerms(c as boolean)} />
                            <Label htmlFor="terms" className="text-sm">I agree to Terms & Conditions</Label>
                        </div>
                        <ul className="list-disc list-inside text-xs text-muted-foreground pl-2">
                            {termsAndConditions.map(t => <li key={t}>{t}</li>)}
                        </ul>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Cancel</Button>
                        <Button onClick={handlePlaceOrder} disabled={isPlacingOrder || !agreedToTerms}>{isPlacingOrder ? 'Placing...' : 'Confirm Order'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Success Dialog */}
            <Dialog open={isOrderSuccessOpen} onOpenChange={setOrderSuccessOpen}>
                <DialogContent>
                    {isOrderSuccessOpen && <Confetti />}
                    <DialogHeader>
                        <DialogTitle>Order Placed Successfully!</DialogTitle>
                        <DialogDescription>Your order has been received.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                        <Button asChild className="w-full" variant="secondary">
                            <Link href={whatsappUrl} target="_blank"><MessageSquare className="mr-2 h-4 w-4" /> Send on WhatsApp</Link>
                        </Button>
                        <Button onClick={handlePrintOrder} className="w-full"><Printer className="mr-2 h-4 w-4" /> Print Order</Button>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => { setOrderSuccessOpen(false); router.push('/dashboard'); }}>Continue Shopping</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
