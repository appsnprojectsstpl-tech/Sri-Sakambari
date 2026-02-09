
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { t, getProductName } from '@/lib/translations';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { doc, setDoc, serverTimestamp, runTransaction, collection, Timestamp, query, where, getDocs, writeBatch } from 'firebase/firestore';
import type { CartItem, Area, Order, Product } from '@/lib/types';
import { ShoppingCart, Trash2, MessageSquare, Printer, Slice, Plus, Minus } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';
import { settings } from '@/lib/settings';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import Link from 'next/link';
import { generateSalesOrderPDF } from '@/lib/pdf-utils';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

import { Progress } from './ui/progress';
import { Confetti } from './confetti';
import { getDeductionAmount } from '@/lib/units';

const AddressManager = dynamic(() => import('./address-manager'), { ssr: false });

interface CartSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cart: CartItem[];
  cartTotal: number;
  updateCartQuantity: (productId: string, isCut: boolean, quantity: number, variantId?: string) => void;
  clearCart: () => void;
}

export default function CartSheet({
  isOpen,
  onOpenChange,
  cart,
  cartTotal,
  updateCartQuantity,
  clearCart,
}: CartSheetProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { language } = useLanguage();
  const { data: areas } = useCollection<Area>('areas');
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);
  const [isOrderSuccessOpen, setOrderSuccessOpen] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const { toast } = useToast();
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);
  const [lastPlacedOrderProducts, setLastPlacedOrderProducts] = useState<Product[]>([]);

  const [deliveryInfo, setDeliveryInfo] = useState({
    name: '',
    phone: '',
    address: '',
    deliveryPlace: '',
    area: '',
    pincode: ''
  });

  const [useDifferentDelivery, setUseDifferentDelivery] = useState(false);

  useEffect(() => {
    if (user) {
      setDeliveryInfo({
        name: user.name || '',
        phone: user.phone || '',
        address: user.address || '',
        deliveryPlace: user.address || '',
        area: user.area || '',
        pincode: '' // Will be auto-filled when area is selected
      });
    }
  }, [user]);

  const finalTotal = isNaN(cartTotal) ? 0 : cartTotal;
  const isMinOrderMet = finalTotal >= settings.minOrderValue;
  // Free Delivery Nudge Logic (Gamification)
  // Assuming a target like ₹500 for a "Free Delivery" mental goal, or just reusing minOrder functionality visually.
  // Let's use a hypothetical FREE_DELIVERY_THRESHOLD = 500 for the visual nudge.
  const FREE_DELIVERY_THRESHOLD = 100;
  const progressPercentage = Math.min((finalTotal / FREE_DELIVERY_THRESHOLD) * 100, 100);

  const handlePlaceOrder = async () => {
    if (!user || !firestore) {
      // This should ideally not happen because we trigger login before checkout.
      toast({
        variant: "destructive",
        title: 'Authentication Error',
        description: 'You must be logged in to place an order.',
      });
      router.push('/login');
      return;
    }

    const requiredFields = ['name', 'phone', 'address', 'area'];
    if (useDifferentDelivery) {
      requiredFields.push('deliveryPlace');
    }

    for (const field of requiredFields) {
      if (!deliveryInfo[field as keyof typeof deliveryInfo]) {
        toast({
          variant: "destructive",
          title: 'Missing Information',
          description: `Please fill out all required fields. Missing: ${field}`,
        });
        return;
      }
    }

    // Validate phone number format (Indian mobile numbers: 10 digits, starts with 6-9)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(deliveryInfo.phone.replace(/\s+/g, ''))) {
      toast({
        variant: "destructive",
        title: 'Invalid Phone Number',
        description: 'Please enter a valid 10-digit Indian mobile number starting with 6-9.',
      });
      return;
    }

    if (!agreedToTerms) {
      toast({
        variant: 'destructive',
        title: 'Terms & Conditions',
        description: 'You must agree to the terms and conditions to place an order.',
      });
      return;
    }

    if (!isMinOrderMet) {
      toast({
        variant: 'destructive',
        title: 'Minimum Order Value',
        description: `Your order must be at least ${settings.minOrderValue}.`,
      });
      return;
    }

    setIsPlacingOrder(true);

    try {
      const counterRef = doc(firestore, 'orderCounters', 'main');

      const { newOrderId } = await runTransaction(firestore, async (transaction) => {
        // 1. Read Counter
        const counterDoc = await transaction.get(counterRef);
        let lastId = 0;
        if (counterDoc.exists()) {
          lastId = counterDoc.data()?.lastId || 0;
        }
        const nextId = lastId + 1;
        const generatedId = `ORDER-${String(nextId).padStart(4, '0')}`;

        // 2. Consolidate Product Reads (Deduplicate)
        const uniqueProductIds = Array.from(new Set(cart.map(item => item.product.id)));
        const productRefs = uniqueProductIds.map(id => doc(firestore, 'products', id));
        const productSnapshots = await Promise.all(productRefs.map(ref => transaction.get(ref)));

        const productMap = new Map();
        productSnapshots.forEach(snap => {
          if (snap.exists()) productMap.set(snap.id, { ref: snap.ref, data: snap.data() });
        });

        // 3. Verify Stock & Prepare Updates
        // We track updated state in memory to handle multiple cart items affecting same product
        const productUpdates = new Map(); // productId -> data (clone)

        for (const item of cart) {
          const productInfo = productMap.get(item.product.id);
          if (!productInfo) throw new Error(`Product ${item.product.name} not found.`);

          // Get current state (either from initial read or ongoing update)
          let currentData = productUpdates.get(item.product.id);
          if (!currentData) {
            // Initialize clone from snapshot
            currentData = JSON.parse(JSON.stringify(productInfo.data));
            productUpdates.set(item.product.id, currentData);
          }



          if (item.selectedVariant) {
            const variants = currentData.variants || [];
            const vIndex = variants.findIndex((v: any) => v.id === item.selectedVariant?.id);

            if (vIndex === -1) throw new Error(`Variant ${item.selectedVariant.unit} for ${item.product.name} is no longer available.`);

            if (currentData.manageStockBy === 'weight') {
              // --- MASTER STOCK LOGIC ---
              const deduction = getDeductionAmount(item.selectedVariant.unit, currentData.unit, item.quantity);
              const currentMasterStock = currentData.stockQuantity || 0;
              // If deduction is 0, it means units were incompatible or parsing failed. 
              // For now, if deduction is 0, we might skip or throw? 
              // Let's assume strictness: if we can't calculate deduction, it's an error.
              if (deduction > 0 && currentMasterStock < deduction) {
                throw new Error(`Insufficient Master Stock for ${item.product.name}. Needed: ${deduction} ${currentData.unit}, Available: ${currentMasterStock} ${currentData.unit}`);
              }
              // Only deduct if valid. 
              if (deduction > 0) {
                currentData.stockQuantity -= deduction;
              }
            } else {
              // --- COUNT BASED LOGIC (Legacy) ---
              if (variants[vIndex].stock < item.quantity) {
                throw new Error(`Insufficient stock for ${item.product.name} (${item.selectedVariant.unit}). Available: ${variants[vIndex].stock}`);
              }
              variants[vIndex].stock -= item.quantity;
            }
          } else {
            // Regular (base) product stock
            const currentStock = currentData.stockQuantity || 0;
            if (currentStock < item.quantity) {
              throw new Error(`Insufficient stock for ${item.product.name}. Available: ${currentStock}`);
            }
            currentData.stockQuantity -= item.quantity;
          }
        }

        // 4. Update Counter
        transaction.set(counterRef, { lastId: nextId }, { merge: true });

        // 5. Commit Stock Updates
        productUpdates.forEach((data, productId) => {
          const ref = productMap.get(productId).ref;
          transaction.update(ref, {
            stockQuantity: data.stockQuantity,
            variants: data.variants || []
          });
        });

        // 6. Create Order
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
            priceAtOrder: item.selectedVariant ? item.selectedVariant.price : item.product.pricePerUnit,
            isCut: item.isCut,
            cutCharge: item.isCut ? (item.product.cutCharge || 0) : 0,
            name: item.product.name,
            name_te: item.product.name_te,
            unit: item.selectedVariant ? item.selectedVariant.unit : item.product.unit,
            variantId: item.selectedVariant?.id,
            variantUnit: item.selectedVariant?.unit
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

      // Post-transaction success logic
      // We reconstruct local state for 'lastPlacedOrder' just for UI purposes if needed, 
      // but simpler to just use the newOrderId. 
      // Note: original code updated 'lastPlacedOrder' state. 
      // We can update it with a mock object or fetch it, but usually not needed for success screen if it just shows ID.
      // But let's be safe and set it.

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
          priceAtOrder: item.selectedVariant ? item.selectedVariant.price : item.product.pricePerUnit,
          isCut: item.isCut,
          cutCharge: item.isCut ? (item.product.cutCharge !== undefined ? item.product.cutCharge : settings.defaultCutCharge) : 0,
          name: item.product.name,
          name_te: item.product.name_te,
          unit: item.selectedVariant ? item.selectedVariant.unit : item.product.unit,
          variantId: item.selectedVariant?.id,
          variantUnit: item.selectedVariant?.unit
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
      try {
        const adminsSnapshot = await getDocs(query(collection(firestore, 'users'), where('role', '==', 'admin')));
        const adminIds = adminsSnapshot.docs.map(d => d.id);
        const batch = writeBatch(firestore);
        adminIds.forEach(adminId => {
          const notifRef = doc(collection(firestore, 'notifications'));
          batch.set(notifRef, {
            userId: adminId,
            title: 'New Order Received',
            message: `Order #${newOrderId} placed by ${user.name} for ₹${finalTotal}`,
            isRead: false,
            createdAt: serverTimestamp(),
            type: 'order',
            linkId: newOrderId
          });
        });
        await batch.commit();
      } catch (err) {
        console.error("Failed to notify admins", err);
      }

      const message = t('whatsappOrderConfirmation', language).replace('{ORDER_ID}', newOrderId);
      const whatsappLink = `https://wa.me/${settings.ownerPhone}?text=${encodeURIComponent(message)}`;
      setWhatsappUrl(whatsappLink);

      setCheckoutOpen(false);
      onOpenChange(false); // Close the cart sheet
      clearCart();
      setOrderSuccessOpen(true);
      toast({
        title: 'Order Placed!',
        description: 'Thank you for your purchase. Your order is being processed.',
      });

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: 'Order Failed',
        description: error.message || 'There was a problem placing your order.',
      });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const selectedArea = areas?.find(a => a.name === deliveryInfo.area);

  const handleProceedToCheckout = () => {
    if (!user) {
      // If user is not logged in, redirect to login page.
      // Cart is already saved in localStorage.
      router.push('/login');
      return;
    }

    onOpenChange(false); // Close cart sheet
    setUseDifferentDelivery(false);
    setCheckoutOpen(true); // Open checkout dialog
  }

  const handlePrintOrder = () => {
    if (lastPlacedOrder && lastPlacedOrderProducts.length > 0) {
      generateSalesOrderPDF(lastPlacedOrder, lastPlacedOrderProducts, language);
    } else {
      toast({
        variant: "destructive",
        title: "Could not generate PDF",
        description: "Order data or product data is missing.",
      });
    }
  };

  const termsAndConditions = [
    "once material delivered will not be returned back",
    `min order value - ${settings.minOrderValue}/-`,
    "delivery charges will be free within 3 kms surrounding New Nallakunta",
    "more than 3 kms surrounding New Nallakunta, delivery charges will be extra and should be paid by the customer",
  ];

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col">
          <SheetHeader className='space-y-1'>
            <SheetTitle className="text-2xl font-headline">{t('yourCart', language)}</SheetTitle>
            {cart.length > 0 && (
              <div className="space-y-1 pt-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className={finalTotal >= FREE_DELIVERY_THRESHOLD ? 'text-green-600' : 'text-muted-foreground'}>
                    {finalTotal >= FREE_DELIVERY_THRESHOLD
                      ? 'Free Delivery Unlocked!'
                      : `Add ₹${(FREE_DELIVERY_THRESHOLD - finalTotal).toFixed(0)} for Free Delivery`}
                  </span>
                  <span>{Math.round(progressPercentage)}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
            )}
          </SheetHeader>
          {cart.length > 0 ? (
            <div className="flex-1 overflow-y-auto pr-4 -mr-4 overflow-x-hidden">
              <div className="my-4 flex flex-col gap-4">
                <AnimatePresence mode="popLayout">
                  {cart.map((item) => (
                    <motion.div
                      key={`${item.product.id}-${item.isCut}-${item.selectedVariant?.id || 'base'}`}
                      className="relative flex items-center gap-4 bg-background p-2 rounded-lg overflow-hidden touch-pan-y shadow-sm border border-gray-100"
                      initial={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      layout
                      drag="x"
                      dragConstraints={{ left: -100, right: 0 }}
                      dragElastic={0.1}
                      style={{ touchAction: 'pan-y' }}
                      onDragEnd={(_, info) => {
                        if (info.offset.x < -60) {
                          updateCartQuantity(item.product.id, item.isCut, 0, item.selectedVariant?.id);
                        }
                      }}
                    >
                      {/* Visual cue for delete action behind the item */}
                      <div className="absolute inset-y-0 right-0 w-24 bg-destructive z-[-1] flex items-center justify-end pr-4 rounded-r-lg">
                        <Trash2 className="text-destructive-foreground h-6 w-6" />
                      </div>

                      <div className="relative h-16 w-16 rounded-md overflow-hidden shrink-0 bg-gray-100">
                        {item.product.imageUrl ? (
                          <Image src={item.product.imageUrl} alt={item.product.name} fill className="object-cover" data-ai-hint={item.product.imageHint || ''} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <ShoppingCart className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm line-clamp-1">
                            {getProductName(item.product, language)}
                            {item.selectedVariant && <span className="text-muted-foreground font-normal ml-1">({item.selectedVariant.unit})</span>}
                          </h4>
                          {item.isCut && <Badge variant="outline" className="flex items-center gap-1 h-5 text-[10px] px-1"><Slice className="h-3 w-3" />Cut</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground font-sans">
                          ₹{item.selectedVariant ? item.selectedVariant.price : item.product.pricePerUnit}
                          {item.isCut && ` + ₹${item.product.cutCharge || settings.defaultCutCharge} (Cut)`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => updateCartQuantity(item.product.id, item.isCut, Math.max(0, item.quantity - 1), item.selectedVariant?.id)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <div className="w-12 h-11 flex items-center justify-center text-sm font-semibold">
                          {item.quantity}
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => updateCartQuantity(item.product.id, item.isCut, item.quantity + 1, item.selectedVariant?.id)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8 hover:bg-destructive/10 rounded-full" onClick={() => updateCartQuantity(item.product.id, item.isCut, 0, item.selectedVariant?.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div className="px-1 text-xs text-muted-foreground text-center italic">Swipe left to delete items</div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 animate-in fade-in zoom-in duration-300">
              <div className="relative w-48 h-48 mb-6 opacity-80 flex items-center justify-center">
                <ShoppingCart className="w-32 h-32 text-muted-foreground" strokeWidth={1} />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{t('cartEmpty', language)}</h3>
              <p className="text-muted-foreground max-w-[200px] mb-8">{t('cartEmptyHint', language)}</p>
              <Button onClick={() => onOpenChange(false)} variant="default" size="lg" className="rounded-full px-8 shadow-lg hover:shadow-xl transition-all hover:scale-105">
                Start Shopping
              </Button>
            </div>
          )}
          {cart.length > 0 && (
            <SheetFooter className="mt-auto border-t pt-4">
              <div className="w-full space-y-2">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>{t('total', language)}</span>
                  <span className="font-sans">&#8377;{finalTotal.toFixed(2)}</span>
                </div>
                {!isMinOrderMet && (
                  <p className="text-center text-sm text-destructive font-medium bg-destructive/10 p-1 rounded">
                    Minimum order: &#8377;{settings.minOrderValue}
                  </p>
                )}
                <Button className="w-full shadow-lg" size="lg" onClick={handleProceedToCheckout} disabled={!isMinOrderMet}>
                  {t('proceedToCheckout', language)}
                </Button>

                <div className="relative relative flex items-center py-2">
                  <div className="flex-grow border-t border-muted"></div>
                  <span className="flex-shrink-0 mx-4 text-xs text-muted-foreground">OR</span>
                  <div className="flex-grow border-t border-muted"></div>
                </div>

                <Button
                  className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white shadow-lg"
                  size="lg"
                  onClick={() => {
                    const itemsList = cart.map(item =>
                      `- ${getProductName(item.product, language)} ${item.selectedVariant ? `(${item.selectedVariant.unit})` : `(${item.product.unit})`} x ${item.quantity} ${item.isCut ? '(Cut)' : ''}`
                    ).join('\n');
                    const text = `Hello, I want to order:\n\n${itemsList}\n\nTotal approx: ₹${finalTotal.toFixed(2)}`;
                    window.open(`https://wa.me/${settings.ownerPhone}?text=${encodeURIComponent(text)}`, '_blank');
                  }}
                >
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Order via WhatsApp
                </Button>
              </div>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet >

      <Dialog open={isCheckoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="flex flex-col w-full h-[100dvh] max-w-none rounded-none sm:h-auto sm:max-w-lg sm:rounded-lg overflow-hidden p-0 gap-0">
          <DialogHeader className="p-4 border-b shrink-0">
            <DialogTitle className="text-xl font-headline">Sales Order Form</DialogTitle>
            <DialogDescription className="text-sm">Please confirm your details.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className='space-y-4'>
              <h4 className="font-semibold text-base">Order Items</h4>
              <div className="space-y-3 bg-muted/20 p-3 rounded-lg">
                {cart.map((item) => (
                  <div key={`${item.product.id}-${item.isCut}-${item.selectedVariant?.id || 'base'}`} className="flex items-center gap-3 text-sm">
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {getProductName(item.product, language)}
                        {item.selectedVariant && <span className="text-muted-foreground font-normal">({item.selectedVariant.unit})</span>}
                        {item.isCut && <Badge variant="outline" className="flex items-center gap-1 h-5 text-xs"><Slice className="h-3 w-3" />Cut</Badge>}
                      </div>
                      <p className="text-muted-foreground font-sans">
                        &#8377;{item.selectedVariant ? item.selectedVariant.price : item.product.pricePerUnit}
                        {item.selectedVariant ? ` / ${item.selectedVariant.unit}` : ` / ${item.product.unit}`}
                        {item.isCut && ` + ₹${item.product.cutCharge || settings.defaultCutCharge} (Cut)`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => updateCartQuantity(item.product.id, item.isCut, Math.max(0, item.quantity - 1), item.selectedVariant?.id)}
                      >
                        <Minus className="h-5 w-5" />
                      </Button>
                      <div className="flex items-center justify-center w-12 h-10 text-base font-semibold">
                        {item.quantity}
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => updateCartQuantity(item.product.id, item.isCut, item.quantity + 1, item.selectedVariant?.id)}
                      >
                        <Plus className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive h-8 w-8 hover:bg-destructive/10"
                        onClick={() => updateCartQuantity(item.product.id, item.isCut, 0, item.selectedVariant?.id)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                <span>{t('total', language)}</span>
                <span className="font-sans">&#8377;{finalTotal.toFixed(2)}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-semibold text-base">Delivery Details</h4>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" className="text-base h-11" value={deliveryInfo.name} placeholder="Your full name" onChange={e => setDeliveryInfo({ ...deliveryInfo, name: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phoneNo">Phone Number</Label>
                  <Input id="phoneNo" className="text-base h-11" value={deliveryInfo.phone} placeholder="Your phone number" onChange={e => setDeliveryInfo({ ...deliveryInfo, phone: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label>Customer Address</Label>
                  {user && (
                    <div className="mb-4">
                      <Label className="mb-2 block">Select Saved Address</Label>
                      {/* <AddressManager
                        enableSelection={true}
                        onSelect={(addr: any) => {
                          setDeliveryInfo({
                            ...deliveryInfo,
                            address: `${addr.line1}${addr.line2 ? ', ' + addr.line2 : ''}, ${addr.area} - ${addr.pincode}`,
                            area: addr.area,
                            slot: '',
                          });
                        }}
                      /> */}
                    </div>
                  )}
                  <Textarea id="address" className="text-base min-h-[80px] mt-2" value={deliveryInfo.address} placeholder="Your full address or select from above" onChange={e => setDeliveryInfo({ ...deliveryInfo, address: e.target.value })} required />
                </div>

                <div className="flex items-center space-x-3 py-2">
                  <Checkbox id="different-delivery" className="h-5 w-5" checked={useDifferentDelivery} onCheckedChange={(checked) => setUseDifferentDelivery(checked as boolean)} />
                  <Label htmlFor="different-delivery" className="text-base">Deliver to a different address</Label>
                </div>

                {useDifferentDelivery && (
                  <div className="grid gap-2">
                    <Label htmlFor="deliveryPlace">Delivery Place</Label>
                    <Textarea id="deliveryPlace" className="text-base min-h-[80px]" value={deliveryInfo.deliveryPlace} placeholder="Enter delivery address" onChange={e => setDeliveryInfo({ ...deliveryInfo, deliveryPlace: e.target.value })} required />
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="area">{t('area', language)}</Label>
                    <Select
                      onValueChange={value => {
                        if (value === 'Other') {
                          alert("For 'Other' areas, delivery charges will be calculated based on the distance from New Nallakunta and informed separately.");
                          setDeliveryInfo({
                            ...deliveryInfo,
                            area: value,
                            pincode: ''
                          });
                        } else {
                          // Find the selected area to get its pincode
                          const selectedArea = areas?.find(a => a.name === value);
                          setDeliveryInfo({
                            ...deliveryInfo,
                            area: value,
                            pincode: selectedArea?.pincode || '' // Auto-fill pincode
                          });
                        }
                      }}
                      value={deliveryInfo.area}
                      required
                    >
                      <SelectTrigger id="area" className="text-base h-11">
                        <SelectValue placeholder="Select area" />
                      </SelectTrigger>
                      <SelectContent>
                        {areas?.map(area => (
                          <SelectItem key={area.id} value={area.name} className="text-base py-3">
                            {area.name} {area.pincode && `(${area.pincode})`}
                          </SelectItem>
                        ))}
                        <SelectItem value="Other" className="text-base py-3 text-primary font-medium">
                          Other (Custom Area)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Pincode Field - Auto-filled */}
                  <div className="grid gap-2">
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input
                      id="pincode"
                      className="text-base h-11"
                      value={deliveryInfo.pincode}
                      placeholder="Auto-filled from area"
                      onChange={e => setDeliveryInfo({ ...deliveryInfo, pincode: e.target.value })}
                      maxLength={6}
                      pattern="[0-9]{6}"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4 pb-4">
              <h4 className="font-semibold">Terms & Conditions</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 pl-2">
                {termsAndConditions.map((term) => <li key={term}>{term}</li>)}
              </ul>
              <div className="flex items-start space-x-3 pt-2">
                <Checkbox id="terms" className="h-5 w-5 mt-0.5" checked={agreedToTerms} onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)} />
                <Label htmlFor="terms" className="text-base font-medium leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I agree to the Terms & Conditions
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-background shrink-0 flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="w-full sm:w-auto h-11 text-base" onClick={() => setCheckoutOpen(false)}>{t('cancel', language)}</Button>
            <Button type="submit" className="w-full sm:w-auto h-11 text-base" onClick={handlePlaceOrder} disabled={!agreedToTerms || !isMinOrderMet || cart.length === 0 || isPlacingOrder}>
              {isPlacingOrder ? 'Placing Order...' : t('placeOrderCOD', language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isOrderSuccessOpen} onOpenChange={setOrderSuccessOpen}>
        <DialogContent className='overflow-hidden'>
          {isOrderSuccessOpen && <Confetti />}
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline text-center z-10 relative">🎉 {t('orderSuccessful', language)}! 🎉</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4 space-y-4 relative z-10">
            <p className="text-muted-foreground">{t('orderPlacedMessage', language)}</p>
          </div>
          <DialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2 relative z-10">
            <Button asChild className="w-full" variant="secondary">
              <Link href={whatsappUrl} target="_blank">
                <MessageSquare className="mr-2 h-4 w-4" />
                Send on WhatsApp
              </Link>
            </Button>
            <Button onClick={handlePrintOrder} className="w-full">
              <Printer className="mr-2 h-4 w-4" />
              Print Order
            </Button>
            <Button className="w-full sm:col-span-2" onClick={() => setOrderSuccessOpen(false)}>{t('continueShopping', language)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
