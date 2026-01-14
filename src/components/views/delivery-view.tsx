'use client';
import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Order, User, Notification } from '@/lib/types';
import { Phone, MapPin, CheckCircle, Truck, Image as ImageIcon } from "lucide-react";
import { Separator } from "../ui/separator";
import { useCollection, useFirestore, useAuth, createNotification } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useLanguage } from '@/context/language-context';
import { t, getProductName } from '@/lib/translations';
import PhotoUpload from '@/components/photo-upload';
import Image from 'next/image';

export default function DeliveryView({ user: deliveryUser }: { user: User }) {
    const firestore = useFirestore();
    const auth = useAuth();
    const { toast } = useToast();
    const { language } = useLanguage();

    const { data: users, loading: usersLoading } = useCollection<User>('users');
    const { data: assignedOrders, loading: ordersLoading } = useCollection<Order>('orders', {
        constraints: [['where', 'deliveryPartnerId', '==', auth?.currentUser?.uid || '']]
    });
    const { data: notifications, loading: notificationsLoading } = useCollection<Notification>('notifications', {
        constraints: [['where', 'userId', '==', auth?.currentUser?.uid || '']]
    });

    const [isPhotoUploadOpen, setPhotoUploadOpen] = useState(false);
    const [isViewPhotoOpen, setViewPhotoOpen] = useState(false);
    const [selectedOrderForPhoto, setSelectedOrderForPhoto] = useState<Order | null>(null);

    const handleStartDelivery = async (order: Order) => {
        await handleUpdateStatus(order, 'OUT_FOR_DELIVERY');
    };

    const handleOpenPhotoUpload = (order: Order) => {
        setSelectedOrderForPhoto(order);
        setPhotoUploadOpen(true);
    };

    const handlePhotoSubmit = async (photoDataUrl: string) => {
        if (!selectedOrderForPhoto) return;
        await handleUpdateStatus(selectedOrderForPhoto, 'DELIVERED', photoDataUrl);
        setPhotoUploadOpen(false);
        setSelectedOrderForPhoto(null);
    };

    const handleViewPhoto = (order: Order) => {
        setSelectedOrderForPhoto(order);
        setViewPhotoOpen(true);
    }

    const handleUpdateStatus = async (order: Order, status: Order['status'], deliveryPhotoUrl?: string) => {
        if (!firestore || !auth?.currentUser) return;
        try {
            const orderRef = doc(firestore, 'orders', order.id);
            const updateData: { status: Order['status'], deliveryPhotoUrl?: string } = { status };
            if (deliveryPhotoUrl) {
                updateData.deliveryPhotoUrl = deliveryPhotoUrl;
            }

            await setDoc(orderRef, updateData, { merge: true });

            const admins = users?.filter(u => u.role === 'admin');
            if (admins) {
                for (const admin of admins) {
                    await createNotification(
                        firestore,
                        admin.id,
                        'Order Status Updated',
                        `Order #${order.id} is now ${status}.`
                    );
                }
            }

            toast({
                title: "Order Updated",
                description: `Order #${order.id} marked as ${status}.`
            })
        } catch (e: any) {
            toast({
                variant: 'destructive',
                title: "Error",
                description: e.message
            })
        }
    };

    if (ordersLoading || usersLoading || notificationsLoading) {
        return <div className="container mx-auto px-4 py-8"><p>Loading deliveries...</p></div>
    }

    const inProgressOrders = assignedOrders?.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');
    const completedOrders = assignedOrders?.filter(o => o.status === 'DELIVERED' || o.status === 'CANCELLED');

    return (
        <div className="container mx-auto px-4 py-8">
            <h2 className="text-3xl font-bold font-headline mb-6">{t('myDeliveries', language)}</h2>
            <Tabs defaultValue="in-progress" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="in-progress">{t('inProgress', language)} ({inProgressOrders?.length || 0})</TabsTrigger>
                    <TabsTrigger value="completed">{t('completed', language)} ({completedOrders?.length || 0})</TabsTrigger>
                </TabsList>

                <TabsContent value="in-progress">
                    {inProgressOrders && inProgressOrders.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full space-y-4 mt-6">
                            {inProgressOrders.map(order => {
                                const user = users?.find(u => u.id === order.customerId);
                                if (!user) return null;
                                return (
                                    <AccordionItem key={order.id} value={order.id} className="border rounded-lg bg-card">
                                        <AccordionTrigger className="px-4 md:px-6 hover:no-underline">
                                            <div className="flex justify-between w-full items-center">
                                                <div className="text-left">
                                                    <p className="font-semibold">{user.name}</p>
                                                    <p className="text-sm text-muted-foreground">#{order.id}</p>
                                                </div>
                                                <Badge variant={order.status === 'OUT_FOR_DELIVERY' ? 'default' : 'outline'}>{order.status}</Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-4 md:px-6 pb-4">
                                            <div className="space-y-4">
                                                <div>
                                                    <h4 className="font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {t('address', language)}</h4>
                                                    <p className="text-muted-foreground text-sm pl-6">{user.address}, {order.area}, {user.landmark}</p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <h4 className="font-semibold flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {t('contact', language)}</h4>
                                                    <Button asChild variant="link" className="p-0 h-auto">
                                                        <a href={`tel:${user.phone}`}>{user.phone}</a>
                                                    </Button>
                                                </div>
                                                <Separator />
                                                <div>
                                                    <h4 className="font-semibold mb-2">{t('items', language)}</h4>
                                                    <ul className="space-y-1 text-sm">
                                                        {order.items.map(item => {
                                                            const productName = language === 'te' && item.name_te ? item.name_te : (item.name || 'Unknown Item');
                                                            return (
                                                                <li key={item.productId} className="flex justify-between">
                                                                    <span>{productName}</span>
                                                                    <span className="text-muted-foreground">Qty: {item.qty}</span>
                                                                </li>
                                                            )
                                                        })}
                                                    </ul>
                                                </div>
                                                <Separator />
                                                <div className="text-right font-bold text-lg">
                                                    {t('total', language)}: {order.totalAmount} ({order.paymentMode})
                                                </div>
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    {(order.status === 'PENDING' || order.status === 'CONFIRMED') && (
                                                        <Button className="w-full" onClick={() => handleStartDelivery(order)}>
                                                            <Truck className="mr-2 h-4 w-4" /> {t('startDelivery', language)}
                                                        </Button>
                                                    )}
                                                    {order.status === 'OUT_FOR_DELIVERY' && (
                                                        <Button className="w-full" onClick={() => handleOpenPhotoUpload(order)}>
                                                            <CheckCircle className="mr-2 h-4 w-4" /> {t('markAsDelivered', language)}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    ) : (
                        <div className="text-center py-16 border-2 border-dashed rounded-lg mt-6">
                            <h3 className="text-xl font-semibold">{t('noDeliveriesInProgress', language)}</h3>
                            <p className="text-muted-foreground">{t('checkBackLater', language)}</p>
                        </div>
                    )}
                </TabsContent>
                <TabsContent value="completed">
                    {completedOrders && completedOrders.length > 0 ? (
                        <div className="space-y-4 mt-6">
                            {completedOrders.map(order => {
                                const user = users?.find(u => u.id === order.customerId);
                                return (
                                    <div key={order.id} className="p-4 border rounded-lg bg-card/50 flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold">{user?.name || "Unknown User"}</p>
                                            <p className="text-sm text-muted-foreground">#{order.id}</p>
                                            {order.deliveryPhotoUrl && (
                                                <Button variant="link" size="sm" className="h-auto p-0 mt-1" onClick={() => handleViewPhoto(order)}>
                                                    View Proof
                                                </Button>
                                            )}
                                        </div>
                                        <Badge variant={order.status === 'DELIVERED' ? 'default' : 'destructive'}>{order.status}</Badge>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-16 border-2 border-dashed rounded-lg mt-6">
                            <h3 className="text-xl font-semibold">{t('noCompletedDeliveries', language)}</h3>
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            <Dialog open={isPhotoUploadOpen} onOpenChange={setPhotoUploadOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-headline text-center flex items-center justify-center gap-2">
                            <ImageIcon className="h-6 w-6" /> Proof of Delivery
                        </DialogTitle>
                    </DialogHeader>
                    <PhotoUpload onSubmit={handlePhotoSubmit} />
                </DialogContent>
            </Dialog>

            <Dialog open={isViewPhotoOpen} onOpenChange={setViewPhotoOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Proof of Delivery</DialogTitle>
                        <DialogDescription>
                            Order #{selectedOrderForPhoto?.id}
                        </DialogDescription>
                    </DialogHeader>
                    {selectedOrderForPhoto?.deliveryPhotoUrl && (
                        <div className="relative aspect-video w-full rounded-md overflow-hidden border mt-4">
                            <Image src={selectedOrderForPhoto.deliveryPhotoUrl} alt="Proof of delivery" fill className="object-contain" />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
