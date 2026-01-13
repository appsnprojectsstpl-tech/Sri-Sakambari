
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
import { ShoppingCart, Trash2, MessageSquare, Printer, Scissors } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';
import { settings } from '@/lib/settings';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import Link from 'next/link';
import { generateSalesOrderPDF } from '@/lib/pdf-utils';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

const AddressManager = dynamic(() => import('./address-manager'), { ssr: false });


interface CartSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cart: CartItem[];
  cartTotal: number;
  updateCartQuantity: (productId: string, isCut: boolean, quantity: number) => void;
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
  const { data: products } = useCollection<Product>('products');
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);
  const [isOrderSuccessOpen, setOrderSuccessOpen] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const { toast } = useToast();
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);

  const [deliveryInfo, setDeliveryInfo] = useState({
    name: '',
    phone: '',
    address: '',
    deliveryPlace: '',
    area: '',
    slot: ''
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
        slot: ''
      });
    }
  }, [user]);

  const finalTotal = cartTotal;
  const isMinOrderMet = finalTotal >= settings.minOrderValue;

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

    const requiredFields = ['name', 'phone', 'address', 'area', 'slot'];
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

      const newOrderId = await runTransaction(firestore, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);

        let lastId = 0;
        if (counterDoc.exists()) {
          lastId = counterDoc.data()?.lastId || 0;
        }

        const nextId = lastId + 1;
        const formattedOrderId = `ORDER-${String(nextId).padStart(4, '0')}`;

        transaction.set(counterRef, { lastId: nextId }, { merge: true });
        return formattedOrderId;
      });

      const orderRef = doc(firestore, 'orders', newOrderId);

      const newOrderData: Order = {
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
        })),
        totalAmount: finalTotal,
        paymentMode: 'COD',
        orderType: 'ONE_TIME',
        area: deliveryInfo.area,
        deliveryDate: new Date().toISOString().split('T')[0],
        deliverySlot: deliveryInfo.slot,
        status: 'PENDING',
        createdAt: serverTimestamp() as Timestamp,
        agreedToTerms: true,
      };

      await setDoc(orderRef, newOrderData);
      setLastPlacedOrder(newOrderData);

      // Notify Admins
      try {
        const adminsSnapshot = await getDocs(query(collection(firestore, 'users'), where('role', '==', 'admin')));
        const adminIds = adminsSnapshot.docs.map(d => d.id);

        // Create notification for each admin
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
        // Don't block success flow
      }


      const message = t('whatsappOrderConfirmation', language).replace('{ORDER_ID}', newOrderId);
      const phone = deliveryInfo.phone.replace(/[^0-9]/g, '');
      const whatsappLink = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
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
    if (lastPlacedOrder && products) {
      generateSalesOrderPDF(lastPlacedOrder, products, language);
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
          <SheetHeader>
            <SheetTitle className="text-2xl font-headline">{t('yourCart', language)}</SheetTitle>
          </SheetHeader>
          {cart.length > 0 ? (
            <div className="flex-1 overflow-y-auto pr-4 -mr-4 overflow-x-hidden">
              <div className="my-4 flex flex-col gap-4">
                <AnimatePresence mode="popLayout">
                  {cart.map((item) => (
                    <motion.div
                      key={`${item.product.id}-${item.isCut}`}
                      className="relative flex items-center gap-4 bg-background p-2 rounded-lg overflow-hidden touch-pan-y"
                      initial={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      layout
                      drag="x"
                      dragConstraints={{ left: -100, right: 0 }}
                      dragElastic={0.1}
                      style={{ touchAction: 'pan-y' }}
                      onDragEnd={(_, info) => {
                        if (info.offset.x < -60) {
                          updateCartQuantity(item.product.id, item.isCut, 0);
                        }
                      }}
                    >
                      {/* Visual cue for delete action behind the item */}
                      <div className="absolute inset-y-0 right-0 w-24 bg-destructive z-[-1] flex items-center justify-end pr-4 rounded-r-lg">
                        <Trash2 className="text-destructive-foreground h-6 w-6" />
                      </div>

                      <div className="relative h-16 w-16 rounded-md overflow-hidden shrink-0">
                        <Image src={item.product.imageUrl || `https://picsum.photos/seed/${item.product.id}/100/100`} alt={item.product.name} fill className="object-cover" data-ai-hint={item.product.imageHint || ''} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm line-clamp-1">{getProductName(item.product, language)}</h4>
                          {item.isCut && <Badge variant="outline" className="flex items-center gap-1 h-5 text-[10px] px-1"><Scissors className="h-3 w-3" />Cut</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground font-sans">
                          ₹{item.product.pricePerUnit}
                          {item.isCut && ` + ₹${item.product.cutCharge || 10}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Input type="number" value={item.quantity} onChange={(e) => updateCartQuantity(item.product.id, item.isCut, parseInt(e.target.value))} className="w-12 h-8 text-center px-1 text-sm" />
                        {/* Optional standard delete button kept for accessibility */}
                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => updateCartQuantity(item.product.id, item.isCut, 0)}>
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
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <ShoppingCart className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold">{t('cartEmpty', language)}</h3>
              <p className="text-muted-foreground">{t('cartEmptyHint', language)}</p>
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
                  <p className="text-center text-sm text-destructive">
                    Add &#8377;{(settings.minOrderValue - finalTotal).toFixed(2)} more to place order.
                  </p>
                )}
                <Button className="w-full" size="lg" onClick={handleProceedToCheckout} disabled={!isMinOrderMet}>
                  {t('proceedToCheckout', language)}
                </Button>
              </div>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

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
                  <div key={`${item.product.id}-${item.isCut}`} className="flex items-center gap-3 text-sm">
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {getProductName(item.product, language)}
                        {item.isCut && <Badge variant="outline" className="flex items-center gap-1 h-5 text-xs"><Scissors className="h-3 w-3" />Cut</Badge>}
                      </div>
                      <p className="text-muted-foreground font-sans">&#8377;{item.product.pricePerUnit} / {item.product.unit}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateCartQuantity(item.product.id, item.isCut, parseInt(e.target.value) || 0)}
                        className="w-12 h-10 text-center text-base"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive h-10 w-10 hover:bg-destructive/10"
                        onClick={() => updateCartQuantity(item.product.id, item.isCut, 0)}
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
                    <Select onValueChange={value => setDeliveryInfo({ ...deliveryInfo, area: value, slot: '' })} value={deliveryInfo.area} required>
                      <SelectTrigger id="area" className="text-base h-11">
                        <SelectValue placeholder="Select area" />
                      </SelectTrigger>
                      <SelectContent>
                        {areas?.map(area => <SelectItem key={area.id} value={area.name} className="text-base py-3">{area.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="slot">{t('deliverySlot', language)}</Label>
                    <Select onValueChange={value => setDeliveryInfo({ ...deliveryInfo, slot: value })} disabled={!deliveryInfo.area} required>
                      <SelectTrigger id="slot" className="text-base h-11">
                        <SelectValue placeholder="Select slot" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedArea?.defaultSlots.map(slot => <SelectItem key={slot} value={slot} className="text-base py-3">{slot}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4 pb-4">
              <h4 className="font-semibold">Terms & Conditions</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 pl-2">
                {termsAndConditions.map((term, index) => <li key={index}>{term}</li>)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline text-center">🎉 {t('orderSuccessful', language)}! 🎉</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4 space-y-4">
            <p className="text-muted-foreground">{t('orderPlacedMessage', language)}</p>
          </div>
          <DialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
