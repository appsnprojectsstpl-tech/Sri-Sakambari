
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useUser, useCollection, useFirestore, useAuth } from '@/firebase';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Order, Product, CartItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import { useRouter } from 'next/navigation';
import Header from '@/components/header';
import { signOut } from 'firebase/auth';
import dynamic from 'next/dynamic';
import { doc, getDoc, query, collection, where, documentId, getDocs, updateDoc } from 'firebase/firestore';
import { chunkArray } from '@/firebase/firestore/utils';
import { logger, safeLocalStorage } from '@/lib/logger';
import { User, Package, BarChart3, Settings, HelpCircle, Download, Ban, Clock, Edit } from 'lucide-react';
import { generateSalesOrderPDF } from '@/lib/pdf-utils';
import { OrderTimeline } from '@/components/order-timeline';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { serverTimestamp } from 'firebase/firestore';
import { useUserNotifications } from '@/hooks/use-user-notifications';

// Lazy load components
const AddressManager = dynamic(() => import('@/components/address-manager'), { ssr: false });
const UpdateChecker = dynamic(() => import('@/components/update-checker').then(mod => mod.UpdateChecker), { ssr: false });
const AnalyticsDashboard = dynamic(() => import('@/components/profile/analytics-dashboard'), { ssr: false });

const HelpSupport = dynamic(() => import('@/components/profile/help-support'), { ssr: false });
const EditProfile = dynamic(() => import('@/components/profile/edit-profile'), { ssr: false });
const NotificationSettings = dynamic(() => import('@/components/profile/notification-settings'), { ssr: false });
const PaymentMethods = dynamic(() => import('@/components/profile/payment-methods'), { ssr: false });

export default function ProfilePage() {
    const { user, loading: userLoading } = useUser();
    const { toast } = useToast();
    const { language } = useLanguage();
    const router = useRouter();
    const auth = useAuth();
    const firestore = useFirestore();
    const { notifications } = useUserNotifications();

    const { data: rawOrders, loading: ordersLoading } = useCollection<Order>('orders', {
        constraints: user?.id ? [['where', 'customerId', '==', user.id]] : [],
        disabled: !user?.id,
    });

    const orders = useMemo(() => {
        if (!rawOrders) return [];
        return [...rawOrders].sort((a, b) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt as any).getTime();
            const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt as any).getTime();
            return dateB - dateA;
        });
    }, [rawOrders]);

    useEffect(() => {
        if (!userLoading && !user) {
            router.push('/login');
        }
    }, [user, userLoading, router]);

    // Handlers
    const handleUpdateProfile = async (data: Partial<User>) => {
        if (!auth.currentUser) return;
        try {
            await updateDoc(doc(firestore, 'users', auth.currentUser.uid), data);
            toast({ title: 'Success', description: 'Profile updated successfully' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update profile' });
        }
    };



    const handleDownloadInvoice = (order: Order) => {
        // Need products for PDF generation
        // We can fetch them or pass minimal data. 
        // For now, let's try to generate with minimal data or fetch standard products.
        // Actually PDF utils needs products array to find names if not in order items.
        // Let's pass empty array and rely on fallback names in PDF utils which we saw earlier.
        generateSalesOrderPDF(order, [], language);
    };

    const handleLogout = async () => {
        if (auth) {
            safeLocalStorage.removeItem('cart'); // Clear cart on logout
            await signOut(auth);
            router.push('/dashboard');
        }
    };

    const handleRepeatOrder = async (order: Order) => {
        if (!firestore) return;

        const itemIds = Array.from(new Set(order.items.map(item => item.productId)));
        const fetchedProducts: Product[] = [];

        try {
            const chunks = chunkArray(itemIds, 30);
            await Promise.all(chunks.map(async (chunkIds) => {
                const q = query(collection(firestore, 'products'), where(documentId(), 'in', chunkIds));
                const snapshot = await getDocs(q);
                snapshot.docs.forEach(doc => {
                    fetchedProducts.push({ id: doc.id, ...doc.data() } as Product);
                });
            }));
        } catch (error) {
            console.error("Error fetching products:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to fetch product details.',
            });
            return;
        }

        const productMap = new Map(fetchedProducts.map(p => [p.id, p]));
        const itemsToProcess: CartItem[] = [];
        let skippedCount = 0;

        order.items.forEach(item => {
            const product = productMap.get(item.productId);
            if (product && product.isActive) {
                // Check stock
                const isAvailable = (!product.trackInventory) || ((product.stockQuantity || 0) >= item.qty);

                if (isAvailable) {
                    itemsToProcess.push({
                        product,
                        quantity: item.qty,
                        isCut: item.isCut || false
                    });
                } else {
                    skippedCount++;
                }
            } else {
                skippedCount++;
            }
        });

        if (itemsToProcess.length === 0) {
            toast({ variant: 'destructive', title: 'Unavailable', description: 'None of the items are available in stock.' });
            return;
        }

        if (skippedCount > 0) {
            toast({
                variant: 'warning',
                title: 'Some items unavailable',
                description: `${skippedCount} items were out of stock or unavailable and were skipped.`
            });
        }

        let currentCart: CartItem[] = [];
        if (typeof window !== 'undefined') {
            const currentCartJson = safeLocalStorage.getItem('cart');
            try {
                currentCart = currentCartJson ? JSON.parse(currentCartJson) : [];
            } catch (e) { console.error(e); }
        }

        itemsToProcess.forEach(newItem => {
            const existingItemIndex = currentCart.findIndex(
                c => c.product.id === newItem.product.id && c.isCut === newItem.isCut
            );
            if (existingItemIndex > -1) {
                currentCart[existingItemIndex].quantity += newItem.quantity;
            } else {
                currentCart.push(newItem);
            }
        });

        safeLocalStorage.setItem('cart', JSON.stringify(currentCart));
        window.dispatchEvent(new Event("storage"));
        toast({ title: 'Cart Updated', description: 'Items added to your cart.' }); // Feedback for success
    };

    const handleModifyOrder = async (order: Order) => {
        if (!confirm('To modify this order, we need to cancel it first and add items to your cart. Continue?')) return;

        try {
            await handledcancelOrder(order.id, false); // Pass false to skip extra confirmation if possible, or just call update
            await handleRepeatOrder(order);
            toast({ title: 'Order Ready to Modify', description: 'Items added to cart. Please make changes and checkout again.' });
            // Small delay to allow storage event to propagate?
            setTimeout(() => {
                const cartBtn = document.getElementById('cart-trigger-button');
                if (cartBtn) cartBtn.click();
            }, 500);
        } catch (e) {
            console.error("Modify failed", e);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to modify order.' });
        }
    };

    // Helper wrapper for cancel to reuse logic if need be, or just use existing handledcancelOrder
    // NOTE: The previous code had `handledcancelOrder`. I need to make sure I don't break it. 
    // I will rewrite `handledcancelOrder` to be reusable or just call the dedicated update logic.

    const handledcancelOrder = async (orderId: string, showConfirm = true) => {
        if (showConfirm && !confirm('Are you sure you want to cancel this order?')) return;
        try {
            await updateDoc(doc(firestore, 'orders', orderId), {
                status: 'CANCELLED',
                cancelledAt: serverTimestamp(),
                cancelledBy: user?.id || 'customer'
            });
            if (showConfirm) toast({ title: 'Order Cancelled', description: 'Your order has been cancelled successfully.' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to cancel order' });
            throw error; // Propagate for modify
        }
    };



    const handleReorderProduct = (productId: string) => {
        // Add single product to cart
        toast({
            title: 'Feature Coming Soon',
            description: 'Quick reorder will be available soon!',
        });
    };

    if (userLoading || ordersLoading || !user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p>Loading profile...</p>
            </div>
        );
    }

    const formatDate = (date: any) => {
        if (!date) return 'Invalid Date';
        const jsDate = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
        if (isNaN(jsDate.getTime())) return 'Invalid Date';
        return jsDate.toLocaleDateString();
    }

    const emptyArray: any[] = [];
    // const { notifications } = useUserNotifications(); // Moved to top
    const noop = () => { };

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <Header
                user={user}
                onLogout={handleLogout}
                cartCount={0}
                notifications={notifications || []}
                onCartClick={noop}
            />
            <main className="container mx-auto px-4 py-6 pb-24">
                {/* User Info Card */}
                <Card className="mb-6">
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl">{user.name}</CardTitle>
                                <CardDescription>{user.email}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                {/* Tabbed Interface */}
                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 mb-6">
                        <TabsTrigger value="overview" className="text-xs sm:text-sm">
                            <BarChart3 className="h-4 w-4 mr-1" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="orders" className="text-xs sm:text-sm">
                            <Package className="h-4 w-4 mr-1" />
                            Orders
                        </TabsTrigger>

                        <TabsTrigger value="settings" className="text-xs sm:text-sm">
                            <Settings className="h-4 w-4 mr-1" />
                            Settings
                        </TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="space-y-4">
                        <AnalyticsDashboard orders={orders} />
                        <UpdateChecker />
                    </TabsContent>

                    {/* Orders Tab */}
                    <TabsContent value="orders" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Order History</CardTitle>
                                <CardDescription>View and manage your orders</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {orders && orders.length > 0 ? (
                                    <Accordion type="single" collapsible className="w-full">
                                        {orders.map(order => (
                                            <AccordionItem value={order.id} key={order.id} className="border rounded-lg mb-4 px-2">
                                                <AccordionTrigger className="hover:no-underline">
                                                    <div className="flex flex-col sm:flex-row justify-between w-full pr-4 text-left gap-2 sm:items-center">
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold">Order #{order.id.slice(0, 8)}</span>
                                                            <span className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</span>
                                                        </div>
                                                        <Badge variant={order.status === 'CANCELLED' ? 'destructive' : 'outline'} className={order.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : ''}>
                                                            {order.status}
                                                        </Badge>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="space-y-6 pt-2">
                                                        {/* Timeline */}
                                                        <div className="bg-gray-50 p-4 rounded-lg">
                                                            <OrderTimeline
                                                                status={order.status}
                                                                createdAt={order.createdAt as any}
                                                                confirmedAt={(order as any).confirmedAt} // Type cast if needed
                                                                deliveredAt={(order as any).deliveredAt || (order as any).deliveryDate}
                                                                cancelledAt={(order as any).cancelledAt}
                                                            />
                                                        </div>

                                                        {/* Items Table */}
                                                        <div className="border rounded-md overflow-hidden">
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow className="bg-muted/50">
                                                                        <TableHead>Item</TableHead>
                                                                        <TableHead className="text-center">Qty</TableHead>
                                                                        <TableHead className="text-right">Price</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {order.items.map(item => {
                                                                        const displayName = language === 'te' && item.name_te ? item.name_te : (item.name || 'Item not found');
                                                                        return (
                                                                            <TableRow key={item.productId}>
                                                                                <TableCell className="font-medium">
                                                                                    {displayName}
                                                                                    {item.isCut && <span className="text-xs text-muted-foreground ml-1">(Cut)</span>}
                                                                                </TableCell>
                                                                                <TableCell className="text-center">{item.qty}</TableCell>
                                                                                <TableCell className="text-right">₹{item.priceAtOrder.toFixed(2)}</TableCell>
                                                                            </TableRow>
                                                                        );
                                                                    })}
                                                                    <TableRow className="font-bold bg-muted/20">
                                                                        <TableCell colSpan={2} className="text-right">Total Amount:</TableCell>
                                                                        <TableCell className="text-right">₹{order.totalAmount.toFixed(2)}</TableCell>
                                                                    </TableRow>
                                                                </TableBody>
                                                            </Table>
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex flex-wrap justify-end items-center gap-3 border-t pt-4">
                                                            <Button variant="outline" size="sm" onClick={() => handleDownloadInvoice(order)}>
                                                                <Download className="w-4 h-4 mr-2" />
                                                                Invoice
                                                            </Button>

                                                            {(order.status === 'PENDING' || order.status === 'CONFIRMED') && (
                                                                <>
                                                                    <Button variant="outline" size="sm" onClick={() => handleModifyOrder(order)} className="border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700">
                                                                        <Edit className="w-4 h-4 mr-2" />
                                                                        Modify
                                                                    </Button>

                                                                    <AlertDialog>
                                                                        <AlertDialogTrigger asChild>
                                                                            <Button variant="destructive" size="sm">
                                                                                <Ban className="w-4 h-4 mr-2" />
                                                                                Cancel Order
                                                                            </Button>
                                                                        </AlertDialogTrigger>
                                                                        <AlertDialogContent>
                                                                            <AlertDialogHeader>
                                                                                <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
                                                                                <AlertDialogDescription>
                                                                                    Are you sure you want to cancel this order? This action cannot be undone.
                                                                                </AlertDialogDescription>
                                                                            </AlertDialogHeader>
                                                                            <AlertDialogFooter>
                                                                                <AlertDialogCancel>Keep Order</AlertDialogCancel>
                                                                                <AlertDialogAction onClick={() => handledcancelOrder(order.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                                                    Yes, Cancel
                                                                                </AlertDialogAction>
                                                                            </AlertDialogFooter>
                                                                        </AlertDialogContent>
                                                                    </AlertDialog>
                                                                </>
                                                            )}

                                                            <Button size="sm" onClick={() => handleRepeatOrder(order)}>
                                                                Repeat Order
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                ) : (
                                    <p className="text-muted-foreground text-center py-8">You have not placed any orders yet.</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>



                    {/* Settings Tab */}
                    <TabsContent value="settings" className="space-y-4">
                        <EditProfile user={user} onUpdate={handleUpdateProfile} />
                        <NotificationSettings user={user} />
                        <PaymentMethods user={user} />
                        <AddressManager />
                        <HelpSupport />
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
