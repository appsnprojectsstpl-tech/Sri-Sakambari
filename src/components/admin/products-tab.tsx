'use client';

import { useState, useMemo, useRef } from 'react';
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
import { Search, Plus, Minus, AlertTriangle, Package, DollarSign, TrendingDown, FilePen, Trash2, PlusCircle, Upload, Loader2, Database } from 'lucide-react';
import { useFirestore, storage } from '@/firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import ProductImageGallery from '@/components/views/product-image-gallery';
import { products as seedProducts } from '@/lib/seed-data';
import Image from 'next/image';
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
import { getProductName } from '@/lib/translations';
import { useLanguage } from '@/context/language-context';

interface ProductsTabProps {
    products: Product[];
    loading: boolean;
    onProductUpdate?: () => void;
}

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
    stockQuantity: 0, // Added stockQuantity to initial state
    trackInventory: true
};

export default function ProductsTab({ products, loading, onProductUpdate }: ProductsTabProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | StockStatus>('all');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);

    // Product Dialog State
    const [isProductDialogOpen, setProductDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Delete Dialog State
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

    const firestore = useFirestore();
    const { toast } = useToast();
    const auth = useAuth();
    const { language } = useLanguage();

    // Filter products
    const filteredProducts = useMemo(() => {
        let filtered = products;

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
            totalProducts: products.length,
            trackedProducts: trackedProducts.length,
            lowStockCount: lowStock.length,
            outOfStockCount: outOfStock.length,
            inventoryValue
        };
    }, [products]);

    // --- Stock Management Handlers ---

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
                // Auto-disable if out of stock handled by manual toggle usually, but here we can keep active
                // isActive: newStock > 0 ? product.isActive : false 
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

    // --- Product CRUD Handlers ---

    const handleAddNewProduct = () => {
        setEditingProduct(initialProductState);
        setProductDialogOpen(true);
    };

    const handleEditProduct = (product: Product) => {
        setEditingProduct(product);
        setProductDialogOpen(true);
    };

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
            onProductUpdate?.();
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

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!storage) {
            toast({ variant: 'destructive', title: 'Error', description: 'Storage not configured.' });
            return;
        }

        try {
            setUploadingImage(true);
            const timestamp = Date.now();
            const storageRef = ref(storage, `products/${timestamp}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);

            setEditingProduct(prev => prev ? { ...prev, imageUrl: url } : null);
            toast({ title: "Image Uploaded", description: "Image URL updated successfully." });
        } catch (err: any) {
            console.error(err);
            toast({ variant: "destructive", title: "Upload Failed", description: err.message });
        } finally {
            setUploadingImage(false);
        }
    };

    const removeImage = (urlToRemove: string) => {
        setEditingProduct(prev => {
            if (!prev) return null;
            const currentImages = 'images' in prev && Array.isArray(prev.images)
                ? prev.images
                : (prev.imageUrl ? [prev.imageUrl] : []);

            const updatedImages = currentImages.filter((url) => url !== urlToRemove);

            return {
                ...prev,
                imageUrl: updatedImages.length > 0 ? updatedImages[0] : '',
                images: updatedImages
            };
        });
    };

    const handleProductFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !editingProduct) return;

        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget as HTMLFormElement);

        const productData = {
            name: formData.get('name') as string,
            category: formData.get('category') as string,
            pricePerUnit: parseFloat(formData.get('pricePerUnit') as string) || 0,
            unit: formData.get('unit') as string,
            imageUrl: formData.get('imageUrl') as string,
            isActive: formData.get('isActive') === 'on',
            isCutVegetable: formData.get('isCutVegetable') === 'on',
            cutCharge: parseFloat(formData.get('cutCharge') as string) || 0,
            stockQuantity: parseFloat(formData.get('stockQuantity') as string) || 0,
            trackInventory: formData.get('trackInventory') === 'on',
        };

        try {
            const seedMatch = seedProducts.find(p => p.name.toLowerCase() === productData.name.toLowerCase());
            const translatedName = seedMatch?.name_te || '';

            const finalProductData = {
                ...productData,
                name_te: translatedName,
            };

            if ('id' in editingProduct && editingProduct.id) {
                // Editing
                const productRef = doc(firestore, 'products', editingProduct.id);
                await setDoc(productRef, finalProductData, { merge: true });
                toast({
                    title: "Product Updated",
                    description: `${productData.name} has been successfully updated.`,
                });
            } else {
                // Adding
                const productsCollection = collection(firestore, 'products');
                const docRef = await addDoc(productsCollection, {
                    ...finalProductData,
                    createdAt: serverTimestamp(),
                    lastRestocked: serverTimestamp(), // Initialize restock time
                });
                await setDoc(docRef, { id: docRef.id }, { merge: true });
                toast({
                    title: "Product Added",
                    description: `${productData.name} has been added to the catalog.`,
                });
            }
            onProductUpdate?.();
            setProductDialogOpen(false);

        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error Saving Product",
                description: error.message || "An unexpected error occurred.",
            });
        } finally {
            setIsSubmitting(false);
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


    if (loading) {
        return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading products...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalProducts}</div>
                        <p className="text-xs text-muted-foreground">{stats.trackedProducts} tracked</p>
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

            {/* Filters & Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Products & Inventory</CardTitle>
                    <CardDescription>Manage catalog, prices, and stock levels</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 mb-4 justify-between">
                        <div className="flex gap-4 flex-1">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search products..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Tabs value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)} className="w-auto">
                                <TabsList>
                                    <TabsTrigger value="all">All</TabsTrigger>
                                    <TabsTrigger value="LOW_STOCK">Low Stock</TabsTrigger>
                                    <TabsTrigger value="OUT_OF_STOCK">Out of Stock</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        <Button onClick={handleAddNewProduct} className="shrink-0">
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Product
                        </Button>
                    </div>

                    {/* Products Table */}
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px]">Image</TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead className="text-right">Stock</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProducts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                            No products found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredProducts.map((product) => {
                                        const status = getStockStatus(product);
                                        const stock = product.stockQuantity || 0;
                                        const imageUrl = isValidUrl(product.imageUrl) ? product.imageUrl : `https://picsum.photos/seed/${product.id}/40/40`;

                                        return (
                                            <TableRow key={product.id}>
                                                <TableCell>
                                                    <Image
                                                        src={imageUrl}
                                                        alt={product.name}
                                                        width={40}
                                                        height={40}
                                                        className="rounded-md object-cover aspect-square"
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    <div>{getProductName(product, language)}</div>
                                                    {product.name_te && <div className="text-xs text-muted-foreground">{product.name}</div>}
                                                </TableCell>
                                                <TableCell>{product.category}</TableCell>
                                                <TableCell className="text-right">
                                                    ₹{product.pricePerUnit}/{product.unit}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span className={stock === 0 ? 'text-destructive' : ''}>{stock}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {product.trackInventory ? (
                                                        <Badge variant="outline" className={getStockStatusColor(status)}>
                                                            {getStockStatusIcon(status)} {getStockStatusText(status)}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary">Untracked</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {/* Quick Adjust Buttons */}
                                                        {product.trackInventory && (
                                                            <>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-8 w-8"
                                                                    onClick={() => handleQuickAdjust(product, -1)}
                                                                >
                                                                    <Minus className="h-3 w-3" />
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-8 w-8"
                                                                    onClick={() => handleQuickAdjust(product, 1)}
                                                                >
                                                                    <Plus className="h-3 w-3" />
                                                                </Button>
                                                            </>
                                                        )}

                                                        {/* Edit Button */}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => handleEditProduct(product)}
                                                        >
                                                            <FilePen className="h-4 w-4" />
                                                        </Button>

                                                        {/* Delete Button */}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive"
                                                            onClick={() => handleDeleteClick(product)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
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

            {/* Stock Adjustment Dialog (Detailed) */}
            <StockAdjustmentDialog
                product={selectedProduct}
                open={adjustmentDialogOpen}
                onOpenChange={setAdjustmentDialogOpen}
                onAdjust={handleStockAdjustment}
            />

            {/* Product Add/Edit Dialog */}
            <Dialog open={isProductDialogOpen} onOpenChange={setProductDialogOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-headline">{'id' in (editingProduct || {}) ? 'Edit Product' : 'Add New Product'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleProductFormSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input id="name" name="name" defaultValue={editingProduct?.name} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="category">Category</Label>
                                <Select name="category" defaultValue={editingProduct?.category || ''} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {['Vegetables', 'Fruits', 'Dairy', 'Groceries', 'Leafy Vegetables'].map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="pricePerUnit">Price (₹)</Label>
                                    <Input id="pricePerUnit" name="pricePerUnit" type="number" step="0.01" defaultValue={editingProduct?.pricePerUnit} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="unit">Unit</Label>
                                    <Input id="unit" name="unit" defaultValue={editingProduct?.unit} placeholder="e.g., kg, pc" required />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="stockQuantity">Initial Stock</Label>
                                    <Input id="stockQuantity" name="stockQuantity" type="number" step="0.01" defaultValue={editingProduct?.stockQuantity || 0} />
                                </div>
                                <div className="flex items-center space-x-2 pt-8">
                                    <Checkbox id="trackInventory" name="trackInventory" defaultChecked={editingProduct ? editingProduct.trackInventory : true} />
                                    <Label htmlFor="trackInventory">Track Inventory</Label>
                                </div>
                            </div>

                            {/* Image Upload Section */}
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
                                        <Upload className="h-4 w-4" />
                                        {uploadingImage ? 'Uploading...' : 'Upload Image'}
                                    </Label>
                                    <Input
                                        id="imageUpload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageUpload}
                                        disabled={uploadingImage}
                                    />
                                </div>
                                {editingProduct && (
                                    <ProductImageGallery
                                        images={'images' in editingProduct && Array.isArray(editingProduct.images)
                                            ? editingProduct.images
                                            : (editingProduct.imageUrl ? [editingProduct.imageUrl] : [])}
                                        onRemove={removeImage}
                                    />
                                )}
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox id="isActive" name="isActive" defaultChecked={editingProduct ? editingProduct.isActive : true} />
                                <Label htmlFor="isActive">Product is Active (Visible to Check)</Label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox id="isCutVegetable" name="isCutVegetable" defaultChecked={editingProduct ? editingProduct.isCutVegetable : false} />
                                <Label htmlFor="isCutVegetable">Cutting Service Available</Label>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cutCharge">Cut Charge (₹)</Label>
                                <Input id="cutCharge" name="cutCharge" type="number" step="0.01" defaultValue={editingProduct?.cutCharge || 0} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setProductDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Product"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the product
                            <span className="font-semibold"> {deletingProduct?.name}</span> and its history.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
