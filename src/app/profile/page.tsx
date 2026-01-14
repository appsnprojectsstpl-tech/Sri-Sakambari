
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useUser, useCollection, useFirestore, useAuth } from '@/firebase';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Order, Product, CartItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';
import { useRouter } from 'next/navigation';
import Header from '@/components/header';
import { signOut } from 'firebase/auth';
import dynamic from 'next/dynamic';
import { doc, getDoc, query, collection, where, documentId, getDocs } from 'firebase/firestore';
import { chunkArray } from '@/firebase/firestore/utils';

const AddressManager = dynamic(() => import('@/components/address-manager'), { ssr: false });

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

    const handleLogout = async () => {
        if (auth) {
            await signOut(auth);
            router.push('/dashboard');
        }
    };

    const handleRepeatOrder = async (order: Order) => {
        if (!firestore) return;

        // Fetch products on demand
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
            console.error("Error fetching products for repeat order:", error);
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
                // Fallback to denormalized name if product document is missing or inactive
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
            const currentCartJson = localStorage.getItem('cart');
            try {
                currentCart = currentCartJson ? JSON.parse(currentCartJson) : [];
            } catch (e) {
                console.error("Failed to parse cart", e);
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

        localStorage.setItem('cart', JSON.stringify(currentCart));
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
            <main className="container mx-auto px-4 py-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold">{user.name}</CardTitle>
                        <CardDescription>{user.email}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <div>
                            <AddressManager />
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold">Order History</h3>
                            {orders && orders.length > 0 ? (
                                <Accordion type="single" collapsible className="w-full">
                                    {orders.map(order => (
                                        <AccordionItem value={order.id} key={order.id}>
                                            <AccordionTrigger>
                                                <div className="flex justify-between w-full pr-4">
                                                    <span>Order #{order.id}</span>
                                                    <Badge>{order.status}</Badge>
                                                    <span>{formatDate(order.createdAt)}</span>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Item</TableHead>
                                                            <TableHead>Quantity</TableHead>
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
                                                                    <TableCell>{item.priceAtOrder.toFixed(2)}</TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                                <div className="flex justify-end items-center mt-4 gap-4">
                                                    <span className="font-bold">Total: {order.totalAmount.toFixed(2)}</span>
                                                    <Button onClick={() => handleRepeatOrder(order)}>Repeat Order</Button>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            ) : (
                                <p className="text-muted-foreground">You have not placed any orders yet.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
