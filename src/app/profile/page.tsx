
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
import { User, Package, BarChart3, Heart, Settings, HelpCircle } from 'lucide-react';

// Lazy load components
const AddressManager = dynamic(() => import('@/components/address-manager'), { ssr: false });
const UpdateChecker = dynamic(() => import('@/components/profile/update-checker'), { ssr: false });
const AnalyticsDashboard = dynamic(() => import('@/components/profile/analytics-dashboard'), { ssr: false });
const FavoriteProducts = dynamic(() => import('@/components/profile/favorite-products'), { ssr: false });
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

    const handleLogout = async () => {
        if (auth) {
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
            logger.error("Error fetching products for repeat order:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to fetch product details. Please try again.',
            });
            return;
        }

        const productMap = new Map(fetchedProducts.map(p => [p.id, p]));
        const unavailableItems: string[] = [];
        const itemsToProcess: CartItem[] = [];

        order.items.forEach(item => {
            const product = productMap.get(item.productId);
            if (product && product.isActive) {
                itemsToProcess.push({
                    product,
                    quantity: item.qty,
                    isCut: item.isCut || false
                });
            } else {
                const fallbackName = item.name || (language === 'te' && item.name_te ? item.name_te : 'Unknown Item');
                unavailableItems.push(product?.name || fallbackName);
            }
        });

        if (itemsToProcess.length === 0) {
            toast({
                variant: 'destructive',
                title: 'All items are unavailable',
                description: `None of the items from this order can be added to your cart.`,
            });
            return;
        }

        let currentCart: CartItem[] = [];
        if (typeof window !== 'undefined') {
            const currentCartJson = safeLocalStorage.getItem('cart');
            try {
                currentCart = currentCartJson ? JSON.parse(currentCartJson) : [];
            } catch (e) {
                logger.error("Failed to parse cart", e);
                currentCart = [];
            }
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

        if (unavailableItems.length > 0) {
            toast({
                variant: 'destructive',
                title: 'Some items are unavailable',
                description: `The following items could not be added to your cart: ${unavailableItems.join(', ')}`,
            });
        } else {
            toast({
                title: 'Items Added to Cart',
                description: 'Items from your previous order have been added to your cart.',
            });
        }

        router.push('/dashboard');
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
    const noop = () => { };

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <Header
                user={user}
                onLogout={handleLogout}
                cartCount={0}
                notifications={emptyArray}
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
                        <TabsTrigger value="favorites" className="text-xs sm:text-sm">
                            <Heart className="h-4 w-4 mr-1" />
                            Favorites
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
                                            <AccordionItem value={order.id} key={order.id}>
                                                <AccordionTrigger>
                                                    <div className="flex justify-between w-full pr-4 text-left">
                                                        <span className="font-medium">Order #{order.id.slice(0, 8)}</span>
                                                        <Badge>{order.status}</Badge>
                                                        <span className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Item</TableHead>
                                                                <TableHead>Qty</TableHead>
                                                                <TableHead>Price</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {order.items.map(item => {
                                                                const displayName = language === 'te' && item.name_te ? item.name_te : (item.name || 'Item not found');
                                                                return (
                                                                    <TableRow key={item.productId}>
                                                                        <TableCell>{displayName}</TableCell>
                                                                        <TableCell>{item.qty}</TableCell>
                                                                        <TableCell>₹{item.priceAtOrder.toFixed(2)}</TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                    <div className="flex justify-end items-center mt-4 gap-4">
                                                        <span className="font-bold">Total: ₹{order.totalAmount.toFixed(2)}</span>
                                                        <Button onClick={() => handleRepeatOrder(order)}>Repeat Order</Button>
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

                    {/* Favorites Tab */}
                    <TabsContent value="favorites" className="space-y-4">
                        <FavoriteProducts orders={orders} onReorder={handleReorderProduct} />
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
