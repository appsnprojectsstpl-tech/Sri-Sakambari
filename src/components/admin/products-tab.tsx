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
import { Search, Plus, Minus, AlertTriangle, Package, DollarSign, TrendingDown, FilePen, Trash2, PlusCircle, Upload, Loader2, Database, ChevronLeft, ChevronRight, ImagePlus, Scissors, GripVertical } from 'lucide-react';

import { useFirestore, storage, useCollection, useUser } from '@/firebase';
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
import { cn } from '@/lib/utils';

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
    isPriceEditMode: boolean;
    pendingChanges: Record<string, { pricePerUnit?: number; variants?: Record<string, number> }>;
    onPriceChange: (id: string, price: number, variantId?: string) => void;
    isPriceOnly?: boolean;
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
    categories,
    isPriceEditMode,
    pendingChanges,
    onPriceChange,
    isPriceOnly
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

    const pendingPrice = pendingChanges[product.id]?.pricePerUnit;
    const currentPrice = pendingPrice !== undefined ? pendingPrice : product.pricePerUnit;

    const status = getStockStatus(product);
    const stock = (product.variants && product.variants.length > 0 && product.manageStockBy !== 'weight')
        ? product.variants.reduce((acc, v) => acc + (v.stock || 0), 0)
        : product.stockQuantity || 0;

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
            <TableCell className="align-middle">
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
            <TableCell className="font-medium align-middle">
                <div className="text-sm font-bold">{getProductName(product, language as Language)}</div>
                {product.name_te && <div className="text-[11px] text-muted-foreground font-normal">{product.name}</div>}
            </TableCell>
            <TableCell className="align-middle">
                <Select
                    defaultValue={product.category}
                    onValueChange={(val) => {
                        updateDoc(doc(firestore, 'products', product.id), { category: val });
                    }}
                >
                    <SelectTrigger className="w-[130px] h-8 border-none bg-transparent hover:bg-accent text-sm" disabled={isPriceOnly}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {(categories && categories.length > 0 ? categories.map(c => c.name) : DEFAULT_CATEGORIES.filter(c => c.id !== 'All').map(c => c.label)).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                </Select>
            </TableCell>
            <TableCell className="text-right align-middle">
                {isPriceEditMode ? (
                    <div className="flex flex-col gap-2 items-end">
                        {/* Base Price Edit */}
                        <div className="flex items-center justify-end gap-1">
                            <span className="text-muted-foreground text-xs">{product.variants && product.variants.length > 0 ? "Base:" : "₹"}</span>
                            <Input
                                type="number"
                                value={currentPrice}
                                onChange={(e) => onPriceChange(product.id, parseFloat(e.target.value) || 0)}
                                className={cn(
                                    "w-20 h-8 text-right font-bold transition-colors",
                                    pendingPrice !== undefined ? "border-orange-500 bg-orange-50 text-orange-900" : ""
                                )}
                            />
                        </div>
                        {/* Variant Price Edits */}
                        {product.variants?.map((v, i) => {
                            const pVariantPrice = pendingChanges[product.id]?.variants?.[v.id];
                            const curVariantPrice = pVariantPrice !== undefined ? pVariantPrice : v.price;
                            return (
                                <div key={v.id || i} className="flex items-center justify-end gap-1">
                                    <span className="text-muted-foreground text-[10px] break-all max-w-[40px] leading-tight text-right">{v.unit}:</span>
                                    <Input
                                        type="number"
                                        value={curVariantPrice}
                                        onChange={(e) => onPriceChange(product.id, parseFloat(e.target.value) || 0, v.id)}
                                        className={cn(
                                            "w-20 h-7 text-right text-xs font-semibold transition-colors",
                                            pVariantPrice !== undefined ? "border-orange-500 bg-orange-50 text-orange-900" : ""
                                        )}
                                    />
                                </div>
                            );
                        })}
                    </div>
                ) : (product.variants && product.variants.length > 0) ? (
                    <div className="flex flex-col gap-1 text-xs leading-tight">
                        {product.variants.map((v, i) => (
                            <div key={v.id || i} className="whitespace-nowrap flex justify-end gap-1">
                                <span className="font-semibold text-gray-900 text-xs">₹{v.price}</span>
                                <span className="text-muted-foreground">/ {v.unit || 'Size'}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm">₹{product.pricePerUnit}/{product.unit}</div>
                )}
            </TableCell>
            <TableCell className="text-right font-semibold align-middle">
                {(product.variants && product.variants.length > 0 && product.manageStockBy !== 'weight') ? (
                    <div className="flex flex-col gap-1 text-xs leading-tight text-right">
                        {product.variants.map((v, i) => (
                            <div key={v.id || i} className={cn("flex justify-end gap-1", v.stock === 0 ? 'text-destructive' : 'text-gray-600')}>
                                <span>{v.stock}</span>
                                <span className="text-muted-foreground font-normal">({v.unit || 'Size'})</span>
                            </div>
                        ))}
                        <div className="border-t mt-1 pt-1 font-bold text-muted-foreground text-[11px] text-right">
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
            <TableCell className="text-right align-middle">
                {(product.variants && product.variants.length > 0 && product.manageStockBy !== 'weight') ? (
                    <div className="flex flex-col gap-1 text-xs leading-tight">
                        {product.variants.map((v, i) => (
                            <div key={v.id || i} className="whitespace-nowrap text-muted-foreground flex justify-end">
                                ₹{(v.price * (v.stock || 0)).toLocaleString()}
                            </div>
                        ))}
                        <div className="border-t mt-1 pt-1 font-bold text-right text-[11px]">
                            ₹{product.variants.reduce((acc, v) => acc + (v.price * (v.stock || 0)), 0).toLocaleString()}
                        </div>
                    </div>
                ) : (
                    <div className="font-medium">
                        ₹{((product.pricePerUnit || 0) * (product.stockQuantity || 0)).toLocaleString()}
                    </div>
                )}
            </TableCell>
            <TableCell className="text-center align-middle">
                {product.trackInventory ? (
                    <Badge variant="outline" className={getStockStatusColor(status)}>
                        {getStockStatusIcon(status)} {getStockStatusText(status)}
                    </Badge>
                ) : (
                    <Badge variant="secondary">Untracked</Badge>
                )}
            </TableCell>
            <TableCell className="text-right align-middle">
                <div className="flex items-center justify-end gap-1">
                    {product.trackInventory && !isPriceOnly && (
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

                    {!isPriceOnly && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteClick(product)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </TableCell>
        </TableRow>
    );
}

function MobileProductCard({
    product,
    selectedProductIds,
    toggleProductSelection,
    handleQuickAdjust,
    handleEditProduct,
    handleDeleteClick,
    firestore,
    language,
    categories,
    isPriceEditMode,
    pendingChanges,
    onPriceChange,
    isPriceOnly
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
    };

    const pendingPrice = pendingChanges[product.id]?.pricePerUnit;
    const currentPrice = pendingPrice !== undefined ? pendingPrice : product.pricePerUnit;
    const status = getStockStatus(product);
    const stock = (product.variants && product.variants.length > 0 && product.manageStockBy !== 'weight')
        ? product.variants.reduce((acc, v) => acc + (v.stock || 0), 0)
        : product.stockQuantity || 0;

    return (
        <Card ref={setNodeRef} style={style} className={cn("overflow-hidden border-2 mb-3", isDragging ? "bg-muted shadow-lg scale-95" : "")}>
            <CardHeader className="p-3 flex flex-row items-center gap-3 space-y-0 bg-muted/10 border-b">
                <div className="cursor-grab p-1" {...attributes} {...listeners}>
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
                <Checkbox
                    checked={selectedProductIds.has(product.id)}
                    onCheckedChange={() => toggleProductSelection(product.id)}
                />
                <div className="flex-1 truncate font-bold text-sm">
                    {getProductName(product, language as Language)}
                </div>
                <Badge variant="outline" className={cn("text-[10px] px-1 h-5", getStockStatusColor(status))}>
                    {getStockStatusText(status)}
                </Badge>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
                <div className="flex gap-4">
                    <div className="w-16 h-16 shrink-0 bg-muted rounded overflow-hidden relative">
                        {isValidUrl(product.imageUrl) ? (
                            <Image src={product.imageUrl!} alt="" fill className="object-cover" />
                        ) : (
                            <ImagePlus className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
                        )}
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{product.category}</span>
                            <div className="text-right">
                                <div className="font-bold text-primary">₹{currentPrice}</div>
                                <div className="text-[10px] text-muted-foreground">per {product.unit}</div>
                            </div>
                        </div>
                        <div className="flex justify-between items-end">
                            <div className="text-[10px] text-muted-foreground">
                                Stock: <span className={cn("font-medium", stock === 0 ? "text-destructive" : "text-foreground")}>{stock} {product.unit}</span>
                            </div>
                            {isPriceEditMode && (
                                <div className="flex flex-col gap-1 items-end">
                                    <Input
                                        type="number"
                                        value={currentPrice}
                                        onChange={(e) => onPriceChange(product.id, parseFloat(e.target.value) || 0)}
                                        className="h-8 w-20 text-right text-xs"
                                        placeholder="Base"
                                    />
                                    {product.variants?.map((v, i) => {
                                        const pVariantPrice = pendingChanges[product.id]?.variants?.[v.id];
                                        const curVariantPrice = pVariantPrice !== undefined ? pVariantPrice : v.price;
                                        return (
                                            <div key={v.id || i} className="flex items-center gap-1">
                                                <span className="text-[9px] text-muted-foreground">{v.unit}:</span>
                                                <Input
                                                    type="number"
                                                    value={curVariantPrice}
                                                    onChange={(e) => onPriceChange(product.id, parseFloat(e.target.value) || 0, v.id)}
                                                    className="h-7 w-16 text-right text-[10px] px-1"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 pt-1 border-t">
                    {!isPriceOnly && product.trackInventory && (
                        <div className="flex gap-1 flex-1">
                            <Button variant="outline" size="sm" className="h-8 px-2 flex-1" onClick={() => handleQuickAdjust(product, -1)}><Minus className="h-3 w-3" /></Button>
                            <Button variant="outline" size="sm" className="h-8 px-2 flex-1" onClick={() => handleQuickAdjust(product, 1)}><Plus className="h-3 w-3" /></Button>
                        </div>
                    )}
                    <Button variant="secondary" size="sm" className="h-8 px-3" onClick={() => handleEditProduct(product)}>
                        <FilePen className="h-3.5 w-3.5" />
                    </Button>
                    {!isPriceOnly && (
                        <Button variant="ghost" size="sm" className="h-8 px-3 text-destructive" onClick={() => handleDeleteClick(product)}>
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

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
    stockQuantity: 0,
    trackInventory: true,
    variants: []
};

export default function ProductsTab({ products, loading, onProductUpdate }: ProductsTabProps) {
    const { user } = useUser();
    const isPriceOnly = user?.role === 'restricted_admin';

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | StockStatus>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'name' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc' | 'display_order'>('name');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);

    const [isProductDialogOpen, setProductDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
    const [isPriceEditMode, setIsPriceEditMode] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<Record<string, { pricePerUnit?: number; variants?: Record<string, number> }>>({});

    const handlePriceChange = (productId: string, newPrice: number, variantId?: string) => {
        setPendingChanges(prev => {
            const productChanges = prev[productId] || {};
            if (variantId) {
                return {
                    ...prev,
                    [productId]: {
                        ...productChanges,
                        variants: {
                            ...(productChanges.variants || {}),
                            [variantId]: newPrice
                        }
                    }
                };
            } else {
                return {
                    ...prev,
                    [productId]: {
                        ...productChanges,
                        pricePerUnit: newPrice
                    }
                };
            }
        });
    };

    const handleBatchSavePrices = async () => {
        if (!firestore) return;
        setIsSubmitting(true);
        try {
            const batch = writeBatch(firestore);
            Object.entries(pendingChanges).forEach(([id, changes]) => {
                const product = products.find(p => p.id === id);
                if (!product) return;

                const updateData: any = {};
                if (changes.pricePerUnit !== undefined) {
                    updateData.pricePerUnit = changes.pricePerUnit;
                }

                if (changes.variants && product.variants) {
                    const newVariants = product.variants.map(v => {
                        if (changes.variants && changes.variants[v.id] !== undefined) {
                            return { ...v, price: changes.variants[v.id] };
                        }
                        return v;
                    });
                    updateData.variants = newVariants;
                }

                batch.update(doc(firestore, 'products', id), updateData);
            });
            await batch.commit();
            toast({ title: "Prices updated", description: `Successfully updated ${Object.keys(pendingChanges).length} products.` });
            setPendingChanges({});
            setIsPriceEditMode(false);
            if (onProductUpdate) onProductUpdate();
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Save failed" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

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
            if (list.length > 1) duplicates.set(name, list);
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
        const sortedGroup = [...groupProducts].sort((a, b) => {
            if (a.imageUrl && !b.imageUrl) return -1;
            if (!a.imageUrl && b.imageUrl) return 1;
            return 0;
        });
        const master = sortedGroup[0];
        const others = sortedGroup.slice(1);
        const variantGroupId = master.variantGroupId || master.id;
        let newVariants: any[] = [...(master.variants || [])];
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
            batch.update(doc(firestore, 'products', master.id), {
                isMasterProduct: true, variantGroupId, variants: newVariants,
                stockQuantity: newVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0),
                trackInventory: true
            });
            others.forEach(p => {
                batch.update(doc(firestore, 'products', p.id), { masterProductId: master.id, variantGroupId, isMasterProduct: false, isActive: false });
            });
            await batch.commit();
            toast({ title: "Products Merged" });
            setScanResults(prev => {
                const next = new Map(prev);
                next.delete(groupName);
                if (next.size === 0) setIsScanDialogOpen(false);
                return next;
            });
            if (onProductUpdate) onProductUpdate();
        } catch (error) { console.error(error); toast({ variant: "destructive", title: "Merge Failed" }); }
    };

    const firestore = useFirestore();
    const { toast } = useToast();
    const auth = useAuth();
    const { language } = useLanguage();
    const { data: categories } = useCollection<Category>('categories', { constraints: [['orderBy', 'displayOrder', 'asc']] });

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = filteredProducts.findIndex(p => p.id === active.id);
            const newIndex = filteredProducts.findIndex(p => p.id === over?.id);
            if (oldIndex !== -1 && newIndex !== -1) {
                const newOrdered = arrayMove(filteredProducts, oldIndex, newIndex);
                const batch = writeBatch(firestore);
                newOrdered.forEach((p, idx) => {
                    if (p.displayOrder !== idx) batch.update(doc(firestore, 'products', p.id), { displayOrder: idx });
                });
                try {
                    await batch.commit();
                    toast({ title: "Order Updated" });
                } catch (e) {
                    toast({ variant: "destructive", title: "Reorder Failed" });
                }
            }
        }
    };

    const filteredProducts = useMemo(() => {
        let filtered = products;
        if (searchTerm) {
            filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.category.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        if (filterStatus !== 'all') filtered = filtered.filter(p => getStockStatus(p) === filterStatus);
        if (filterCategory !== 'all') filtered = filtered.filter(p => p.category === filterCategory);
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'display_order': return (a.displayOrder || 0) - (b.displayOrder || 0);
                case 'price_asc': return (a.pricePerUnit || 0) - (b.pricePerUnit || 0);
                case 'price_desc': return (b.pricePerUnit || 0) - (a.pricePerUnit || 0);
                case 'stock_asc': return (a.stockQuantity || 0) - (b.stockQuantity || 0);
                case 'stock_desc': return (b.stockQuantity || 0) - (a.stockQuantity || 0);
                default: return a.name.localeCompare(b.name);
            }
        });
        return filtered;
    }, [products, searchTerm, filterStatus, filterCategory, sortBy]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus, products.length]);

    const paginatedProducts = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredProducts, currentPage]);

    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

    const stats = useMemo(() => {
        const trackedProducts = products.filter(p => p.trackInventory);
        return {
            totalProducts: products.length,
            trackedProducts: trackedProducts.length,
            lowStockCount: getLowStockProducts(trackedProducts).length,
            outOfStockCount: getOutOfStockProducts(trackedProducts).length,
            inventoryValue: calculateInventoryValue(trackedProducts)
        };
    }, [products]);

    const handleStockAdjustment = async (productId: string, newStock: number, type: string, quantity: number, reason: string, variantId?: string) => {
        if (!firestore || !auth?.currentUser) return;
        try {
            const product = products.find(p => p.id === productId);
            if (!product) return;
            let updateData: any = { lastRestocked: serverTimestamp() };
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
                updateData.stockQuantity = updatedVariants.reduce((acc, v) => acc + (v.stock || 0), 0);
            } else { updateData.stockQuantity = newStock; }
            await updateDoc(doc(firestore, 'products', productId), updateData);
            await addDoc(collection(firestore, 'stockTransactions'), {
                productId, productName: transactionProductName, type, quantity, previousStock, newStock, reason, timestamp: serverTimestamp(),
                userId: auth.currentUser.uid, userName: auth.currentUser.displayName || auth.currentUser.email || 'Admin', variantId
            });
            toast({ title: 'Stock Updated' });
            onProductUpdate?.();
        } catch (error) { toast({ variant: 'destructive', title: 'Error' }); }
    };

    const handleQuickAdjust = (product: Product, delta: number) => {
        const newStock = Math.max(0, (product.stockQuantity || 0) + delta);
        handleStockAdjustment(product.id, newStock, delta > 0 ? 'ADD' : 'REMOVE', Math.abs(delta), delta > 0 ? 'Quick add' : 'Quick remove');
    };

    const handleEditProduct = (product: Product) => { setEditingProduct(product); setProductDialogOpen(true); };
    const handleDeleteClick = (product: Product) => { setDeletingProduct(product); setDeleteDialogOpen(true); };

    const handleConfirmDelete = async () => {
        if (!firestore || !deletingProduct) return;
        try {
            await deleteDoc(doc(firestore, 'products', deletingProduct.id));
            toast({ title: 'Product Deleted' });
            onProductUpdate?.();
        } catch (error: any) { toast({ variant: 'destructive', title: 'Error Deleting Product' }); }
        finally { setDeleteDialogOpen(false); setDeletingProduct(null); }
    };

    if (loading && products.length === 0) return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading products...</div>;

    return (
        <div className="space-y-6">
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Total Products</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{stats.totalProducts}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Low Stock</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-yellow-600">{stats.lowStockCount}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Out of Stock</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-red-600">{stats.outOfStockCount}</div></CardContent></Card>
                <Card className="hidden md:block"><CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Inventory Value</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">₹{stats.inventoryValue.toLocaleString('en-IN')}</div></CardContent></Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Products & Inventory</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4 mb-4">
                        <div className="flex gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search products..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                            </div>
                            <Button variant={isPriceEditMode ? "default" : "outline"} size="sm" onClick={() => { if (isPriceEditMode && Object.keys(pendingChanges).length > 0) handleBatchSavePrices(); else setIsPriceEditMode(!isPriceEditMode); }} className="gap-2 h-10 px-4" disabled={isSubmitting}>
                                {isPriceEditMode ? <><Database className="h-4 w-4" /> Save</> : <><DollarSign className="h-4 w-4" /> Quick Edit</>}
                            </Button>
                        </div>
                    </div>

                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <div className="hidden md:block border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader><TableRow><TableHead className="w-[50px]"></TableHead><TableHead className="w-[50px]"><Checkbox checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length} onCheckedChange={toggleSelectAll} /></TableHead><TableHead>Image</TableHead><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-center">Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {filteredProducts.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8">No products found</TableCell></TableRow> : (
                                        <SortableContext items={paginatedProducts.map(p => p.id)} strategy={verticalListSortingStrategy}>
                                            {paginatedProducts.map(p => (
                                                <SortableProductRow key={p.id} product={p} selectedProductIds={selectedProductIds} toggleProductSelection={toggleProductSelection} handleQuickAdjust={handleQuickAdjust} handleEditProduct={handleEditProduct} handleDeleteClick={handleDeleteClick} firestore={firestore} language={language} categories={categories || []} isPriceEditMode={isPriceEditMode} pendingChanges={pendingChanges} onPriceChange={handlePriceChange} isPriceOnly={isPriceOnly} />
                                            ))}
                                        </SortableContext>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="md:hidden space-y-1">
                            <SortableContext items={paginatedProducts.map(p => p.id)} strategy={verticalListSortingStrategy}>
                                {paginatedProducts.map(p => (
                                    <MobileProductCard key={p.id} product={p} selectedProductIds={selectedProductIds} toggleProductSelection={toggleProductSelection} handleQuickAdjust={handleQuickAdjust} handleEditProduct={handleEditProduct} handleDeleteClick={handleDeleteClick} firestore={firestore} language={language} categories={categories || []} isPriceEditMode={isPriceEditMode} pendingChanges={pendingChanges} onPriceChange={handlePriceChange} isPriceOnly={isPriceOnly} />
                                ))}
                            </SortableContext>
                        </div>
                    </DndContext>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between py-4 border-t mt-4">
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4 mr-2" /> Prev</Button>
                            <div className="text-sm">Page {currentPage} of {totalPages}</div>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4 ml-2" /></Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <StockAdjustmentDialog product={selectedProduct} open={adjustmentDialogOpen} onOpenChange={setAdjustmentDialogOpen} onAdjust={handleStockAdjustment} />
            <ProductFormSheet open={isProductDialogOpen} onOpenChange={setProductDialogOpen} product={editingProduct} onSave={onProductUpdate || (() => { })} isPriceOnly={isPriceOnly} />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>Delete <span className="font-semibold">{deletingProduct?.name}</span> permanently?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
