'use client';

import { useState, useEffect } from 'react';
import { Product, ProductVariant } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFirestore, storage } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Upload, Plus, Minus, ImagePlus, Loader2, X, AlertCircle, GripVertical, Trash2 } from 'lucide-react';
import { detectCategoryAndUnit } from '@/lib/product-keywords';
import { cn } from '@/lib/utils';
import { haptics, ImpactStyle } from '@/lib/haptics';

const PRODUCT_UNITS = ['Kg', 'Grms', 'Ltr', 'ML', 'Pcs', 'Pkts', 'Mixed'];

const VEG_VARIANT_EXCLUSIONS = ['cabbage', 'cauliflower', 'califlour', 'lettuce', 'broccoli', 'pumpkin'];


// Define categories centrally (consider moving to constants file)
const PRODUCT_CATEGORIES = [
    'Vegetables',
    'Leafy Veg',
    'Fruits',
    'Dairy',
    'Cool Drinks',
    'Water'
];

interface ProductFormSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product: Partial<Product> | null; // Null means "New Product"
    onSave: () => void;
    isPriceOnly?: boolean;
}

const initialProductState: Partial<Product> = {
    name: '',
    category: '',
    pricePerUnit: 0,
    costPrice: 0,
    originalPrice: 0, // MRP
    unit: '',
    isActive: true,
    imageUrl: '',
    images: [],
    imageHint: '',
    displayOrder: 0,
    isCutVegetable: false,
    cutCharge: 0,
    stockQuantity: 0,
    trackInventory: true,
    variants: [],
    soldBy: 'pcs', // Default to per piece
    seoTitle: '',
    seoDescription: '',
    keywords: []
};

interface SortableVariantItemProps {
    variant: ProductVariant;
    images: string[];
    manageStockBy: 'count' | 'weight' | 'volume';
    onUpdate: (id: string, field: keyof ProductVariant, value: any) => void;
    onRemove: (id: string) => void;
}

function SortableVariantItem({ variant, images, manageStockBy, onUpdate, onRemove }: SortableVariantItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: variant.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center justify-between p-3 border rounded-lg bg-white shadow-sm mb-2">
            <div className="flex items-center gap-3 flex-1">
                {/* Drag Handle */}
                <div {...attributes} {...listeners} className="cursor-grab hover:text-primary">
                    <GripVertical className="h-5 w-5 text-gray-400" />
                </div>

                {/* Variant Image Selector */}
                <div className="w-12 h-12 flex-shrink-0">
                    {(images?.length || 0) > 0 ? (
                        <Select value={variant.image || ''} onValueChange={(val) => onUpdate(variant.id, 'image', val)}>
                            <SelectTrigger className="p-0 h-12 w-12 overflow-hidden border-0">
                                {variant.image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={variant.image} alt={variant.unit} className="w-full h-full object-cover rounded" />
                                ) : (
                                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-muted-foreground rounded">
                                        <ImagePlus className="w-4 h-4" />
                                    </div>
                                )}
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="no-image">No Image</SelectItem>
                                {images?.map((url, i) => (
                                    <SelectItem key={i} value={url}>
                                        <div className="flex items-center gap-2">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={url} alt={`Option ${i}`} className="w-8 h-8 object-cover rounded" />
                                            <span>Image {i + 1}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <div className="w-12 h-12 bg-gray-100 flex items-center justify-center rounded text-muted-foreground" title="Upload images in Media tab first">
                            <ImagePlus className="w-4 h-4" />
                        </div>
                    )}
                </div>

                <div className="flex-1">
                    <div className="font-bold text-sm">{variant.unit}</div>
                    <div className="flex gap-2 mt-1">
                        {/* Hide Stock input if Master Stock is used */}
                        {manageStockBy !== 'weight' ? (
                            <div className="w-20">
                                <Input
                                    className="h-7 text-xs"
                                    type="number"
                                    value={variant.stock}
                                    onChange={(e) => onUpdate(variant.id, 'stock', parseInt(e.target.value) || 0)}
                                    placeholder="Stk"
                                />
                            </div>
                        ) : (
                            <div className="text-[10px] text-muted-foreground italic bg-gray-100 px-2 py-0.5 rounded inline-block">
                                From Master
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="w-20">
                    <Input
                        className="h-8 font-bold text-green-600"
                        type="number"
                        value={variant.price}
                        onChange={(e) => onUpdate(variant.id, 'price', parseFloat(e.target.value) || 0)}
                        placeholder="Price"
                    />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(variant.id)} className="text-red-500 h-8 w-8 hover:bg-red-50">
                    <Minus className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

// Default units per category for auto-detection
const CATEGORY_DEFAULT_UNITS: Record<string, string> = {
    'Vegetables': 'Kg',
    'Leafy Veg': 'Pcs', // Bunches
    'Fruits': 'Kg',
    'Dairy': 'Pkts', // Packets
    'Cool Drinks': 'Pcs', // Bottles/Cans
    'Water': 'Pcs' // Cans/Bottles
};

// Default stock mode per category
const CATEGORY_DEFAULT_STOCK_MODE: Record<string, 'count' | 'weight' | 'volume'> = {
    'Vegetables': 'weight',
    'Leafy Veg': 'count', // Usually sold by bunch (Pcs)
    'Fruits': 'weight',
    'Dairy': 'count',
    'Cool Drinks': 'count',
    'Water': 'count',
    'Groceries': 'weight', // Rice, Dal etc.
    'Meat': 'weight',
    'Eggs': 'count'
};

export function ProductFormSheet({ open, onOpenChange, product, onSave, isPriceOnly }: ProductFormSheetProps) {
    const { toast } = useToast();
    const firestore = useFirestore();

    // Form State
    const [formData, setFormData] = useState<Partial<Product>>(initialProductState);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Variant Input State
    const [newVariant, setNewVariant] = useState({ unit: '', price: '', stock: '' });
    const [hasVariants, setHasVariants] = useState(false);

    // Keyword Input State
    const [keywordInput, setKeywordInput] = useState("");

    // Sync product prop to state when opening
    useEffect(() => {
        if (open) {
            setFormData(product ? {
                ...initialProductState,
                ...product,
                // Ensure arrays are initialized
                images: product?.images || (product?.imageUrl ? [product.imageUrl] : []),
                keywords: product?.keywords || []
            } : initialProductState);

            // Sync hasVariants state
            if (product?.variants && product.variants.length > 0) {
                setHasVariants(true);
            } else {
                setHasVariants(false);
            }
        }
    }, [open, product]);


    const handleChange = (field: keyof Product, value: any) => {
        setFormData(prev => {
            const updates: Partial<Product> = { [field]: value };

            // Auto-detect unit and Stock Mode based on category
            if (field === 'name') {
                const detected = detectCategoryAndUnit(value);
                if (detected) {
                    updates.category = detected.category;
                    updates.unit = detected.unit;

                    if (CATEGORY_DEFAULT_STOCK_MODE[detected.category]) {
                        updates.manageStockBy = CATEGORY_DEFAULT_STOCK_MODE[detected.category];
                    }

                    // Auto-Add Default Variants for Vegetables (250g, 500g, 1Kg)
                    if (detected.category === 'Vegetables') {
                        const lowerName = String(value).toLowerCase();
                        const isExcluded = VEG_VARIANT_EXCLUSIONS.some(ex => lowerName.includes(ex));

                        if (!isExcluded) {
                            // Generate default variants
                            setHasVariants(true);
                            updates.variants = [
                                { id: crypto.randomUUID(), unit: '250g', price: 0, stock: 0 },
                                { id: crypto.randomUUID(), unit: '500g', price: 0, stock: 0 },
                                { id: crypto.randomUUID(), unit: '1Kg', price: 0, stock: 0 },
                            ];
                            updates.manageStockBy = 'weight';
                        } else {
                            setHasVariants(false);
                            updates.variants = [];
                        }
                    }
                }
            }

            // Also check manual category change
            if (field === 'category') {
                if (CATEGORY_DEFAULT_UNITS[value] && !prev.unit) {
                    updates.unit = CATEGORY_DEFAULT_UNITS[value];
                }
                if (CATEGORY_DEFAULT_STOCK_MODE[value]) {
                    updates.manageStockBy = CATEGORY_DEFAULT_STOCK_MODE[value];
                }
            }

            // Auto-calculate variant prices from base price (Proportional Pricing)
            // Logic: 250g = 1/4 of Base (1kg), 500g = 1/2 of Base (1kg)
            if (field === 'pricePerUnit' && prev.variants && prev.variants.length > 0 && prev.unit === 'Kg') {
                const basePrice = Number(value);
                if (basePrice > 0) {
                    updates.variants = prev.variants.map(v => {
                        // Only auto-update if price is 0 (freshly added) or we want to force sync?
                        // Let's force sync for standard units if they seem to be standard.
                        let newPrice = v.price;

                        if (v.unit.toLowerCase() === '250g' || v.unit.toLowerCase() === '250 grms') newPrice = Math.ceil(basePrice * 0.25);
                        if (v.unit.toLowerCase() === '500g' || v.unit.toLowerCase() === '500 grms') newPrice = Math.ceil(basePrice * 0.5);
                        if (v.unit.toLowerCase() === '1kg') newPrice = basePrice;

                        return { ...v, price: newPrice };
                    });
                }
            }

            return { ...prev, ...updates };
        });
    };

    // --- Image Handling ---
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!storage) return;

        try {
            setUploadingImage(true);
            const timestamp = Date.now();
            const storageRef = ref(storage, `products/${timestamp}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);

            setFormData(prev => {
                const currentImages = prev.images || [];
                const newImages = [...currentImages, url];
                return {
                    ...prev,
                    images: newImages,
                    imageUrl: newImages[0] // Primary image is always the first one
                };
            });

            toast({ title: "Image Uploaded" });
        } catch (err: any) {
            console.error(err);
            toast({ variant: "destructive", title: "Upload Failed", description: err.message });
        } finally {
            setUploadingImage(false);
        }
    };

    const handleRemoveImage = (index: number) => {
        setFormData(prev => {
            const currentImages = prev.images || [];
            const newImages = currentImages.filter((_, i) => i !== index);
            return {
                ...prev,
                images: newImages,
                imageUrl: newImages.length > 0 ? newImages[0] : ''
            };
        });
    };

    const handleSetPrimaryImage = (index: number) => {
        setFormData(prev => {
            const currentImages = prev.images || [];
            if (index >= currentImages.length) return prev;

            const selectedImage = currentImages[index];
            const otherImages = currentImages.filter((_, i) => i !== index);
            const newImages = [selectedImage, ...otherImages];

            return {
                ...prev,
                images: newImages,
                imageUrl: selectedImage
            };
        });
    };

    // --- Variant Handling ---
    const handleAddVariant = () => {
        if (!newVariant.unit || !newVariant.price) {
            toast({ variant: "destructive", title: "Invalid Variant", description: "Unit and Price are required." });
            return;
        }

        const variant: ProductVariant = {
            id: crypto.randomUUID(),
            unit: newVariant.unit,
            price: parseFloat(newVariant.price),
            stock: parseInt(newVariant.stock) || 0
        };

        const currentVariants = formData.variants || [];
        handleChange('variants', [...currentVariants, variant]);
        setNewVariant({ unit: '', price: '', stock: '' });
    };

    const handleRemoveVariant = (id: string) => {
        const currentVariants = formData.variants || [];
        handleChange('variants', currentVariants.filter(v => v.id !== id));
    };

    // --- Keyword Handling ---
    const handleAddKeyword = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && keywordInput.trim()) {
            e.preventDefault();
            const currentKeywords = formData.keywords || [];
            if (!currentKeywords.includes(keywordInput.trim())) {
                handleChange('keywords', [...currentKeywords, keywordInput.trim()]);
            }
            setKeywordInput("");
        }
    };

    const handleRemoveKeyword = (keywordToRemove: string) => {
        const currentKeywords = formData.keywords || [];
        handleChange('keywords', currentKeywords.filter(k => k !== keywordToRemove));
    };

    // --- Drag & Drop Handling ---
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setFormData((prev) => {
                const oldIndex = (prev.variants || []).findIndex((v) => v.id === active.id);
                const newIndex = (prev.variants || []).findIndex((v) => v.id === over?.id);
                return {
                    ...prev,
                    variants: arrayMove(prev.variants || [], oldIndex, newIndex),
                };
            });
        }
    };

    const handleUpdateVariant = (id: string, field: keyof ProductVariant, value: any) => {
        const currentVariants = formData.variants || [];
        handleChange('variants', currentVariants.map(v => v.id === id ? { ...v, [field]: value } : v));
    };

    // --- Calculations ---
    const totalVariantStock = (formData.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0);

    // Correctly determine effective stock based on mode
    const effectiveStock = formData.manageStockBy === 'weight'
        ? formData.stockQuantity
        : ((formData.variants?.length || 0) > 0 ? totalVariantStock : formData.stockQuantity);

    const profitMargin = formData.pricePerUnit && formData.costPrice
        ? ((Number(formData.pricePerUnit) - Number(formData.costPrice)) / Number(formData.pricePerUnit)) * 100
        : 0;

    // --- Submission ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore) return;
        if (!formData.name || !formData.pricePerUnit) {
            toast({ variant: "destructive", title: "Validation Error", description: "Name and Base Price are required." });
            return;
        }

        setIsSubmitting(true);
        try {
            // Generate variant group ID for master products if not exists
            let variantGroupId = formData.variantGroupId;
            if (formData.isMasterProduct && !variantGroupId) {
                variantGroupId = formData.id || crypto.randomUUID();
            }

            const finalProductData = {
                ...formData,
                pricePerUnit: Number(formData.pricePerUnit),
                costPrice: Number(formData.costPrice || 0),
                originalPrice: Number(formData.originalPrice || 0),
                // Fix Logic: If Weight based (Master Stock), use the input value. 
                // Else (Count based), use sum of variants if variants exist.
                stockQuantity: Number(
                    formData.manageStockBy === 'weight'
                        ? formData.stockQuantity
                        : ((formData.variants?.length || 0) > 0 ? totalVariantStock : formData.stockQuantity)
                ),
                cutCharge: Number(formData.cutCharge),
                variants: formData.variants || [],
                images: formData.images || [],
                keywords: formData.keywords || [],
                // Only include variantGroupId if it has a value (Firestore doesn't allow undefined)
                ...(variantGroupId ? { variantGroupId } : {}),
                // Ensure isMasterProduct is set properly
                isMasterProduct: formData.isMasterProduct || false,
                updatedAt: serverTimestamp()
            };

            if (formData.id) {
                // Update
                await setDoc(doc(firestore, 'products', formData.id), finalProductData, { merge: true });
                toast({ title: "Product Updated" });
            } else {
                // Create
                const docRef = await addDoc(collection(firestore, 'products'), {
                    ...finalProductData,
                    createdAt: serverTimestamp(),
                    lastRestocked: serverTimestamp()
                });
                await setDoc(docRef, { id: docRef.id }, { merge: true });
                toast({ title: "Product Created" });
            }
            onOpenChange(false);
            // Small delay to allow animation to start closing before heavy refresh
            setTimeout(() => onSave(), 100);
        } catch (error: any) {
            console.error(error);
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const isEdit = !!formData.id;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-[100%] sm:max-w-[50vw] sm:w-[50vw] p-0">
                <div className="flex flex-col h-full bg-white">
                    <div className="p-6 border-b">
                        <SheetHeader>
                            <SheetTitle>{isEdit ? `Edit ${formData.name}` : 'New Product'}</SheetTitle>
                            <SheetDescription>
                                {isEdit ? 'Make changes to your product here.' : 'Add a new item to your catalog.'}
                            </SheetDescription>
                        </SheetHeader>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <form id="product-form" onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* 1. Basic Identity (Auto-Detected) */}
                            <div className="space-y-4 bg-gray-50 p-4 rounded-lg border">
                                <div className="grid gap-2">
                                    <Label htmlFor="name" className="text-base font-semibold">Product Name</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={e => handleChange('name', e.target.value)}
                                        placeholder="e.g. Tomato, Milk, Chicken"
                                        className="text-lg bg-white"
                                        disabled={isPriceOnly}
                                        autoFocus // Auto focus on open
                                    />
                                    <p className="text-xs text-muted-foreground">Category & Unit will be set automatically.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="category">Category</Label>
                                        <Select
                                            value={formData.category}
                                            onValueChange={val => handleChange('category', val)}
                                            disabled={isPriceOnly}
                                        >
                                            <SelectTrigger className="bg-white"><SelectValue placeholder="Category" /></SelectTrigger>
                                            <SelectContent>
                                                {PRODUCT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="unit">Base Unit</Label>
                                        <Select
                                            value={formData.unit}
                                            onValueChange={val => handleChange('unit', val)}
                                            disabled={isPriceOnly}
                                        >
                                            <SelectTrigger className="bg-white"><SelectValue placeholder="Unit" /></SelectTrigger>
                                            <SelectContent>
                                                {PRODUCT_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Sold By - Simplified Product Type Selection */}
                                <div className="grid gap-2 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                                    <Label htmlFor="soldBy" className="font-semibold text-blue-900">Sold By</Label>
                                    <Select
                                        value={formData.soldBy || 'pcs'}
                                        disabled={isPriceOnly}
                                        onValueChange={(val: 'pcs' | 'kg') => {
                                            handleChange('soldBy', val);

                                            // Auto-create variants for Per Kg
                                            if (val === 'kg' && (!formData.variants || formData.variants.length === 0)) {
                                                const basePrice = formData.pricePerUnit || 0;
                                                const autoVariants: ProductVariant[] = [
                                                    {
                                                        id: crypto.randomUUID(),
                                                        unit: '250g',
                                                        price: Math.round(basePrice * 0.25),
                                                        stock: 0,
                                                        image: formData.imageUrl || ''
                                                    },
                                                    {
                                                        id: crypto.randomUUID(),
                                                        unit: '500g',
                                                        price: Math.round(basePrice * 0.50),
                                                        stock: 0,
                                                        image: formData.imageUrl || ''
                                                    },
                                                    {
                                                        id: crypto.randomUUID(),
                                                        unit: '1kg',
                                                        price: basePrice,
                                                        stock: 0,
                                                        image: formData.imageUrl || ''
                                                    }
                                                ];
                                                handleChange('variants', autoVariants);
                                                setHasVariants(true);
                                                toast({
                                                    title: "Weight variants added",
                                                    description: "Added 250g, 500g, and 1kg variants. You can customize them below."
                                                });
                                            }

                                            // Clear variants for Per Pcs
                                            if (val === 'pcs') {
                                                handleChange('variants', []);
                                                setHasVariants(false);
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Select how product is sold" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pcs">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold">Per Pcs</span>
                                                    <span className="text-xs text-muted-foreground">Sold by pieces (e.g., 1 cabbage)</span>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="kg">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold">Per Kg</span>
                                                    <span className="text-xs text-muted-foreground">Weight-based with variants (250g, 500g, 1kg)</span>
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-blue-700">
                                        {formData.soldBy === 'kg'
                                            ? '✓ Weight variants will be auto-created (you can customize them)'
                                            : '✓ Product sold as individual pieces'}
                                    </p>
                                </div>
                            </div>

                            {/* 2. Main Details (Single Product Mode - Always Visible for main props) */}
                            <div className="space-y-4">
                                <Label className="text-lg font-semibold">Product Details</Label>
                                <div className="flex gap-4 items-start">
                                    {/* Quick Image Upload (Simplified) */}
                                    <div className="w-32 flex flex-col gap-2">
                                        <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-gray-50 relative overflow-hidden group">
                                            {formData.imageUrl ? (
                                                <>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={formData.imageUrl} alt="Product" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button type="button" variant="secondary" size="sm" onClick={() => document.getElementById('single-image-upload')?.click()}>Change</Button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div onClick={() => document.getElementById('single-image-upload')?.click()} className="cursor-pointer flex flex-col items-center gap-1 text-muted-foreground hover:text-primary">
                                                    <ImagePlus className="w-8 h-8" />
                                                    <span className="text-xs">Add Image</span>
                                                </div>
                                            )}
                                            <input
                                                id="single-image-upload"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleImageUpload}
                                                disabled={uploadingImage || isPriceOnly}
                                            />
                                            {uploadingImage && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}
                                        </div>
                                        <Input
                                            placeholder="...or paste URL"
                                            value={formData.imageUrl || ''}
                                            onChange={e => {
                                                const newUrl = e.target.value;
                                                setFormData(prev => {
                                                    const newImages = [...(prev.images || [])];
                                                    if (newImages.length > 0) {
                                                        newImages[0] = newUrl;
                                                    } else {
                                                        newImages.push(newUrl);
                                                    }
                                                    return { ...prev, imageUrl: newUrl, images: newImages };
                                                });
                                            }}
                                            className="text-xs h-7 px-2"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Add Gallery Image URL"
                                                value={formData.imageHint || ''}
                                                onChange={e => handleChange('imageHint', e.target.value)}
                                                className="text-xs h-9"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const url = formData.imageHint;
                                                        if (url && isValidUrl(url)) {
                                                            setFormData(prev => {
                                                                const current = prev.images || [];
                                                                const updated = [...current, url];
                                                                return {
                                                                    ...prev,
                                                                    images: updated,
                                                                    imageUrl: updated[0], // Auto-set primary
                                                                    imageHint: '' // Clear input
                                                                };
                                                            });
                                                        }
                                                    }
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="secondary"
                                                disabled={isPriceOnly}
                                                onClick={() => {
                                                    const url = formData.imageHint;
                                                    if (url && isValidUrl(url)) {
                                                        setFormData(prev => {
                                                            const current = prev.images || [];
                                                            const updated = [...current, url];
                                                            return {
                                                                ...prev,
                                                                images: updated,
                                                                imageUrl: updated[0],
                                                                imageHint: ''
                                                            };
                                                        });
                                                    }
                                                }}
                                            >
                                                Add
                                            </Button>
                                        </div>

                                        {/* Image Gallery List */}
                                        {(formData.images && formData.images.length > 0) && (
                                            <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded border max-h-32 overflow-y-auto">
                                                {formData.images.map((url, i) => (
                                                    <div key={i} className="relative group w-12 h-12 border rounded overflow-hidden bg-white">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={url} alt={`img-${i}`} className="w-full h-full object-cover" />
                                                        <div
                                                            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer text-white"
                                                            onClick={() => handleRemoveImage(i)}
                                                        >
                                                            <Minus className="w-4 h-4" />
                                                        </div>
                                                        {i === 0 && <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500" title="Primary Image" />}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Price & Stock */}
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-base font-bold">Pricing & Stock</Label>
                                            {false && formData.category === 'Fruits' && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={isPriceOnly}
                                                    onClick={() => {
                                                        const fruitVariants: ProductVariant[] = [
                                                            { id: crypto.randomUUID(), unit: '1 Pc', price: formData.pricePerUnit || 0, stock: 0 },
                                                            { id: crypto.randomUUID(), unit: '1 Kg', price: formData.pricePerUnit || 0, stock: 0 }
                                                        ];
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            variants: fruitVariants,
                                                            unit: 'Mixed',
                                                            trackInventory: true,
                                                            manageStockBy: 'count'
                                                        }));
                                                        setHasVariants(true);
                                                        haptics.impact(ImpactStyle.Light);
                                                        toast({ title: "Fruit sizes added", description: "Added 1 Pc and 1 Kg variants. Stock is now managed per size." });
                                                    }}
                                                    className="h-8 text-xs gap-1.5 border-orange-200 text-orange-700 hover:bg-orange-50"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    Auto-Fill Fruit Sizes
                                                </Button>
                                            )}
                                        </div>


                                        {/* Stock Management Mode Selector - HIDDEN: Replaced by simpler "Sold By" dropdown */}
                                        {false && (
                                            <div className="bg-muted/30 p-3 rounded-xl border border-border/50 space-y-3">
                                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock Management Mode</Label>
                                                <RadioGroup
                                                    value={formData.trackInventory ? (formData.manageStockBy || 'count') : 'none'}
                                                    onValueChange={(val) => {
                                                        if (val === 'none') {
                                                            setFormData(prev => ({ ...prev, trackInventory: false }));
                                                        } else {
                                                            setFormData(prev => ({ ...prev, trackInventory: true, manageStockBy: val as any }));
                                                        }
                                                    }}
                                                    className="grid grid-cols-3 gap-2"
                                                >
                                                    <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border shadow-sm cursor-pointer hover:bg-gray-50">
                                                        <RadioGroupItem value="weight" id="stock-weight" />
                                                        <Label htmlFor="stock-weight" className="text-[10px] leading-tight cursor-pointer">Master Stock (Total Kg/L)</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border shadow-sm cursor-pointer hover:bg-gray-50">
                                                        <RadioGroupItem value="count" id="stock-count" />
                                                        <Label htmlFor="stock-count" className="text-[10px] leading-tight cursor-pointer">Per Variant (Count)</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border shadow-sm cursor-pointer hover:bg-gray-50">
                                                        <RadioGroupItem value="none" id="stock-none" />
                                                        <Label htmlFor="stock-none" className="text-[10px] leading-tight cursor-pointer">No Tracking</Label>
                                                    </div>
                                                </RadioGroup>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="grid gap-2">
                                                <Label htmlFor="price">Price (₹)</Label>
                                                <Input id="price" type="number" value={formData.pricePerUnit} onChange={e => handleChange('pricePerUnit', e.target.value)} className="font-bold text-lg" placeholder="0" />
                                            </div>
                                            {false && (
                                                <div className="grid gap-2">
                                                    <Label htmlFor="mrp" className="text-muted-foreground">Original (MRP)</Label>
                                                    <Input id="mrp" type="number" value={formData.originalPrice} onChange={e => handleChange('originalPrice', e.target.value)} placeholder="0" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="single-stock" className={cn(
                                                formData.manageStockBy === 'count' && (formData.variants?.length || 0) > 0 ? "text-muted-foreground" : ""
                                            )}>
                                                {formData.manageStockBy === 'weight'
                                                    ? 'Total Master Stock (Kg/L)'
                                                    : (formData.manageStockBy === 'count' && (formData.variants?.length || 0) > 0)
                                                        ? 'Total Calculated Stock'
                                                        : 'Current Stock (Qty)'}
                                            </Label>
                                            <Input
                                                id="single-stock"
                                                type="number"
                                                value={effectiveStock}
                                                onChange={e => handleChange('stockQuantity', e.target.value)}
                                                className={cn(
                                                    "bg-green-50 border-green-200",
                                                    (formData.manageStockBy === 'count' && (formData.variants?.length || 0) > 0) && "bg-gray-100 border-gray-200 cursor-not-allowed opacity-70"
                                                )}
                                                placeholder="Stock"
                                                readOnly={(formData.manageStockBy === 'count' && (formData.variants?.length || 0) > 0) || isPriceOnly}
                                            />
                                            {formData.manageStockBy === 'weight' && (
                                                <p className="text-[10px] text-muted-foreground">Variants deduct from this shared pile.</p>
                                            )}
                                            {formData.manageStockBy === 'count' && (formData.variants?.length || 0) > 0 && (
                                                <p className="text-[10px] text-orange-600 font-medium italic">Stock is managed inside each size below.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Cut Service (Conditional) */}
                            {(formData.category === 'Vegetables' || formData.category === 'Leafy Veg') && (
                                <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <Checkbox
                                            id="cutService"
                                            checked={formData.isCutVegetable}
                                            onCheckedChange={(c) => {
                                                if (isPriceOnly) return;
                                                handleChange('isCutVegetable', c);
                                                if (c && (!formData.cutCharge || formData.cutCharge === 0)) {
                                                    handleChange('cutCharge', 10);
                                                }
                                            }}
                                        />
                                        <Label htmlFor="cutService" className="font-semibold text-orange-900 cursor-pointer">Enable Cut Service?</Label>
                                    </div>
                                    {formData.isCutVegetable && (
                                        <div className="animate-in slide-in-from-top-2 ml-6">
                                            <Label htmlFor="cutCharge" className="text-xs">Cutting Charge Anount (₹)</Label>
                                            <Input
                                                id="cutCharge"
                                                type="number"
                                                value={formData.cutCharge}
                                                onChange={e => handleChange('cutCharge', e.target.value)}
                                                disabled={isPriceOnly}
                                                className="w-32 bg-white mt-1"
                                                placeholder="10"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 4. Master Product & Variants Toggle & Section */}
                            <div className="pt-4 border-t">
                                <div className="flex items-center justify-between mb-4">
                                    <Label className="text-base text-muted-foreground">Product Variants</Label>
                                    <div className="flex items-center gap-2">
                                        {false && (
                                            <>
                                                <Checkbox
                                                    id="isMasterProduct"
                                                    checked={formData.isMasterProduct || false}
                                                    onCheckedChange={(checked) => {
                                                        handleChange('isMasterProduct', checked);
                                                        if (checked) {
                                                            // When marking as master product, ensure it has variants
                                                            if (!hasVariants || (!formData.variants || formData.variants.length === 0)) {
                                                                setHasVariants(true);
                                                                if (formData.category === 'Vegetables') {
                                                                    const lowerName = String(formData.name).toLowerCase();
                                                                    const isExcluded = VEG_VARIANT_EXCLUSIONS.some(ex => lowerName.includes(ex));

                                                                    if (!isExcluded) {
                                                                        const basePrice = Number(formData.pricePerUnit || 0);
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            manageStockBy: 'weight',
                                                                            variants: [
                                                                                { id: crypto.randomUUID(), unit: '250g', price: basePrice > 0 ? Math.ceil(basePrice * 0.25) : 0, stock: 0 },
                                                                                { id: crypto.randomUUID(), unit: '500g', price: basePrice > 0 ? Math.ceil(basePrice * 0.5) : 0, stock: 0 },
                                                                                { id: crypto.randomUUID(), unit: '1Kg', price: basePrice, stock: 0 },
                                                                            ]
                                                                        }));
                                                                        toast({ title: "Master Product Setup", description: "Auto-added standard variants for master product." });
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }}
                                                />
                                                <Label htmlFor="isMasterProduct" className="font-semibold cursor-pointer">Master Product</Label>
                                            </>
                                        )}
                                    </div>
                                    <Button
                                        type="button"
                                        variant={hasVariants ? "secondary" : "outline"}
                                        size="sm"
                                        onClick={() => {
                                            const newHasVariants = !hasVariants;
                                            setHasVariants(newHasVariants);

                                            // Smart Populate: If turning ON variants for a Vegetable that has none
                                            if (newHasVariants && (!formData.variants || formData.variants.length === 0) && formData.category === 'Vegetables') {
                                                const lowerName = String(formData.name).toLowerCase();
                                                const isExcluded = VEG_VARIANT_EXCLUSIONS.some(ex => lowerName.includes(ex));

                                                if (!isExcluded) {
                                                    const basePrice = Number(formData.pricePerUnit || 0);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        manageStockBy: 'weight',
                                                        variants: [
                                                            { id: crypto.randomUUID(), unit: '250g', price: basePrice > 0 ? Math.ceil(basePrice * 0.25) : 0, stock: 0 },
                                                            { id: crypto.randomUUID(), unit: '500g', price: basePrice > 0 ? Math.ceil(basePrice * 0.5) : 0, stock: 0 },
                                                            { id: crypto.randomUUID(), unit: '1Kg', price: basePrice, stock: 0 },
                                                        ]
                                                    }));
                                                    toast({ title: "Auto-Added Standard Variants", description: "250g, 500g, 1Kg added for you." });
                                                }
                                            }
                                        }}
                                    >
                                        {hasVariants ? "Hide Variants" : "Add Variants / Sizes +"}
                                    </Button>
                                    {isPriceOnly && <span className="text-[10px] text-muted-foreground ml-2">(ReadOnly)</span>}
                                </div>

                                {hasVariants && (
                                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 mb-2">
                                            <strong>Note:</strong>
                                            {formData.manageStockBy === 'weight'
                                                ? " Stock is managed by the Main Total Stock above."
                                                : " Enter specific stock for each size below."}
                                        </div>
                                        {/* Simplified Variant Display - Auto-calculated from base price */}
                                        <div className="p-4 border rounded-xl bg-blue-50/50 border-blue-200 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-sm font-semibold text-blue-900">Weight Variants</Label>
                                                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tighter bg-blue-100 text-blue-700">Auto-calculated</Badge>
                                            </div>
                                            <p className="text-xs text-blue-700">
                                                Prices are automatically calculated from your base price. You can edit them below if needed.
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            {formData.variants?.length === 0 && (
                                                <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                                                    No variants added.<br />Select "Per Kg" in Sold By to auto-create weight variants.
                                                </div>
                                            )}

                                            {/* Simple Variant Table */}
                                            {formData.variants && formData.variants.length > 0 && (
                                                <div className="border rounded-lg overflow-hidden">
                                                    <table className="w-full">
                                                        <thead className="bg-gray-100">
                                                            <tr>
                                                                <th className="text-left p-3 text-sm font-semibold">Size</th>
                                                                <th className="text-left p-3 text-sm font-semibold">Price (₹)</th>
                                                                <th className="text-right p-3 text-sm font-semibold w-20">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white divide-y">
                                                            {formData.variants.map((variant) => (
                                                                <tr key={variant.id} className="hover:bg-gray-50">
                                                                    <td className="p-3">
                                                                        <Input
                                                                            value={variant.unit}
                                                                            onChange={(e) => handleUpdateVariant(variant.id, 'unit', e.target.value)}
                                                                            disabled={isPriceOnly}
                                                                            className="h-8 w-24"
                                                                            placeholder="250g"
                                                                        />
                                                                    </td>
                                                                    <td className="p-3">
                                                                        <Input
                                                                            type="number"
                                                                            value={variant.price}
                                                                            onChange={(e) => handleUpdateVariant(variant.id, 'price', Number(e.target.value))}
                                                                            disabled={isPriceOnly}
                                                                            className="h-8 w-28 font-semibold"
                                                                            placeholder="0"
                                                                        />
                                                                    </td>
                                                                    <td className="p-3 text-right">
                                                                        {!isPriceOnly && (
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => handleRemoveVariant(variant.id)}
                                                                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </form>
                    </div>

                    <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" form="product-form" disabled={isSubmitting || uploadingImage}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Product
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
