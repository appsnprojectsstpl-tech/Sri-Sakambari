'use client';

import { useState, useMemo } from 'react';
import { Product, StockTransaction } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StockAdjustmentDialog } from './stock-adjustment-dialog';
import {
    getStockStatus,
    getStockStatusColor,
    getStockStatusText,
    getStockStatusIcon,
    getLowStockProducts,
    getOutOfStockProducts,
    calculateInventoryValue,
    StockStatus
} from '@/lib/inventory-utils';
import { Search, Plus, Minus, AlertTriangle, Package, DollarSign, TrendingDown } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase';

interface InventoryTabProps {
    products: Product[];
    loading: boolean;
    onProductUpdate?: () => void;
}

export default function InventoryTab({ products, loading, onProductUpdate }: InventoryTabProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | StockStatus>('all');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);

    const firestore = useFirestore();
    const { toast } = useToast();
    const auth = useAuth();

    // Filter products
    const filteredProducts = useMemo(() => {
        let filtered = products.filter(p => p.trackInventory);

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.category.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Status filter
        if (filterStatus !== 'all') {
            filtered = filtered.filter(p => getStockStatus(p) === filterStatus);
        }

        return filtered;
    }, [products, searchTerm, filterStatus]);

    // Stats
    const stats = useMemo(() => {
        const trackedProducts = products.filter(p => p.trackInventory);
        const lowStock = getLowStockProducts(trackedProducts);
        const outOfStock = getOutOfStockProducts(trackedProducts);
        const inventoryValue = calculateInventoryValue(trackedProducts);

        return {
            totalProducts: trackedProducts.length,
            lowStockCount: lowStock.length,
            outOfStockCount: outOfStock.length,
            inventoryValue
        };
    }, [products]);

    const handleStockAdjustment = async (
        productId: string,
        newStock: number,
        type: string,
        quantity: number,
        reason: string
    ) => {
        if (!firestore || !auth?.currentUser) return;

        try {
            const product = products.find(p => p.id === productId);
            if (!product) return;

            const previousStock = product.stockQuantity || 0;

            // Update product stock
            await updateDoc(doc(firestore, 'products', productId), {
                stockQuantity: newStock,
                lastRestocked: serverTimestamp(),
                // Auto-disable if out of stock
                isActive: newStock > 0 ? product.isActive : false
            });

            // Log transaction
            const transaction: Omit<StockTransaction, 'id'> = {
                productId,
                productName: product.name,
                type: type as any,
                quantity,
                previousStock,
                newStock,
                reason: reason || undefined,
                timestamp: new Date(),
                userId: auth.currentUser.uid,
                userName: auth.currentUser.displayName || auth.currentUser.email || 'Admin'
            };

            await addDoc(collection(firestore, 'stockTransactions'), {
                ...transaction,
                timestamp: serverTimestamp()
            });

            toast({
                title: 'Stock Updated',
                description: `${product.name}: ${previousStock} → ${newStock} ${product.unit}`
            });

            onProductUpdate?.();
        } catch (error) {
            console.error('Failed to update stock:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to update stock. Please try again.'
            });
        }
    };

    const handleQuickAdjust = (product: Product, delta: number) => {
        const currentStock = product.stockQuantity || 0;
        const newStock = Math.max(0, currentStock + delta);
        const type = delta > 0 ? 'ADD' : 'REMOVE';
        const quantity = Math.abs(delta);

        handleStockAdjustment(
            product.id,
            newStock,
            type,
            quantity,
            delta > 0 ? 'Quick add' : 'Quick remove'
        );
    };

    const openAdjustmentDialog = (product: Product) => {
        setSelectedProduct(product);
        setAdjustmentDialogOpen(true);
    };

    if (loading) {
        return <div className="flex items-center justify-center p-12">Loading inventory...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tracked Products</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalProducts}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">{stats.lowStockCount}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats.outOfStockCount}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{stats.inventoryValue.toLocaleString('en-IN')}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>Inventory Management</CardTitle>
                    <CardDescription>Track and manage product stock levels</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search products..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Tabs value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)} className="w-full sm:w-auto">
                            <TabsList>
                                <TabsTrigger value="all">All</TabsTrigger>
                                <TabsTrigger value="LOW_STOCK">Low Stock</TabsTrigger>
                                <TabsTrigger value="OUT_OF_STOCK">Out of Stock</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* Products Table */}
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-right">Stock</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProducts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                            No products found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredProducts.map((product) => {
                                        const status = getStockStatus(product);
                                        const stock = product.stockQuantity || 0;

                                        return (
                                            <TableRow key={product.id}>
                                                <TableCell className="font-medium">{product.name}</TableCell>
                                                <TableCell>{product.category}</TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {stock} {product.unit}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className={getStockStatusColor(status)}>
                                                        {getStockStatusIcon(status)} {getStockStatusText(status)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => handleQuickAdjust(product, -1)}
                                                            disabled={stock === 0}
                                                        >
                                                            <Minus className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => handleQuickAdjust(product, 1)}
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="default"
                                                            size="sm"
                                                            onClick={() => openAdjustmentDialog(product)}
                                                        >
                                                            Adjust
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Stock Adjustment Dialog */}
            <StockAdjustmentDialog
                product={selectedProduct}
                open={adjustmentDialogOpen}
                onOpenChange={setAdjustmentDialogOpen}
                onAdjust={handleStockAdjustment}
            />
        </div>
    );
}
