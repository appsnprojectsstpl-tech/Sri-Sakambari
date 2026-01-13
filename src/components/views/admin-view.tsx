
'use client';
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Product, User, Role, Order, Subscription, Notification, Coupon } from '@/lib/types';
import { Trash2 } from 'lucide-react';
import { PlusCircle } from 'lucide-react';
import { FilePen } from 'lucide-react';
import { Upload } from 'lucide-react';
import { Download } from 'lucide-react';
import { Search } from 'lucide-react';
import { MapPin } from 'lucide-react';
import { CheckCircle } from 'lucide-react';
import { XCircle } from 'lucide-react';
import { Clock } from 'lucide-react';
import { Truck } from 'lucide-react';
import { Terminal } from 'lucide-react';
import { Mail } from 'lucide-react';
import { Phone } from 'lucide-react';
import { ExternalLink } from 'lucide-react';
import { Copy } from 'lucide-react';
import { Database } from 'lucide-react';
import { Bell } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import Image from 'next/image';
import { useAuth, useFirestore, createUser, useCollection, createNotification, useInfiniteCollection, fetchCollection } from '@/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { products as seedProducts } from '@/lib/seed-data';
import { useLanguage } from '@/context/language-context';
import { t, getProductName } from '@/lib/translations';
import { Textarea } from '../ui/textarea';
import { exportOrdersToExcel } from '@/lib/excel-utils';


const initialProductState: Omit<Product, 'id' | 'createdAt' | 'name_te'> = {
  name: '',
  category: '',
  pricePerUnit: 0,
  unit: '',
  isActive: true,
  imageUrl: '',
  imageHint: '',
  displayOrder: 0,
  isCutVegetable: false,
  cutCharge: 0,
}

const initialUserState = {
  name: '',
  email: '',
  phone: '',
  role: 'delivery' as Role,
  address: '',
  area: '',
  landmark: '',
  pincode: '',
  password: ''
}

const initialCouponState: Partial<Coupon> = {
  code: '',
  type: 'FLAT',
  value: 0,
  minOrderValue: 0,
  maxDiscount: 0,
  isActive: true,
  usageLimit: 100,
  usedCount: 0,
  startDate: new Date().toISOString().split('T')[0],
  expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  description: ''
}

export default function AdminView({ user: adminUser }: { user: User }) {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { language } = useLanguage();

  const { data: users, loading: usersLoading, error: usersError } = useCollection<User>('users');

  // Notifications Logic
  const { data: notifications } = useCollection<Notification>('notifications', {
    constraints: [
      ['where', 'userId', '==', auth?.currentUser?.uid || ''],
      ['orderBy', 'createdAt', 'desc'],
      ['limit', 50]
    ]
  });

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  const markAsRead = async (id: string) => {
    if (!firestore) return;
    await setDoc(doc(firestore, 'notifications', id), { isRead: true }, { merge: true });
  };

  const markAllRead = async () => {
    if (!firestore || !notifications) return;
    const batch = writeBatch(firestore);
    notifications.forEach(n => {
      if (!n.isRead) {
        batch.update(doc(firestore, 'notifications', n.id), { isRead: true });
      }
    });
    await batch.commit();
  };
  const { data: products, loading: productsLoading, error: productsError, forceRefetch } = useCollection<Product>('products');
  const {
    data: orders,
    loading: ordersLoading,
    isFetchingMore: ordersFetchingMore,
    error: ordersError,
    loadMore: loadMoreOrders,
    hasMore: hasMoreOrders
  } = useInfiniteCollection<Order>('orders', {
    constraints: [['orderBy', 'createdAt', 'desc']],
    initialLimit: 20,
    batchSize: 20
  });
  const { data: subscriptions, loading: subscriptionsLoading, error: subscriptionsError } = useCollection<Subscription>('subscriptions');
  const { data: areas, loading: areasLoading, error: areasError } = useCollection<any>('areas');
  const { data: coupons, loading: couponsLoading, error: couponsError } = useCollection<Coupon>('coupons');



  const [isProductDialogOpen, setProductDialogOpen] = useState(false);
  const [isUserDialogOpen, setUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [isOrderDetailOpen, setOrderDetailOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isBulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [isSeedDialogOpen, setSeedDialogOpen] = useState(false);
  const [isClearProductsDialogOpen, setClearProductsDialogOpen] = useState(false);
  const [isCouponDialogOpen, setCouponDialogOpen] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingCoupon, setEditingCoupon] = useState<Partial<Coupon> | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newUser, setNewUser] = useState(initialUserState);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const deliveryStaff = users?.filter(u => u.role === 'delivery') || [];

  useEffect(() => {
    if (products) {
      const activeProducts = products.filter(p => p.isActive);
      const productList = activeProducts
        .map(p => `* ${getProductName(p, language)}: ${p.pricePerUnit}/${p.unit}`)
        .join('\n');

      const appUrl = window.location.origin;

      const message = `*Today's Fresh Stock - Shankari Devi Market*\n\n${productList}\n\n*Place your order now:*\n1. *Click here:* ${appUrl}\n2. *Or, reply to this message with your list!* (e.g., "Sweet Corn x 1, Milk x 2")`;

      setWhatsappMessage(message);
    }
  }, [products, language]);


  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductDialogOpen(true);
  }

  const handleAddNewProduct = () => {
    setEditingProduct(initialProductState);
    setProductDialogOpen(true);
  }

  const handleDeleteClick = (product: Product) => {
    setDeletingProduct(product);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!firestore || !deletingProduct) return;
    try {
      await deleteDoc(doc(firestore, 'products', deletingProduct.id));
      toast({
        title: 'Product Deleted',
        description: `${deletingProduct.name} has been removed.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error Deleting Product',
        description: error.message,
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingProduct(null);
    }
  };

  const handleProductFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !editingProduct) return;

    setLoading(true);

    const formData = new FormData(e.currentTarget as HTMLFormElement);

    // Construct product data from form
    const productData = {
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      pricePerUnit: parseFloat(formData.get('pricePerUnit') as string) || 0,
      unit: formData.get('unit') as string,
      imageUrl: formData.get('imageUrl') as string,
      isActive: formData.get('isActive') === 'on',
      isCutVegetable: formData.get('isCutVegetable') === 'on',
      cutCharge: parseFloat(formData.get('cutCharge') as string) || 0,
    };

    try {
      // Find a matching product in the seed data to get the pre-translated Telugu name
      const seedMatch = seedProducts.find(p => p.name.toLowerCase() === productData.name.toLowerCase());
      const translatedName = seedMatch?.name_te || '';

      const finalProductData = {
        ...productData,
        name_te: translatedName,
      };

      if ('id' in editingProduct && editingProduct.id) {
        // Editing an existing product
        const productRef = doc(firestore, 'products', editingProduct.id);
        await setDoc(productRef, finalProductData, { merge: true });
        toast({
          title: "Product Updated",
          description: `${productData.name} has been successfully updated.`,
        });
      } else {
        // Adding a new product
        const productsCollection = collection(firestore, 'products');
        const docRef = await addDoc(productsCollection, {
          ...finalProductData,
          createdAt: serverTimestamp(),
        });
        // Set the ID in the document itself for consistency
        await setDoc(docRef, { id: docRef.id }, { merge: true });
        toast({
          title: "Product Added",
          description: `${productData.name} has been added to the catalog.`,
        });
      }
      setProductDialogOpen(false); // Close the dialog on success

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error Saving Product",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewUser = () => {
    setNewUser(initialUserState);
    setUserDialogOpen(true);
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserDialogOpen(true);
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !editingUser) return;
    setLoading(true);
    try {
      const userRef = doc(firestore, 'users', editingUser.id);
      await setDoc(userRef, {
        name: editingUser.name,
        phone: editingUser.phone,
        role: editingUser.role,
      }, { merge: true });

      if (editingUser.role === 'admin') {
        const adminRoleRef = doc(firestore, 'roles_admin', editingUser.id);
        await setDoc(adminRoleRef, { assignedAt: new Date() }, { merge: true });
      }


      toast({
        title: "User Updated",
        description: `${editingUser.name}'s details have been updated.`,
      });
      setEditUserDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating user",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
    setLoading(true);
    try {
      await createUser(auth, firestore, { ...newUser });
      toast({
        title: "User Created",
        description: `${newUser.name} has been added as a ${newUser.role}.`,
      });
      setUserDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error creating user",
        description: error.message,
      });
      setLoading(false);
    }
  }

  const handleAddNewCoupon = () => {
    setEditingCoupon(initialCouponState);
    setCouponDialogOpen(true);
  }

  const handleEditCoupon = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCouponDialogOpen(true);
  }

  const handleDeleteCoupon = async (id: string) => {
    if (!firestore || !confirm("Are you sure you want to delete this coupon?")) return;
    try {
      await deleteDoc(doc(firestore, 'coupons', id));
      toast({ title: "Coupon Deleted" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  }

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !editingCoupon) return;
    setLoading(true);

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const couponData = {
      code: (formData.get('code') as string).toUpperCase(),
      type: formData.get('type') as 'FLAT' | 'PERCENTAGE',
      value: parseFloat(formData.get('value') as string) || 0,
      minOrderValue: parseFloat(formData.get('minOrderValue') as string) || 0,
      maxDiscount: parseFloat(formData.get('maxDiscount') as string) || 0,
      usageLimit: parseInt(formData.get('usageLimit') as string) || 0,
      startDate: formData.get('startDate') as string,
      expiryDate: formData.get('expiryDate') as string,
      isActive: formData.get('isActive') === 'on',
      description: formData.get('description') as string,
      usedCount: editingCoupon.usedCount || 0
    };

    try {
      if (editingCoupon.id) {
        await setDoc(doc(firestore, 'coupons', editingCoupon.id), couponData, { merge: true });
        toast({ title: "Coupon Updated" });
      } else {
        await addDoc(collection(firestore, 'coupons'), {
          ...couponData,
          createdAt: serverTimestamp()
        });
        toast({ title: "Coupon Created" });
      }
      setCouponDialogOpen(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  }

  const handleAssignDeliveryPartner = async (orderId: string, partner: User) => {
    if (!firestore || !auth?.currentUser) return;
    try {
      const orderRef = doc(firestore, 'orders', orderId);
      const currentOrder = orders?.find(o => o.id === orderId);
      const newStatus = currentOrder?.status === 'PENDING' ? 'CONFIRMED' : currentOrder?.status;

      await setDoc(orderRef, {
        deliveryPartnerId: partner.id,
        status: newStatus
      }, { merge: true });

      await createNotification(
        firestore,
        partner.id,
        'New Order Assigned',
        `You have been assigned a new order: #${orderId}`
      );

      toast({
        title: 'Delivery Partner Assigned',
        description: `${partner.name} has been assigned to order #${orderId}`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Assignment Failed',
        description: error.message,
      });
    }
  };

  const handleViewOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setOrderDetailOpen(true);
  }

  const handleCopyWhatsapp = () => {
    navigator.clipboard.writeText(whatsappMessage);
    toast({ title: 'Message Copied!' });
  }

  const handleOpenWhatsapp = () => {
    window.open('https://web.whatsapp.com', '_blank');
  }

  const handleStatusChange = async (orderId: string, newStatus: Order['status']) => {
    if (!firestore || !selectedOrder) return;

    try {
      // 1. Update Order
      await setDoc(doc(firestore, 'orders', orderId), { status: newStatus }, { merge: true });

      // 2. Update Local State
      setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);

      // 3. Notify Customer
      await addDoc(collection(firestore, 'notifications'), {
        userId: selectedOrder.customerId,
        title: `Order Update: ${newStatus.replace(/_/g, ' ')}`,
        message: `Your Order #${orderId} is now ${newStatus.toLowerCase().replace(/_/g, ' ')}.`,
        isRead: false,
        createdAt: serverTimestamp(),
        type: 'order',
        linkId: orderId
      });

      toast({ title: 'Status Updated', description: `Order marked as ${newStatus}` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    }
  };

  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !firestore) return;

    setLoading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      const text = e.target?.result;
      if (typeof text !== 'string') {
        toast({ variant: 'destructive', title: 'Error reading file' });
        setLoading(false);
        return;
      }

      const lines = text.split('\n').filter(line => line.trim() !== '');
      const headers = lines.shift()?.trim().toLowerCase().split(',') || [];

      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;
      const totalProducts = lines.length;

      try {
        const batch = writeBatch(firestore);

        for (let i = 0; i < totalProducts; i++) {
          const line = lines[i];
          const values = line.trim().split(',');
          const productData: any = {};
          headers.forEach((header, index) => {
            const key = header.trim();
            const value = values[index]?.trim();
            if (['priceperunit', 'displayorder', 'cutcharge'].includes(key)) {
              productData[key] = parseFloat(value || '0');
            } else if (['isactive', 'iscutvegetable'].includes(key)) {
              productData[key] = value?.toLowerCase() === 'true';
            } else {
              productData[key] = value;
            }
          });

          if (!productData.name || productData.name === '') {
            skippedCount++;
            continue;
          }

          // Match with seed data to find telugu name
          const seedMatch = seedProducts.find(p => p.name.toLowerCase() === productData.name.toLowerCase());

          const newProductDoc = doc(collection(firestore, 'products'));
          batch.set(newProductDoc, {
            ...productData,
            id: newProductDoc.id,
            name_te: seedMatch ? seedMatch.name_te : '', // Use pre-translated name
            createdAt: serverTimestamp(),
          });
          successCount++;
        }

        await batch.commit();

        toast({
          title: 'Bulk Upload Complete',
          description: `${successCount} products added. ${errorCount} failed. ${skippedCount} skipped.`,
        });
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Bulk Upload Failed',
          description: error.message,
        });
      } finally {
        setLoading(false);
        setBulkUploadOpen(false);
        forceRefetch(); // Force a refetch of the products list
      }
    };

    reader.readAsText(file);
  };

  const handleSeedDatabase = async () => {
    if (!firestore) return;
    setLoading(true);
    try {
      const batch = writeBatch(firestore);
      seedProducts.forEach(product => {
        const docRef = doc(firestore, 'products', product.id);
        // The createdAt field in the seed is a JS Date, Firestore handles conversion
        batch.set(docRef, product, { merge: true });
      });
      await batch.commit();
      toast({
        title: 'Database Seeded',
        description: `${seedProducts.length} products have been updated/added in Firestore.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Seeding Failed',
        description: error.message,
      });
    } finally {
      setLoading(false);
      setSeedDialogOpen(false);
    }
  };

  const handleClearAllProducts = async () => {
    if (!firestore) return;
    setLoading(true);
    try {
      const productsRef = collection(firestore, 'products');
      const querySnapshot = await getDocs(productsRef);
      const batch = writeBatch(firestore);
      let deletedCount = 0;
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        deletedCount++;
      });
      await batch.commit();
      toast({
        title: 'All Products Deleted',
        description: `${deletedCount} products have been removed. The page will now refresh.`,
      });
      // Force a refetch after clearing
      forceRefetch();

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Clearing Failed',
        description: error.message,
      });
    } finally {
      setLoading(false);
      setClearProductsDialogOpen(false);
    }
  };


  // Helper function to validate URL
  const isValidUrl = (url: string | undefined | null): boolean => {
    if (!url) return false;
    try {
      new URL(url);
      return url.startsWith('http://') || url.startsWith('https://');
    } catch (_) {
      return false;
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    try {
      const storage = getStorage();
      const newImageUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        newImageUrls.push(url);
      }

      setEditingProduct(prev => {
        if (!prev) return { ...initialProductState, imageUrl: newImageUrls[0], images: newImageUrls };

        const existingImages = 'images' in prev && Array.isArray(prev.images) ? prev.images : (prev.imageUrl ? [prev.imageUrl] : []);
        const updatedImages = [...existingImages, ...newImageUrls];

        return {
          ...prev,
          imageUrl: updatedImages[0] || '', // Keep primary image synced
          images: updatedImages
        };
      });

      toast({
        title: t('imageUploaded', language),
        description: `${newImageUrls.length} image(s) uploaded successfully`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message,
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (indexToRemove: number) => {
    setEditingProduct(prev => {
      if (!prev) return null;
      // Safety check for existing images
      const currentImages = 'images' in prev && Array.isArray(prev.images)
        ? prev.images
        : (prev.imageUrl ? [prev.imageUrl] : []);

      const updatedImages = currentImages.filter((_, index) => index !== indexToRemove);

      return {
        ...prev,
        imageUrl: updatedImages.length > 0 ? updatedImages[0] : '',
        images: updatedImages
      };
    });
  };

  const handleExportClick = async () => {
    if (!firestore) return;
    setExporting(true);
    try {
      // Fetch all orders and users fresh for export
      const allOrders = await fetchCollection<Order>(firestore, 'orders', [['orderBy', 'createdAt', 'desc']]);
      const allUsers = await fetchCollection<User>(firestore, 'users');

      exportOrdersToExcel(allOrders, allUsers);
      toast({ title: 'Export Complete', description: `Exported ${allOrders.length} orders.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Export Failed', description: e.message });
    } finally {
      setExporting(false);
    }
  };


  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold font-headline">{t('adminDashboard', language)}</h2>

        {/* Notification Bell */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex items-center justify-between p-4 border-b">
              <h4 className="font-semibold">Notifications</h4>
              {unreadCount > 0 && <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs h-auto py-1">Mark all read</Button>}
            </div>
            <ScrollArea className="h-[300px]">
              {notifications && notifications.length > 0 ? (
                <div className="divide-y">
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${!n.isRead ? 'bg-primary/5' : ''}`}
                      onClick={() => markAsRead(n.id)}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <h5 className={`text-sm ${!n.isRead ? 'font-bold' : 'font-medium'}`}>{n.title}</h5>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {n.createdAt ? (typeof (n.createdAt as any).toDate === 'function' ? (n.createdAt as any).toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : 'Just now'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No notifications
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 h-auto">
          <TabsTrigger value="products">{t('products', language)}</TabsTrigger>
          <TabsTrigger value="orders">{t('orders', language)}</TabsTrigger>
          <TabsTrigger value="subscriptions">{t('subscriptions', language)}</TabsTrigger>
          <TabsTrigger value="users">{t('users', language)}</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <div className="flex justify-end items-center my-4 gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setClearProductsDialogOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Clear All Products
            </Button>
            <Button variant="outline" onClick={() => setSeedDialogOpen(true)}>
              <Database className="mr-2 h-4 w-4" /> Seed Database
            </Button>
            <Button variant="outline" onClick={() => setBulkUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Bulk Upload
            </Button>
            <Button onClick={handleAddNewProduct}><PlusCircle className="mr-2 h-4 w-4" /> {t('addNewProduct', language)}</Button>
          </div>
          {productsError && (
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Error Loading Products</AlertTitle>
              <AlertDescription>{productsError.message}</AlertDescription>
            </Alert>
          )}
          {productsLoading ? (<p>Loading products...</p>) : (
            <>
              <div className="md:hidden space-y-4">
                {(products || []).map((product) => {
                  const imageUrl = isValidUrl(product.imageUrl) ? product.imageUrl : `https://picsum.photos/seed/${product.id}/60/45`;
                  return (
                    <Card key={product.id}>
                      <CardContent className="flex gap-4 p-4">
                        <Image src={imageUrl} alt={product.name} width={60} height={45} className="rounded-md object-cover aspect-[4/3]" data-ai-hint={product.imageHint || ''} />
                        <div className="flex-1">
                          <p className="font-semibold">{getProductName(product, language)}</p>
                          <p className="text-sm text-muted-foreground">{product.category}</p>
                          <p className="text-sm">{product.pricePerUnit} / {product.unit}</p>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <Badge variant={product.isActive ? 'default' : 'destructive'}>{product.isActive ? 'Active' : 'Inactive'}</Badge>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditProduct(product)}><FilePen className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteClick(product)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(products || []).map((product) => {
                    const imageUrl = isValidUrl(product.imageUrl) ? product.imageUrl : `https://picsum.photos/seed/${product.id}/40/30`;
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <Image src={imageUrl} alt={product.name} width={40} height={30} className="rounded-md object-cover" data-ai-hint={product.imageHint || ''} />
                        </TableCell>
                        <TableCell>{getProductName(product, language)}</TableCell>
                        <TableCell>{product.category}</TableCell>
                        <TableCell>{product.pricePerUnit} / {product.unit}</TableCell>
                        <TableCell><Badge variant={product.isActive ? 'default' : 'destructive'}>{product.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditProduct(product)}><FilePen className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteClick(product)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </>
          )}
        </TabsContent>

        <TabsContent value="orders">
          <div className="flex justify-end my-4">
            <Button onClick={handleExportClick} disabled={ordersLoading || exporting}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {exporting ? 'Exporting...' : 'Export to Excel'}
            </Button>
          </div>
          {ordersLoading ? <p>Loading orders...</p> : (
            <>
              <div className="md:hidden space-y-4 mt-4">
                {(orders || []).map((order) => {
                  const customer = users?.find(u => u.id === order.customerId);
                  const partner = users?.find(u => u.id === order.deliveryPartnerId);
                  return (
                    <Card key={order.id} onClick={() => handleViewOrderDetails(order)}>
                      <CardHeader>
                        <CardTitle className="text-base flex justify-between">
                          <span>{customer?.name || 'Unknown User'}</span>
                          <span>{order.totalAmount}</span>
                        </CardTitle>
                        <CardDescription>#{order.id}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm font-medium">Area: <span className="font-normal text-muted-foreground">{order.area}</span></p>
                          <div>Status: <Badge>{order.status}</Badge></div>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">Delivery Partner</p>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" className="w-full justify-between" onClick={(e) => e.stopPropagation()}>
                                {partner ? partner.name : 'Assign'}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                              {deliveryStaff.map(staff => (
                                <DropdownMenuItem key={staff.id} onSelect={() => handleAssignDeliveryPartner(order.id, staff)}>
                                  {staff.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Delivery Partner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(orders || []).map((order) => {
                    const customer = users?.find(u => u.id === order.customerId);
                    const partner = users?.find(u => u.id === order.deliveryPartnerId);
                    return (
                      <TableRow key={order.id} onClick={() => handleViewOrderDetails(order)} className="cursor-pointer">
                        <TableCell className="font-mono text-xs">{order.id}</TableCell>
                        <TableCell>{customer?.name || order.customerId}</TableCell>
                        <TableCell>{order.area}</TableCell>
                        <TableCell>{order.totalAmount}</TableCell>
                        <TableCell><Badge>{order.status}</Badge></TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                {partner ? partner.name : 'Assign'}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {deliveryStaff.map(staff => (
                                <DropdownMenuItem key={staff.id} onSelect={() => handleAssignDeliveryPartner(order.id, staff)}>
                                  {staff.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {hasMoreOrders && (
                <div className="flex justify-center mt-4 mb-8">
                  <Button variant="outline" onClick={loadMoreOrders} disabled={ordersFetchingMore}>
                    {ordersFetchingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Load More Orders
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="subscriptions">
          {subscriptionsLoading ? <p>Loading subscriptions...</p> : (
            <>
              <div className="md:hidden space-y-4 mt-4">
                {(subscriptions || []).map((sub) => {
                  const customer = users?.find(u => u.id === sub.customerId);
                  return (
                    <Card key={sub.id}>
                      <CardHeader>
                        <CardTitle className="text-base flex justify-between">
                          <span>{sub.planName}</span>
                          <Badge variant={sub.isActive ? 'default' : 'secondary'}>{sub.isActive ? 'Active' : 'Paused'}</Badge>
                        </CardTitle>
                        <CardDescription>{customer?.name || sub.customerId}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm font-medium">Frequency: <span className="font-normal text-muted-foreground">{sub.frequency}</span></p>
                        <p className="text-sm font-medium">Area: <span className="font-normal text-muted-foreground">{sub.area}</span></p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan Name</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(subscriptions || []).map((sub) => {
                    const customer = users?.find(u => u.id === sub.customerId);
                    return (
                      <TableRow key={sub.id}>
                        <TableCell>{sub.planName}</TableCell>
                        <TableCell>{customer?.name || sub.customerId}</TableCell>
                        <TableCell>{sub.frequency}</TableCell>
                        <TableCell>{sub.area}</TableCell>
                        <TableCell><Badge variant={sub.isActive ? 'default' : 'secondary'}>{sub.isActive ? 'Active' : 'Paused'}</Badge></TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </>
          )}
        </TabsContent>

        <TabsContent value="users">
          <div className="flex justify-end my-4">
            <Button onClick={handleAddNewUser}><PlusCircle className="mr-2 h-4 w-4" /> Add New User</Button>
          </div>
          {usersError && (
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Error Loading Users</AlertTitle>
              <AlertDescription>{usersError.message}</AlertDescription>
            </Alert>
          )}
          {usersLoading ? (<p>Loading users...</p>) : (
            <>
              <div className="md:hidden space-y-4">
                {(users || []).map((user) => (
                  <Card key={user.id}>
                    <CardHeader>
                      <CardTitle className="text-base flex justify-between items-center">
                        <span>{user.name}</span>
                        <Badge variant={user.role === 'admin' ? 'default' : (user.role === 'delivery' ? 'secondary' : 'outline')}>{user.role}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4" />{user.email}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2"><Phone className="h-4 w-4" />{user.phone}</div>
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => handleEditUser(user)}><FilePen className="mr-2 h-4 w-4" />Edit User</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(users || []).map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phone}</TableCell>
                      <TableCell><Badge variant={user.role === 'admin' ? 'default' : (user.role === 'delivery' ? 'secondary' : 'outline')}>{user.role}</Badge></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}><FilePen className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </TabsContent>

        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Marketing Message</CardTitle>
              <CardDescription>Copy this message to share the daily stock update with customers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={whatsappMessage}
                className="min-h-[300px] font-mono text-sm"
                readOnly
              />
              <div className="flex gap-4">
                <Button onClick={handleCopyWhatsapp} className="flex-1">
                  <Copy className="mr-2 h-4 w-4" /> Copy Message
                </Button>
                <Button onClick={handleOpenWhatsapp} variant="outline" className="flex-1">
                  <ExternalLink className="mr-2 h-4 w-4" /> Open WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Coupon Dialog */}
      <Dialog open={isCouponDialogOpen} onOpenChange={setCouponDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCoupon?.id ? 'Edit Coupon' : 'Create New Coupon'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCoupon} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Coupon Code</Label>
                <Input name="code" defaultValue={editingCoupon?.code} placeholder="SUMMER50" required />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select name="type" defaultValue={editingCoupon?.type || 'FLAT'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FLAT">Flat Amount (₹)</SelectItem>
                    <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Value</Label>
                <Input name="value" type="number" defaultValue={editingCoupon?.value} required />
              </div>
              <div className="space-y-2">
                <Label>Min Order Value</Label>
                <Input name="minOrderValue" type="number" defaultValue={editingCoupon?.minOrderValue} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Discount (for %)</Label>
                <Input name="maxDiscount" type="number" defaultValue={editingCoupon?.maxDiscount} />
              </div>
              <div className="space-y-2">
                <Label>Usage Limit</Label>
                <Input name="usageLimit" type="number" defaultValue={editingCoupon?.usageLimit} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input name="startDate" type="date" defaultValue={editingCoupon?.startDate} required />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input name="expiryDate" type="date" defaultValue={editingCoupon?.expiryDate} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input name="description" defaultValue={editingCoupon?.description} placeholder="e.g. 50% off for new users" />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="isActive" name="isActive" defaultChecked={editingCoupon?.isActive} />
              <Label htmlFor="isActive">Active</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCouponDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Coupon
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isProductDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline">{'id' in (editingProduct || {}) ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleProductFormSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={editingProduct && 'name' in editingProduct ? editingProduct.name : ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select name="category" defaultValue={editingProduct && 'category' in editingProduct ? editingProduct.category : ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {['Vegetables', 'Fruits', 'Dairy', 'Subscription'].map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pricePerUnit">Price</Label>
                  <Input id="pricePerUnit" name="pricePerUnit" type="number" step="0.01" defaultValue={editingProduct && 'pricePerUnit' in editingProduct ? editingProduct.pricePerUnit : 0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Input id="unit" name="unit" defaultValue={editingProduct && 'unit' in editingProduct ? editingProduct.unit : ''} placeholder="e.g., kg, packet" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="imageUrl">Image URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="imageUrl"
                    name="imageUrl"
                    placeholder="https://..."
                    defaultValue={editingProduct?.imageUrl || ''}
                    value={editingProduct?.imageUrl || ''}
                    onChange={(e) => setEditingProduct(prev => prev ? { ...prev, imageUrl: e.target.value } : null)}
                  />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Label htmlFor="imageUpload" className="cursor-pointer flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:opacity-80 transition-opacity">
                    <Upload className="w-4 h-4" />
                    {uploadingImage ? t('uploading', language) : "Upload Images"}
                  </Label>
                  <Input
                    id="imageUpload"
                    type="file"
                    accept="image/*"
                    multiple // Allow multiple files
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                  />
                </div>

                {/* Image Gallery */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {editingProduct && (
                    ('images' in editingProduct && Array.isArray(editingProduct.images) ? editingProduct.images : (editingProduct.imageUrl ? [editingProduct.imageUrl] : [])).map((url, index) => (
                      <div key={url} className="relative aspect-square bg-muted rounded-md overflow-hidden group">
                        <Image src={url} alt={`Product ${index + 1}`} fill className="object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove Image"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="isActive" name="isActive" defaultChecked={editingProduct ? ('isActive' in editingProduct ? editingProduct.isActive : true) : true} />
                <Label htmlFor="isActive">Product is active</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="isCutVegetable" name="isCutVegetable" defaultChecked={editingProduct ? ('isCutVegetable' in editingProduct ? editingProduct.isCutVegetable : false) : false} />
                <Label htmlFor="isCutVegetable">Cutting service available</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cutCharge">Cut Charge</Label>
                <Input id="cutCharge" name="cutCharge" type="number" step="0.01" defaultValue={editingProduct && 'cutCharge' in editingProduct ? editingProduct.cutCharge : 0} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProductDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isUserDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline">Add New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-name">Name</Label>
                <Input id="new-name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-email">Email</Label>
                <Input id="new-email" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Password</Label>
                <Input id="new-password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-phone">Phone</Label>
                <Input id="new-phone" type="tel" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role">Role</Label>
                <Select value={newUser.role} onValueChange={(value: Role) => setNewUser({ ...newUser, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="delivery">Delivery Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-address">Address</Label>
                <Input id="new-address" value={newUser.address} onChange={(e) => setNewUser({ ...newUser, address: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-area">Area</Label>
                <Select required onValueChange={(value) => setNewUser({ ...newUser, area: value })} value={newUser.area}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    {(areas || []).map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pincode">Pincode</Label>
                <Input id="new-pincode" value={newUser.pincode} onChange={(e) => setNewUser({ ...newUser, pincode: e.target.value })} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUserDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create User'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline">Edit User</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleUpdateUser}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input id="edit-name" value={editingUser.name} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input id="edit-email" type="email" value={editingUser.email} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input id="edit-phone" type="tel" value={editingUser.phone} onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Role</Label>
                  <Select value={editingUser.role} onValueChange={(value: Role) => setEditingUser({ ...editingUser, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="delivery">Delivery Staff</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditUserDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={loading}>{loading ? 'Updating...' : 'Save Changes'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isOrderDetailOpen} onOpenChange={setOrderDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order #{selectedOrder?.id}</DialogTitle>
            <DialogDescription>
              Placed on {selectedOrder && new Date(selectedOrder.createdAt as any).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && users && products && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Customer Details</h3>
                  <div>{users.find(u => u.id === selectedOrder.customerId)?.name}</div>
                  <div>{users.find(u => u.id === selectedOrder.customerId)?.address}</div>
                  <div>{selectedOrder.area}</div>
                  <div>{users.find(u => u.id === selectedOrder.customerId)?.phone}</div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Order Summary</h3>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">Status:</span>
                    <Select
                      value={selectedOrder.status}
                      onValueChange={(val: Order['status']) => handleStatusChange(selectedOrder.id, val)}
                    >
                      <SelectTrigger className="h-8 w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="ACCEPTED">Accepted</SelectItem>
                        <SelectItem value="PREPARING">Preparing</SelectItem>
                        <SelectItem value="OUT_FOR_DELIVERY">Out for Delivery</SelectItem>
                        <SelectItem value="DELIVERED">Delivered</SelectItem>
                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>Total: {selectedOrder.totalAmount}</div>
                  <div>Payment: {selectedOrder.paymentMode}</div>
                  <div>Delivery Partner: {users.find(u => u.id === selectedOrder.deliveryPartnerId)?.name || 'Not Assigned'}</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Items</h3>
                <ul className="space-y-1 text-sm">
                  {selectedOrder.items.map(item => {
                    const product = products.find(p => p.id === item.productId);
                    return (
                      <li key={item.productId} className="flex justify-between">
                        <span>{product ? getProductName(product, language) : 'Unknown Item'}</span>
                        <span className="text-muted-foreground">
                          {item.qty} x {item.priceAtOrder.toFixed(2)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {selectedOrder.deliveryPhotoUrl && (
                <div>
                  <h3 className="font-semibold mb-2">Proof of Delivery</h3>
                  <div className="relative aspect-video w-full rounded-md overflow-hidden border">
                    <Image src={selectedOrder.deliveryPhotoUrl} alt="Proof of delivery" fill className="object-contain" />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the product
              <span className="font-semibold"> {deletingProduct?.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isBulkUploadOpen} onOpenChange={setBulkUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Upload Products</DialogTitle>
            <DialogDescription>
              Upload a CSV file to add multiple products at once. The CSV must have the following headers:
              <code className="p-1 bg-muted rounded-sm text-xs">name,category,pricePerUnit,unit,isActive,imageUrl,imageHint,displayOrder</code>
            </DialogDescription>
          </DialogHeader>
          <div className="grid w-full max-w-sm items-center gap-1.5 py-4">
            <Label htmlFor="csv-upload">CSV File</Label>
            <Input id="csv-upload" type="file" accept=".csv" onChange={handleBulkUpload} disabled={loading} />
          </div>
          {loading && <p className="text-sm text-muted-foreground">Uploading and processing... This may take a moment.</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkUploadOpen(false)} disabled={loading}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isSeedDialogOpen} onOpenChange={setSeedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Seed Database?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite existing products in Firestore with the same ID and add all products from the local seed file. This action is recommended to get your app running but cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSeedDatabase}>Seed Database</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isClearProductsDialogOpen} onOpenChange={setClearProductsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Products?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all products from your database. Are you absolutely sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAllProducts} disabled={loading}>
              {loading ? 'Clearing...' : 'Yes, Clear All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
