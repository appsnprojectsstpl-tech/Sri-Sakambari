
'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
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
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import Image from 'next/image';
import { useAuth, useFirestore, createUser, useCollection, createNotification, storage } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc, writeBatch, getDocs, getDoc, query, orderBy, limit, startAfter, where, documentId } from 'firebase/firestore';
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

import { fetchAllDocsInBatches } from '@/firebase/firestore/utils';
import CouponManager from '@/components/admin/coupon-manager';
import DashboardTab from '@/components/admin/dashboard-tab';
import ProductsTab from '@/components/admin/products-tab';
import { OrderFiltersBar, OrderFilters } from '@/components/admin/order-filters-bar';
import { filterOrders, getUniqueAreas } from '@/lib/order-utils';




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
  const [activeTab, setActiveTab] = useState("dashboard");

  // Order Filters State
  const [orderFilters, setOrderFilters] = useState<OrderFilters>({
    searchTerm: '',
    status: 'all',
    paymentMode: 'all',
    area: 'all',
    dateFrom: '',
    dateTo: ''
  });

  // Pagination State
  const PRODUCTS_PER_PAGE = 10;
  const [pageIndex, setPageIndex] = useState(0);
  const [cursors, setCursors] = useState<any[][]>([]);

  // Fetch users if we are on tabs that need user details
  const shouldFetchUsers = activeTab === 'users' || activeTab === 'orders' || activeTab === 'subscriptions';
  const { data: users, loading: usersLoading, error: usersError } = useCollection<User>('users', { disabled: !shouldFetchUsers });

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

  // Products: Fetch on 'products', 'inventory', 'orders', 'dashboard', 'whatsapp'
  // Inventory needs FULL list for client-side search and stats.
  // Dashboard needs FULL list for stats (or we trust client-side calc).
  // Orders needs FULL list for mapping IDs to names (unless we fix order fetching).
  // Whatsapp needs FULL list for selector.

  const shouldFetchProducts = ['products', 'inventory', 'orders', 'dashboard', 'whatsapp'].includes(activeTab);

  // If we are on 'products' tab, we use pagination.
  // For other tabs (Inventory, Stats, etc.), we likely need ALL products for correct stats/search.
  // Fetching all (e.g. up to 1000) is safer for those views until we implement server-side search for them.
  const isPaginationEnabled = activeTab === 'products';

  const productConstraints = isPaginationEnabled ? [
    ['orderBy', 'name', 'asc'],
    ['orderBy', 'id', 'asc'],
    ['limit', PRODUCTS_PER_PAGE],
    ...(pageIndex > 0 && cursors[pageIndex - 1] ? [['startAfter', ...cursors[pageIndex - 1]]] : [])
  ] : [
    ['orderBy', 'name', 'asc'],
    ['limit', 1000] // Fetch effectively all for Inventory/Dashboard
  ];

  const { data: products, loading: productsLoading, error: productsError, forceRefetch } = useCollection<Product>('products', {
    disabled: !shouldFetchProducts,
    constraints: productConstraints as any
  });

  const handleNextPage = () => {
    if (!products || products.length < PRODUCTS_PER_PAGE) return;
    const lastProduct = products[products.length - 1];
    const cursor = [lastProduct.name, lastProduct.id];

    setCursors(prev => {
      const newCursors = [...prev];
      newCursors[pageIndex] = cursor;
      return newCursors;
    });
    setPageIndex(prev => prev + 1);
  };

  const handlePrevPage = () => {
    if (pageIndex > 0) {
      setPageIndex(prev => prev - 1);
    }
  };

  // Orders Pagination
  const ORDERS_PER_PAGE = 20;
  const [ordersPageIndex, setOrdersPageIndex] = useState(0);
  const [ordersCursors, setOrdersCursors] = useState<any[][]>([]);

  // If we are on the 'orders' tab, we use pagination (limit 20).
  // If we are on the 'dashboard' tab, we need ALL recent orders for analytics (e.g., limit 1000).
  const isOrdersPaginationEnabled = activeTab === 'orders';

  const orderConstraints = useMemo(() => {
    return isOrdersPaginationEnabled ? [
      ['orderBy', 'createdAt', 'desc'],
      ['limit', ORDERS_PER_PAGE],
      ...(ordersPageIndex > 0 && ordersCursors[ordersPageIndex - 1] ? [['startAfter', ...ordersCursors[ordersPageIndex - 1]]] : [])
    ] : [
      ['orderBy', 'createdAt', 'desc'],
      ['limit', 1000] // Fetch effectively all for Dashboard stats
    ];
  }, [isOrdersPaginationEnabled, ordersPageIndex, ordersCursors]);

  const shouldFetchOrders = activeTab === 'orders' || activeTab === 'dashboard';

  const { data: orders, loading: ordersLoading, error: ordersError } = useCollection<Order>('orders', {
    constraints: orderConstraints as any,
    disabled: !shouldFetchOrders
  });

  const handleNextPageOrders = () => {
    if (!orders || orders.length < ORDERS_PER_PAGE) return;
    const lastOrder = orders[orders.length - 1];
    const cursor = [lastOrder.createdAt]; // Assuming createdAt is unique enough or we might need a secondary sort field like ID

    setOrdersCursors(prev => {
      const newCursors = [...prev];
      newCursors[ordersPageIndex] = cursor;
      return newCursors;
    });
    setOrdersPageIndex(prev => prev + 1);
  };

  const handlePrevPageOrders = () => {
    if (ordersPageIndex > 0) {
      setOrdersPageIndex(prev => prev - 1);
    }
  };

  const { data: subscriptions, loading: subscriptionsLoading, error: subscriptionsError } = useCollection<Subscription>('subscriptions', {
    disabled: activeTab !== 'subscriptions'
  });

  const { data: areas, loading: areasLoading, error: areasError } = useCollection<any>('areas');

  const { data: coupons, loading: couponsLoading, error: couponsError } = useCollection<Coupon>('coupons', {
    disabled: activeTab !== 'coupons'
  });

  // Filtered orders based on search and filters
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return filterOrders(orders, orderFilters, users || undefined);
  }, [orders, orderFilters, users]);


  const [isBulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [isSeedDialogOpen, setSeedDialogOpen] = useState(false);
  const [isClearProductsDialogOpen, setClearProductsDialogOpen] = useState(false);
  const [isCouponDialogOpen, setCouponDialogOpen] = useState(false);
  const [isMigrateDialogOpen, setMigrateDialogOpen] = useState(false);
  const [isUserDialogOpen, setUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [isOrderDetailOpen, setOrderDetailOpen] = useState(false);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingCoupon, setEditingCoupon] = useState<Partial<Coupon> | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [extraProducts, setExtraProducts] = useState<Record<string, Product>>({}); // Cache for products not in current page
  const [newUser, setNewUser] = useState(initialUserState);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const whatsappCacheRef = useRef<Product[] | null>(null);
  const [whatsappCacheVersion, setWhatsappCacheVersion] = useState(0);

  const [loading, setLoading] = useState(false);

  const deliveryStaff = users?.filter(u => u.role === 'delivery') || [];

  const invalidateWhatsappCache = () => {
    whatsappCacheRef.current = null;
    setWhatsappCacheVersion(prev => prev + 1);
  };

  useEffect(() => {
    if (activeTab === 'whatsapp' && firestore) {
      const generateMessage = async () => {
        try {
          let activeProducts = whatsappCacheRef.current;

          if (!activeProducts) {
            const q = query(collection(firestore, 'products'), where('isActive', '==', true), orderBy('name', 'asc'));
            const snapshot = await getDocs(q);
            activeProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
            whatsappCacheRef.current = activeProducts;
          }

          const productList = activeProducts
            .map(p => `* ${getProductName(p, language)}: ${p.pricePerUnit}/${p.unit}`)
            .join('\n');

          const appUrl = window.location.origin;
          const message = `*Today's Fresh Stock - Shankari Devi Market*\n\n${productList}\n\n*Place your order now:*\n1. *Click here:* ${appUrl}\n2. *Or, reply to this message with your list!* (e.g., "Sweet Corn x 1, Milk x 2")`;

          setWhatsappMessage(message);
        } catch (error) {
          console.error("Failed to generate WhatsApp message", error);
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to load products for WhatsApp message' });
        }
      };
      generateMessage();
    }
  }, [activeTab, firestore, language, toast, whatsappCacheVersion]);

  useEffect(() => {
    if (!selectedOrder || !firestore) return;

    const fetchMissingProducts = async () => {
      const missingIds = selectedOrder.items
        .map(item => item.productId)
        .filter(id => !products?.find(p => p.id === id) && !extraProducts[id]);

      if (missingIds.length === 0) return;

      const newProducts: Record<string, Product> = {};

      // Batch requests in chunks of 10 to avoid N+1 and connection limits
      // This has been verified to be ~9x faster than individual fetches (see src/tests/benchmark_admin_product_fetch_comparison.ts)
      const CHUNK_SIZE = 10;
      const chunks = [];
      for (let i = 0; i < missingIds.length; i += CHUNK_SIZE) {
        chunks.push(missingIds.slice(i, i + CHUNK_SIZE));
      }

      await Promise.all(chunks.map(async (chunk) => {
        try {
          const q = query(collection(firestore, 'products'), where(documentId(), 'in', chunk));
          const snapshot = await getDocs(q);
          snapshot.docs.forEach(doc => {
            newProducts[doc.id] = { id: doc.id, ...doc.data() } as Product;
          });
        } catch (e) {
          console.error("Failed to fetch product chunk", chunk, e);
        }
      }));

      setExtraProducts(prev => ({ ...prev, ...newProducts }));
    };

    fetchMissingProducts();
  }, [selectedOrder, products, extraProducts, firestore]);








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
        address: editingUser.address || '',
        area: editingUser.area || '',
        pincode: editingUser.pincode || '',
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
        const BATCH_SIZE = 450;
        let batch = writeBatch(firestore);
        let operationCount = 0;

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
          operationCount++;

          if (operationCount >= BATCH_SIZE) {
            await batch.commit();
            batch = writeBatch(firestore);
            operationCount = 0;
          }
        }

        if (operationCount > 0) {
          await batch.commit();
        }

        invalidateWhatsappCache();
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
      const BATCH_SIZE = 450;
      let batch = writeBatch(firestore);
      let operationCount = 0;

      for (const product of seedProducts) {
        const docRef = doc(firestore, 'products', product.id);
        // The createdAt field in the seed is a JS Date, Firestore handles conversion
        batch.set(docRef, product, { merge: true });
        operationCount++;

        if (operationCount >= BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(firestore);
          operationCount = 0;
        }
      }

      if (operationCount > 0) {
        await batch.commit();
      }

      invalidateWhatsappCache();
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

      const BATCH_SIZE = 450;
      let batch = writeBatch(firestore);
      let operationCount = 0;
      let deletedCount = 0;

      for (const doc of querySnapshot.docs) {
        batch.delete(doc.ref);
        deletedCount++;
        operationCount++;

        if (operationCount >= BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(firestore);
          operationCount = 0;
        }
      }

      if (operationCount > 0) {
        await batch.commit();
      }

      invalidateWhatsappCache();
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



  const handleExportClick = async () => {
    if (!firestore || !users) {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'User data or database connection not available.',
      });
      return;
    }

    setLoading(true);
    try {
      // Fetch all orders for export using batching
      const ordersRef = collection(firestore, 'orders');
      const q = query(ordersRef, orderBy('createdAt', 'desc'));
      const allOrders = await fetchAllDocsInBatches<Order>(q);

      exportOrdersToExcel(allOrders, users);
      toast({
        title: 'Export Successful',
        description: `Exported ${allOrders.length} orders.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMigrateOrders = async () => {
    if (!firestore) return;
    setLoading(true);

    try {
      // 1. Fetch ALL products for mapping (ignore pagination)
      // Use orderBy('name') to ensure consistent cursor-based pagination
      const productsQuery = query(collection(firestore, 'products'), orderBy('name'));
      const allProducts = await fetchAllDocsInBatches<Product>(productsQuery);

      const productMap = new Map<string, Product>();
      allProducts.forEach(p => productMap.set(p.id, p));

      // 2. Fetch all orders for migration
      const ordersRef = collection(firestore, 'orders');
      const q = query(ordersRef, orderBy('createdAt', 'desc'));
      const allOrders = await fetchAllDocsInBatches<Order>(q);

      // 3. Chunk updates to respect Firestore batch limit of 500
      const updates: { ref: any, data: any }[] = [];

      allOrders.forEach(order => {
        let orderUpdated = false;
        const updatedItems = order.items.map(item => {
          // If item already has name, skip
          if (item.name) return item;

          const product = productMap.get(item.productId);
          if (product) {
            orderUpdated = true;
            return {
              ...item,
              name: product.name,
              name_te: product.name_te,
              unit: product.unit
            };
          }
          return item;
        });

        if (orderUpdated) {
          const orderRef = doc(firestore, 'orders', order.id);
          updates.push({ ref: orderRef, data: { items: updatedItems } });
        }
      });

      if (updates.length > 0) {
        const chunkSize = 400; // Safe limit below 500
        let updatedCount = 0;

        for (let i = 0; i < updates.length; i += chunkSize) {
          const batch = writeBatch(firestore);
          const chunk = updates.slice(i, i + chunkSize);

          chunk.forEach(update => {
            batch.update(update.ref, update.data);
          });

          await batch.commit();
          updatedCount += chunk.length;
        }

        toast({
          title: 'Orders Migrated',
          description: `Successfully updated ${updatedCount} orders with product names.`,
        });
      } else {
        toast({
          title: 'No Migration Needed',
          description: 'All orders already have product names.',
        });
      }

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Migration Failed',
        description: error.message,
      });
    } finally {
      setLoading(false);
      setMigrateDialogOpen(false);
      // We don't need to force refetch orders strictly if we just updated denormalized fields,
      // but if the UI displayed them, we might. Since we are in paginated mode,
      // the real-time listener *should* pick up changes for the currently visible page automatically.
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full pb-24">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-7 h-auto">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="products">{t('products', language)}</TabsTrigger>
          <TabsTrigger value="orders">{t('orders', language)}</TabsTrigger>
          <TabsTrigger value="subscriptions">{t('subscriptions', language)}</TabsTrigger>
          <TabsTrigger value="users">{t('users', language)}</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab orders={orders || []} products={products || []} loading={ordersLoading || productsLoading} />
        </TabsContent>

        <TabsContent value="inventory">
          {/* Inventory Tab merged into Products */}
          <div className="p-4 text-center text-muted-foreground">
            Inventory management is now combined with the <Button variant="link" onClick={() => setActiveTab('products')} className="px-1 text-primary">Products</Button> tab.
          </div>
        </TabsContent>

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
          </div>

          <ProductsTab
            products={products || []}
            loading={productsLoading}
            onProductUpdate={forceRefetch}
          />
        </TabsContent>

        <TabsContent value="orders">
          {/* Order Filters */}
          <OrderFiltersBar
            filters={orderFilters}
            onFiltersChange={setOrderFilters}
            areas={getUniqueAreas(orders || [])}
            totalOrders={orders?.length || 0}
            filteredCount={filterOrders(orders || [], orderFilters, users || undefined).length}
          />

          <div className="flex justify-end my-4 gap-2">
            <Button variant="outline" onClick={() => setMigrateDialogOpen(true)} disabled={ordersLoading || !orders || !products}>
              <Database className="mr-2 h-4 w-4" /> Migrate Orders
            </Button>
            <Button onClick={handleExportClick} disabled={ordersLoading || !orders || orders.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export to Excel
            </Button>
          </div>
          {ordersLoading ? <p>Loading orders...</p> : (
            <>
              <div className="md:hidden space-y-4 mt-4">
                {(filteredOrders || []).map((order) => {
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
                  {(filteredOrders || []).map((order) => {
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

              <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPageOrders}
                  disabled={ordersPageIndex === 0 || ordersLoading}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('previous', language) || 'Previous'}
                </Button>
                <div className="text-sm font-medium">
                  Page {ordersPageIndex + 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPageOrders}
                  disabled={!orders || orders.length < ORDERS_PER_PAGE || ordersLoading}
                >
                  {t('next', language) || 'Next'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
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
              <AlertDescription>{typeof usersError === 'string' ? usersError : usersError?.message || 'Failed to load users'}</AlertDescription>
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

        <TabsContent value="coupons">
          <CouponManager />
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
                <div className="space-y-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Input id="edit-address" value={editingUser.address || ''} onChange={(e) => setEditingUser({ ...editingUser, address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-area">Area</Label>
                  <Select value={editingUser.area || ''} onValueChange={(value) => setEditingUser({ ...editingUser, area: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Area" />
                    </SelectTrigger>
                    <SelectContent>
                      {(areas || []).map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-pincode">Pincode</Label>
                  <Input id="edit-pincode" value={editingUser.pincode || ''} onChange={(e) => setEditingUser({ ...editingUser, pincode: e.target.value })} />
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
                    const product = products.find(p => p.id === item.productId) || extraProducts[item.productId];
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

      <AlertDialog open={isMigrateDialogOpen} onOpenChange={setMigrateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Migrate Old Orders?</AlertDialogTitle>
            <AlertDialogDescription>
              This will scan all orders and populate product names for items that are missing them. This is required for the new optimized delivery view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMigrateOrders} disabled={loading}>
              {loading ? 'Migrating...' : 'Start Migration'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
