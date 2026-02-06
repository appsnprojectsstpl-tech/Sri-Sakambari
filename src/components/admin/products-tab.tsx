'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Product, StockTransaction, Category } from '@/lib/types';
import { Language } from '@/lib/translations';
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
import { Search, Plus, Minus, AlertTriangle, Package, DollarSign, TrendingDown, FilePen, Trash2, PlusCircle, Upload, Loader2, Database, ChevronLeft, ChevronRight, ImagePlus } from 'lucide-react';

import { useFirestore, storage, useCollection } from '@/firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import ProductImageGallery from '@/components/views/product-image-gallery';
import { products as seedProducts } from '@/lib/seed-data';
import { DEFAULT_CATEGORIES } from '@/components/customer/customer-header';
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
import { ProductFormSheet } from './product-form-sheet';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

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

interface SortableProductRowProps {
    product: Product;
    selectedProductIds: Set<string>;
    toggleProductSelection: (id: string) => void;
    handleQuickAdjust: (product: Product, delta: number) => void;
    handleEditProduct: (product: Product) => void;
    handleDeleteClick: (product: Product) => void;
    firestore: any;
    language: string;
    categories: Category[];
}

function SortableProductRow({
    product,
    selectedProductIds,
    toggleProductSelection,
    handleQuickAdjust,
    handleEditProduct,
    handleDeleteClick,
    firestore,
    language,
    categories
}: SortableProductRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: product.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : 1,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative' as 'relative',
    };

    const status = getStockStatus(product);
    const stock = product.stockQuantity || 0;

    return (
        <TableRow ref={setNodeRef} style={style} className={isDragging ? "bg-muted" : ""}>
            <TableCell>
                <div
                    className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded w-8 h-8 flex items-center justify-center"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
            </TableCell>
            <TableCell>
                <Checkbox
                    checked={selectedProductIds.has(product.id)}
                    onCheckedChange={() => toggleProductSelection(product.id)}
                    aria-label={`Select ${product.name}`}
                />
            </TableCell>
            <TableCell>
                {isValidUrl(product.imageUrl) ? (
                    <Image
                        src={product.imageUrl!}
                        alt={product.name}
                        width={40}
                        height={40}
                        className="rounded-md object-cover aspect-square"
                    />
                ) : (
                    <div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center text-gray-400">
                        <ImagePlus className="w-5 h-5" />
                    </div>
                )}
            </TableCell>
            <TableCell className="font-medium">
                <div>{getProductName(product, language as Language)}</div>
                {product.name_te && <div className="text-xs text-muted-foreground">{product.name}</div>}
            </TableCell>
            <TableCell>
                <Select
                    defaultValue={product.category}
                    onValueChange={(val) => {
                        updateDoc(doc(firestore, 'products', product.id), { category: val });
                    }}
                >
                    <SelectTrigger className="w-[130px] h-8 border-none bg-transparent hover:bg-accent">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {(categories && categories.length > 0 ? categories.map(c => c.name) : DEFAULT_CATEGORIES.filter(c => c.id !== 'All').map(c => c.label)).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                </Select>
            </TableCell>
            <TableCell className="text-right">
                {(product.variants && product.variants.length > 0) ? (
                    <div className="flex flex-col gap-1 text-xs">
                        {product.variants.map((v, i) => (
                            <div key={i} className="whitespace-nowrap">
                                ₹{v.price} <span className="text-muted-foreground">/ {v.unit}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div>₹{product.pricePerUnit}/{product.unit}</div>
                )}
            </TableCell>
            <TableCell className="text-right font-semibold">
                {(product.variants && product.variants.length > 0 && product.manageStockBy !== 'weight') ? (
                    <div className="flex flex-col gap-1 text-xs">
                        {product.variants.map((v, i) => (
                            <div key={i} className={v.stock === 0 ? 'text-destructive' : ''}>
                                {v.stock} <span className="text-muted-foreground text-[10px]">({v.unit})</span>
                            </div>
                        ))}
                        <div className="border-t mt-1 pt-1 font-bold text-muted-foreground">
                            Total: {stock}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-end gap-2">
                        <div className="flex flex-col text-right">
                            <span className={stock === 0 ? 'text-destructive' : ''}>
                                {stock} {product.manageStockBy === 'weight' && <span className="text-[10px] text-muted-foreground font-normal">{product.unit || 'Kg'}</span>}
                            </span>
                            {/* Show quick variant indicator if they exist but we are hiding details */}
                            {product.variants && product.variants.length > 0 && product.manageStockBy === 'weight' && (
                                <span className="text-[10px] text-muted-foreground italic">{product.variants.length} Sizes</span>
                            )}
                        </div>
                    </div>
                )}
            </TableCell>
            <TableCell className="text-right">
                {(product.variants && product.variants.length > 0 && product.manageStockBy !== 'weight') ? (
                    <div className="flex flex-col gap-1 text-xs">
                        {product.variants.map((v, i) => (
                            <div key={i} className="whitespace-nowrap text-muted-foreground">
                                ₹{(v.price * (v.stock || 0)).toLocaleString()}
                            </div>
                        ))}
                        <div className="border-t mt-1 pt-1 font-bold">
                            ₹{product.variants.reduce((acc, v) => acc + (v.price * (v.stock || 0)), 0).toLocaleString()}
                        </div>
                    </div>
                ) : (
                    <div className="font-medium">
                        ₹{((product.pricePerUnit || 0) * (product.stockQuantity || 0)).toLocaleString()}
                    </div>
                )}
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

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditProduct(product)}
                    >
                        <FilePen className="h-4 w-4" />
                    </Button>

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
}

interface ProductsTabProps {
    products: Product[];
    loading: boolean;
    onProductUpdate?: () => void;
}

// Removed PRODUCT_CATEGORIES constant in favor of dynamic categories

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
    trackInventory: true,
    variants: []
};

export default function ProductsTab({ products, loading, onProductUpdate }: ProductsTabProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | StockStatus>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'name' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc' | 'display_order'>('name');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);

    // Product Dialog State
    const [isProductDialogOpen, setProductDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Delete Dialog State
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

    // Delete Dialog State
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

    // Bulk Actions handlers
    const toggleProductSelection = (productId: string) => {
        const newSelection = new Set(selectedProductIds);
        if (newSelection.has(productId)) {
            newSelection.delete(productId);
        } else {
            newSelection.add(productId);
        }
        setSelectedProductIds(newSelection);
    };

    const toggleSelectAll = () => {
        if (selectedProductIds.size === filteredProducts.length) {
            setSelectedProductIds(new Set());
        } else {
            setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
        }
    };



    // Duplicate Scanner State
    const [isScanDialogOpen, setIsScanDialogOpen] = useState(false);
    const [scanResults, setScanResults] = useState<Map<string, Product[]>>(new Map());

    const handleScanDuplicates = () => {
        const groups = new Map<string, Product[]>();
        products.forEach(p => {
            const name = p.name.trim().toLowerCase();
            const existing = groups.get(name) || [];
            groups.set(name, [...existing, p]);
        });

        const duplicates = new Map<string, Product[]>();
        groups.forEach((list, name) => {
            if (list.length > 1) {
                duplicates.set(name, list);
            }
        });

        if (duplicates.size === 0) {
            toast({ title: "No Duplicates Found", description: "Your catalog looks clean!" });
            return;
        }

        setScanResults(duplicates);
        setIsScanDialogOpen(true);
    };

    const handleMergeGroup = async (groupName: string, groupProducts: Product[]) => {
        if (groupProducts.length < 2) return;

        // Prioritize product with image as master
        const sortedGroup = [...groupProducts].sort((a, b) => {
            if (a.imageUrl && !b.imageUrl) return -1;
            if (!a.imageUrl && b.imageUrl) return 1;
            return 0;
        });

        const master = sortedGroup[0];
        const others = sortedGroup.slice(1);

        let newVariants: any[] = [...(master.variants || [])];

        // Auto-convert master base details to variant if needed
        if (master.unit && master.pricePerUnit > 0) {
            const exists = newVariants.some((v: any) => v.unit === master.unit);
            if (!exists) {
                newVariants.unshift({
                    id: crypto.randomUUID(),
                    unit: master.unit,
                    price: master.pricePerUnit,
                    stock: master.stockQuantity || 0
                });
            }
        }

        // Merge variants from other products
        others.forEach(p => {
            if (p.variants && p.variants.length > 0) {
                p.variants.forEach((v: any) => {
                    const exists = newVariants.some((nv: any) => nv.unit === v.unit);
                    if (!exists) newVariants.push(v);
                });
            } else if (p.unit && p.pricePerUnit > 0) {
                const exists = newVariants.some((nv: any) => nv.unit === p.unit);
                if (!exists) {
                    newVariants.push({
                        id: crypto.randomUUID(),
                        unit: p.unit,
                        price: p.pricePerUnit,
                        stock: p.stockQuantity || 0
                    });
                }
            }
        });

        try {
            const batch = writeBatch(firestore);

            // Update Master
            batch.update(doc(firestore, 'products', master.id), {
                variants: newVariants,
                stockQuantity: newVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0),
                trackInventory: true
            });

            // Delete duplicates
            others.forEach(p => {
                batch.delete(doc(firestore, 'products', p.id));
            });

            await batch.commit();

            toast({ title: "Products Merged", description: `Merged ${groupProducts.length} items into ${master.name}` });

            setScanResults(prev => {
                const next = new Map(prev);
                next.delete(groupName);
                if (next.size === 0) setIsScanDialogOpen(false);
                return next;
            });
            if (onProductUpdate) onProductUpdate();

        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Merge Failed", description: "Check console for details." });
        }
    };

    const firestore = useFirestore();
    const { toast } = useToast();
    const auth = useAuth();
    const { language } = useLanguage();
    const { data: categories } = useCollection<Category>('categories', {
        constraints: [['orderBy', 'displayOrder', 'asc']]
    });

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = filteredProducts.findIndex(p => p.id === active.id);
            const newIndex = filteredProducts.findIndex(p => p.id === over?.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newOrdered = arrayMove(filteredProducts, oldIndex, newIndex);

                // Batch update displayOrder
                const batch = writeBatch(firestore);
                // We update only the affected range to save writes?
                // For simplicity, update items in the current page/view that shifted.
                // Or update all?
                // Let's update all in the newOrdered list to safeguard.
                newOrdered.forEach((p, idx) => {
                    const expectedOrder = idx; // Simple 0-based index
                    if (p.displayOrder !== expectedOrder) {
                        batch.update(doc(firestore, 'products', p.id), { displayOrder: expectedOrder });
                    }
                });

                try {
                    await batch.commit();
                    toast({ title: "Order Updated", description: "Product display order saved." });
                    // No need to manually set state, Firestore subscription will update.
                    // But for optimistic UI, we might want to? 
                    // Since specific local state isn't used for products, we wait for refresh.
                } catch (e) {
                    console.error("Failed to reorder", e);
                    toast({ variant: "destructive", title: "Reorder Failed" });
                }
            }
        }
    };

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

        // Category filter
        if (filterCategory !== 'all') {
            filtered = filtered.filter(p => p.category === filterCategory);
        }

        // Sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'display_order':
                    return (a.displayOrder || 0) - (b.displayOrder || 0);
                case 'price_asc':
                    return (a.pricePerUnit || 0) - (b.pricePerUnit || 0);
                case 'price_desc':
                    return (b.pricePerUnit || 0) - (a.pricePerUnit || 0);
                case 'stock_asc':
                    return (a.stockQuantity || 0) - (b.stockQuantity || 0);
                case 'stock_desc':
                    return (b.stockQuantity || 0) - (a.stockQuantity || 0);
                default: // name
                    return a.name.localeCompare(b.name);
            }
        });

        return filtered;
    }, [products, searchTerm, filterStatus, filterCategory, sortBy]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatus, products.length]);

    // Client-side pagination
    const paginatedProducts = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredProducts, currentPage]);

    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

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
        reason: string,
        variantId?: string
    ) => {
        if (!firestore || !auth?.currentUser) return;

        try {
            const product = products.find(p => p.id === productId);
            if (!product || !firestore) return;

            let updateData: any = {
                lastRestocked: serverTimestamp(),
            };

            let previousStock = product.stockQuantity || 0;
            let transactionProductName = product.name;

            if (variantId && product.variants) {
                const updatedVariants = product.variants.map(v => {
                    if (v.id === variantId) {
                        previousStock = v.stock;
                        transactionProductName = `${product.name} (${v.unit})`;
                        return { ...v, stock: newStock };
                    }
                    return v;
                });
                updateData.variants = updatedVariants;
                // Also update total stock quantity for quick view
                updateData.stockQuantity = updatedVariants.reduce((acc, v) => acc + (v.stock || 0), 0);
            } else {
                updateData.stockQuantity = newStock;
            }

            // Update product stock
            await updateDoc(doc(firestore, 'products', productId), updateData);

            // Log transaction
            const transaction: Omit<StockTransaction, 'id'> = {
                productId,
                productName: transactionProductName,
                type: type as any,
                quantity,
                previousStock,
                newStock,
                reason: reason || undefined,
                timestamp: new Date(),
                userId: auth.currentUser.uid,
                userName: auth.currentUser.displayName || auth.currentUser.email || 'Admin',
                variantId // Log variant ID if applicable
            };

            await addDoc(collection(firestore, 'stockTransactions'), {
                ...transaction,
                timestamp: serverTimestamp()
            });

            toast({
                title: 'Stock Updated',
                description: `${transactionProductName}: ${previousStock} → ${newStock}`
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



    // Helper function to validate URL removed from here and moved to top



    // Only show full loading state if we have no data yet.
    // This prevents the page from jumping/resetting scroll on background refreshes (like after saving).
    if (loading && products.length === 0) {
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
                    <div className="flex flex-col gap-4 mb-4">
                        <div className="flex gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search products..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Button variant="outline" size="icon" onClick={() => {
                                setSearchTerm('');
                                setFilterStatus('all');
                                setFilterCategory('all');
                                setSortBy('name');
                            }} title="Reset Filters">
                                <Database className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Select value={filterStatus} onValueChange={(val: any) => setFilterStatus(val)}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="IN_STOCK">In Stock</SelectItem>
                                    <SelectItem value="LOW_STOCK">Low Stock</SelectItem>
                                    <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={filterCategory} onValueChange={setFilterCategory}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {(categories && categories.length > 0 ? categories.map(c => c.name) : DEFAULT_CATEGORIES.filter(c => c.id !== 'All').map(c => c.label)).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Sort By" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="display_order">Custom Order</SelectItem>
                                    <SelectItem value="name">Name (A-Z)</SelectItem>
                                    <SelectItem value="price_asc">Price (Low-High)</SelectItem>
                                    <SelectItem value="price_desc">Price (High-Low)</SelectItem>
                                    <SelectItem value="stock_asc">Stock (Low-High)</SelectItem>
                                    <SelectItem value="stock_desc">Stock (High-Low)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end">

                        <Button variant="outline" onClick={handleScanDuplicates} className="shrink-0">
                            <Database className="mr-2 h-4 w-4" /> Scan Duplicates
                        </Button>
                        <Button onClick={() => {
                            setEditingProduct(initialProductState);
                            setProductDialogOpen(true);
                        }} className="shrink-0">
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Product
                        </Button>
                    </div>

                    {/* Products Table */}
                    {/* Products Table */}
                    <div className="border rounded-lg overflow-hidden">
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]"></TableHead>
                                        <TableHead className="w-[50px]">
                                            <Checkbox
                                                checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length}
                                                onCheckedChange={toggleSelectAll}
                                                aria-label="Select all"
                                            />
                                        </TableHead>
                                        <TableHead className="w-[80px]">Image</TableHead>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead className="text-right">Price</TableHead>
                                        <TableHead className="text-right">Stock</TableHead>
                                        <TableHead className="text-right">Value</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredProducts.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                                                No products found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        <SortableContext
                                            items={paginatedProducts.map(p => p.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {paginatedProducts.map((product) => (
                                                <SortableProductRow
                                                    key={product.id}
                                                    product={product}
                                                    selectedProductIds={selectedProductIds}
                                                    toggleProductSelection={toggleProductSelection}
                                                    handleQuickAdjust={handleQuickAdjust}
                                                    handleEditProduct={handleEditProduct}
                                                    handleDeleteClick={handleDeleteClick}
                                                    firestore={firestore}
                                                    language={language}
                                                    categories={categories || []}
                                                />
                                            ))}
                                        </SortableContext>
                                    )}
                                </TableBody>
                            </Table>
                        </DndContext>
                    </div>
                    {/* Pagination Controls */}
                    {
                        totalPages > 1 && (
                            <div className="flex items-center justify-end space-x-2 py-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Previous
                                </Button>
                                <div className="text-sm text-muted-foreground">
                                    Page {currentPage} of {totalPages}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )
                    }
                </CardContent>
            </Card>

            {/* Stock Adjustment Dialog (Detailed) */}
            <StockAdjustmentDialog
                product={selectedProduct}
                open={adjustmentDialogOpen}
                onOpenChange={setAdjustmentDialogOpen}
                onAdjust={handleStockAdjustment}
            />

            {/* Product Form Sheet */}
            <ProductFormSheet
                open={isProductDialogOpen}
                onOpenChange={setProductDialogOpen}
                product={editingProduct}
                onSave={onProductUpdate || (() => { })}
            />

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

            {/* Duplicate Scanner Dialog */}
            <Dialog open={isScanDialogOpen} onOpenChange={setIsScanDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Duplicate Products Found</DialogTitle>
                        <DialogDescription>
                            We found {scanResults.size} groups of products with identical names.
                            Merge them to create single products with variants.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {Array.from(scanResults.entries()).map(([name, group]) => (
                            <div key={name} className="border rounded-lg p-4 bg-muted/20">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-bold text-lg capitalize">{name} <span className="text-sm font-normal text-muted-foreground">({group.length} items)</span></h4>
                                    <Button onClick={() => handleMergeGroup(name, group)} size="sm">Merge Group</Button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {group.map((p, idx) => (
                                        <div key={p.id} className="text-sm border p-2 rounded bg-background relative overflow-hidden">
                                            {idx === 0 && <Badge className="absolute top-0 right-0 rounded-none rounded-bl">Master</Badge>}
                                            <div className="flex items-center gap-2 mb-1">
                                                {p.imageUrl && <Image src={p.imageUrl} alt="" width={24} height={24} className="rounded" />}
                                                <p className="font-semibold truncate">{p.name_te || p.name}</p>
                                            </div>
                                            <p className="text-muted-foreground">{p.unit} - ₹{p.pricePerUnit}</p>
                                            <p className="text-xs">Stock: {p.stockQuantity}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Sticky Bulk Action Bar */}
            {
                selectedProductIds.size > 0 && (
                    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center justify-between gap-4 z-50 animate-in slide-in-from-bottom-4 duration-200 min-w-[500px]">
                        <div className="flex items-center gap-2 mr-4">
                            <div className="bg-white text-black text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                                {selectedProductIds.size}
                            </div>
                            <span className="font-semibold text-sm whitespace-nowrap">Selected</span>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Bulk Status */}
                            <Select onValueChange={(status) => {
                                if (!firestore) return;
                                if (confirm(`Set status of ${selectedProductIds.size} items to ${status}?`)) {
                                    const batch = writeBatch(firestore);
                                    selectedProductIds.forEach(id => {
                                        batch.update(doc(firestore, 'products', id), {
                                            stockQuantity: status === 'OUT_OF_STOCK' ? 0 : status === 'LOW_STOCK' ? 5 : 100 // Approximation
                                        });
                                    });
                                    batch.commit().then(() => {
                                        toast({ title: "Bulk Status Updated" });
                                        setSelectedProductIds(new Set());
                                    });
                                }
                            }}>
                                <SelectTrigger className="w-[110px] h-8 text-xs bg-gray-800 border-gray-700 text-white">
                                    <SelectValue placeholder="Set Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="IN_STOCK">In Stock</SelectItem>
                                    <SelectItem value="LOW_STOCK">Low Stock</SelectItem>
                                    <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Bulk Category */}
                            <Select onValueChange={(category) => {
                                if (!firestore) return;
                                if (confirm(`Move ${selectedProductIds.size} items to ${category}?`)) {
                                    const batch = writeBatch(firestore);
                                    selectedProductIds.forEach(id => {
                                        batch.update(doc(firestore, 'products', id), { category });
                                    });
                                    batch.commit().then(() => {
                                        toast({ title: "Bulk Category Moved" });
                                        setSelectedProductIds(new Set());
                                    });
                                }
                            }}>
                                <SelectTrigger className="w-[120px] h-8 text-xs bg-gray-800 border-gray-700 text-white">
                                    <SelectValue placeholder="Move to..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {(categories && categories.length > 0 ? categories.map(c => c.name) : DEFAULT_CATEGORIES.filter(c => c.id !== 'All').map(c => c.label)).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-full text-xs font-bold gap-1 border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100"
                                onClick={() => {
                                    if (!firestore) return;
                                    if (confirm(`Enable Cut Service (₹10) for ${selectedProductIds.size} items?`)) {
                                        const batch = writeBatch(firestore);
                                        selectedProductIds.forEach(id => {
                                            batch.update(doc(firestore, 'products', id), {
                                                isCutVegetable: true,
                                                cutCharge: 10
                                            });
                                        });
                                        batch.commit().then(() => {
                                            toast({ title: "Bulk Cut Service Enabled", description: "Set charge to ₹10 for selected items." });
                                            setSelectedProductIds(new Set());
                                        }).catch(err => {
                                            toast({ variant: "destructive", title: "Update Failed", description: err.message });
                                        });
                                    }
                                }}
                            >
                                <Scissors className="w-3.5 h-3.5" />
                                Enable Cut
                            </Button>

                            <div className="w-px h-6 bg-gray-700 mx-1" />

                            <Button
                                variant="secondary"
                                size="sm"
                                className="h-8 rounded-full text-xs font-bold"
                                onClick={() => setSelectedProductIds(new Set())}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 rounded-full text-xs font-bold gap-1 bg-red-600 hover:bg-red-700"
                                onClick={() => {
                                    if (!firestore) return;
                                    if (confirm(`Are you sure you want to delete ${selectedProductIds.size} products?`)) {
                                        const batch = writeBatch(firestore);
                                        selectedProductIds.forEach(id => {
                                            batch.delete(doc(firestore, 'products', id));
                                        });
                                        batch.commit().then(() => {
                                            toast({ title: "Bulk Delete Successful", description: `Deleted ${selectedProductIds.size} products.` });
                                            setSelectedProductIds(new Set());
                                        }).catch(err => {
                                            toast({ variant: "destructive", title: "Bulk Delete Failed", description: err.message });
                                        });
                                    }
                                }}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                            </Button>
                        </div>
                    </div>
                )}
        </div>
    );
}
