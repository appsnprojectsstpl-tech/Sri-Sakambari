
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
import { Info, Share2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Switch } from '../ui/switch';
import { cn } from '@/lib/utils';
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
import DashboardTab from '@/components/admin/dashboard-tab';
import ProductsTab from '@/components/admin/products-tab';
import ConfigCategoriesTab from '@/components/admin/categories-tab';
import * as XLSX from 'xlsx';
import OrdersTab from '@/components/admin/orders-tab';
import SubscriptionsTab from '@/components/admin/subscriptions-tab';
import UsersTab from '@/components/admin/users-tab';
import CouponsTab from '@/components/admin/coupons-tab';
import WhatsappTab from '@/components/admin/whatsapp-tab';
import { getAdminPermissions, getAllowedTabs } from '@/lib/permission-config';
import { useOrderNotification, requestNotificationPermission } from '@/hooks/useOrderNotification';
import { ShareAppDialog } from '@/components/dialogs/share-app-dialog';
import { useStoreStatus } from '@/hooks/use-store-status';








export default function AdminView({ user: adminUser }: { user: User }) {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const { isOpen: isStoreOpen, loading: storeStatusLoading, toggleStore } = useStoreStatus();

  // Order Filters State - Moved to OrdersTab
  // Permission-based access control
  const permissions = getAdminPermissions(adminUser.role);
  const allowedTabs = getAllowedTabs(adminUser.role);

  // Redirect to first allowed tab if current tab is not accessible
  useEffect(() => {
    if (permissions && !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0] || 'orders');
    }
  }, [permissions, allowedTabs, activeTab]);

  // Enable order notifications for admins
  useOrderNotification(adminUser.role);

  // Toggle store status
  const handleStoreToggle = async (checked: boolean) => {
    try {
      await toggleStore(checked);
      toast({
        title: checked ? 'Store Opened' : 'Store Closed',
        description: checked ? 'Customers can now place orders' : 'Orders are temporarily paused'
      });
    } catch (error) {
      console.error('Error toggling store status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update store status'
      });
    }
  };

  // Request notification permission on mount
  useEffect(() => {
    if (adminUser.role === 'admin' || adminUser.role === 'restricted_admin') {
      requestNotificationPermission();
    }
  }, [adminUser.role]);


  // Pagination State
  const PRODUCTS_PER_PAGE = 50;
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
        batch.set(doc(firestore, 'notifications', n.id), { isRead: true }, { merge: true });
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
  // Products: Fetch ALL products for correct client-side stats (Stock Value, Low Stock counts)
  // and search/filtering. Optimized for < 2000 products.
  const productConstraints = [
    ['orderBy', 'name', 'asc'],
    ['limit', 2000]
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




  const [isBulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [isSeedDialogOpen, setSeedDialogOpen] = useState(false);
  const [isClearProductsDialogOpen, setClearProductsDialogOpen] = useState(false);
  const [isMigrateDialogOpen, setMigrateDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);






















  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !firestore) return;

    setLoading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(sheet);

        if (!jsonData || jsonData.length === 0) {
          toast({ variant: 'destructive', title: 'Error', description: 'File appears to be empty or invalid.' });
          setLoading(false);
          return;
        }

        let successCount = 0;
        let skippedCount = 0;

        const BATCH_SIZE = 450;
        let batch = writeBatch(firestore);
        let operationCount = 0;

        for (const item of jsonData) {
          // Normalize keys to lowercase for easier matching
          const normalizedItem: any = {};
          Object.keys(item).forEach(key => {
            normalizedItem[key.toLowerCase().trim().replace(/\s+/g, '')] = item[key];
          });

          const name = normalizedItem['name'] || normalizedItem['productname'];
          if (!name) {
            skippedCount++;
            continue;
          }

          const productData: any = {
            name: name,
            category: normalizedItem['category'] || 'Vegetables', // Default if missing
            unit: normalizedItem['unit'] || 'kg',
            pricePerUnit: parseFloat(normalizedItem['priceperunit'] || normalizedItem['price'] || '0'),
            stockQuantity: parseFloat(normalizedItem['stockquantity'] || normalizedItem['stock'] || '0'),
            isActive: normalizedItem['isactive'] === true || normalizedItem['isactive'] === 'TRUE' || normalizedItem['isactive'] === 'true',
            isCutVegetable: normalizedItem['iscutvegetable'] === true || normalizedItem['iscutvegetable'] === 'TRUE' || normalizedItem['iscutvegetable'] === 'true',
            cutCharge: parseFloat(normalizedItem['cutcharge'] || '0'),
            displayOrder: parseInt(normalizedItem['displayorder'] || '100'),
            trackInventory: normalizedItem['trackinventory'] !== false && normalizedItem['trackinventory'] !== 'FALSE' // Default true
          };

          // Match with seed data for Telugu names if available
          const seedMatch = seedProducts.find(p => p.name.toLowerCase() === name.toLowerCase());

          const newProductDoc = doc(collection(firestore, 'products'));
          batch.set(newProductDoc, {
            ...productData,
            id: newProductDoc.id,
            name_te: normalizedItem['namete'] || (seedMatch ? seedMatch.name_te : ''),
            imageUrl: normalizedItem['imageurl'] || '',
            createdAt: serverTimestamp(),
            lastRestocked: serverTimestamp()
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
          description: `${successCount} products added. ${skippedCount} items skipped (missing name).`,
        });

      } catch (error: any) {
        console.error("Bulk upload error:", error);
        toast({
          variant: 'destructive',
          title: 'Bulk Upload Error',
          description: 'Failed to process file. Ensure it is a valid Excel or CSV file.',
        });
      } finally {
        setLoading(false);
        setBulkUploadOpen(false);
        forceRefetch();
        // Reset file input
        event.target.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
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

        {/* Store Status Toggle */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card">
          <span className="text-sm text-muted-foreground">Store:</span>
          <Switch
            checked={isStoreOpen}
            onCheckedChange={handleStoreToggle}
            disabled={storeStatusLoading}
            className="data-[state=checked]:bg-green-500"
          />
          <span className={cn(
            "text-sm font-medium",
            isStoreOpen ? "text-green-600" : "text-red-600"
          )}>
            {isStoreOpen ? "Open" : "Closed"}
          </span>
        </div>

        {/* Share Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowShareDialog(true)}
          className="border-primary text-primary hover:bg-primary/10"
        >
          <Share2 className="h-5 w-5" />
        </Button>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full pb-24">
        <TabsList className={`grid w-full h-auto ${allowedTabs.length <= 3 ? 'grid-cols-3' :
          allowedTabs.length <= 5 ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5' :
            'grid-cols-2 sm:grid-cols-3 md:grid-cols-7'
          }`}>
          {permissions?.canAccessDashboard && <TabsTrigger value="dashboard">Dashboard</TabsTrigger>}

          {permissions?.canAccessProducts && <TabsTrigger value="products">{t('products', language)}</TabsTrigger>}
          {permissions?.canAccessOrders && <TabsTrigger value="orders">{t('orders', language)}</TabsTrigger>}
          {permissions?.canAccessSubscriptions && <TabsTrigger value="subscriptions">{t('subscriptions', language)}</TabsTrigger>}
          {permissions?.canAccessUsers && <TabsTrigger value="users">{t('users', language)}</TabsTrigger>}
          {permissions?.canAccessCoupons && <TabsTrigger value="coupons">Coupons</TabsTrigger>}
          {permissions?.canAccessWhatsApp && <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>}
        </TabsList>

        {permissions?.canAccessDashboard && (
          <TabsContent value="dashboard">
            <DashboardTab orders={orders || []} products={products || []} loading={ordersLoading || productsLoading} />
          </TabsContent>
        )}



        {permissions?.canAccessProducts && (
          <TabsContent value="products">
            <div className="flex justify-end items-center my-4 gap-2 flex-wrap">
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
        )}



        {permissions?.canAccessOrders && (
          <TabsContent value="orders">
            <OrdersTab
              orders={orders || []}
              users={users || []}
              products={products || []}
              loading={ordersLoading}
              onOrderUpdate={() => {
                // Optional: force refresh if needed, usually realtime handles it
              }}
              pageIndex={ordersPageIndex}
              onNextPage={handleNextPageOrders}
              onPrevPage={handlePrevPageOrders}
              hasMore={!!orders && orders.length >= ORDERS_PER_PAGE}
              onExport={handleExportClick}
              onMigrate={() => setMigrateDialogOpen(true)}
            />
          </TabsContent>
        )}

        {permissions?.canAccessSubscriptions && (
          <TabsContent value="subscriptions">
            <SubscriptionsTab
              subscriptions={subscriptions || []}
              users={users || []}
              products={products || []}
              loading={subscriptionsLoading}
              onUpdate={() => {
                // Optional refresh logic
              }}
            />
          </TabsContent>
        )}

        {permissions?.canAccessUsers && (
          <TabsContent value="users">
            <UsersTab
              users={users || []}
              loading={usersLoading}
              onUpdate={() => {
                // Refresh logic if needed or handled by realtime
              }}
            />
          </TabsContent>
        )}

        {permissions?.canAccessCoupons && (
          <TabsContent value="coupons">
            <CouponsTab
              coupons={coupons || []}
              loading={couponsLoading}
              onUpdate={() => {
                // Optional refetch or toast
              }}
            />
          </TabsContent>
        )}

        {permissions?.canAccessWhatsApp && (
          <TabsContent value="whatsapp" className="h-[calc(100vh-200px)]">
            <WhatsappTab
              products={products || []}
              loading={productsLoading}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Coupon Dialog */}










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

      {/* Dialogs */}
      <ShareAppDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
      />

    </div >
  );
}
