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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Plus, Minus, ImagePlus, Loader2, X, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, storage } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

// Define categories centrally (consider moving to constants file)
const PRODUCT_CATEGORIES = [
    'Vegetables',
    'Leafy Vegetables',
    'Fruits',
    'Dairy',
    'Cool Drinks',
    'Drinking Water'
];

interface ProductFormSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product: Partial<Product> | null; // Null means "New Product"
    onSave: () => void;
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
    seoTitle: '',
    seoDescription: '',
    keywords: []
};

export function ProductFormSheet({ open, onOpenChange, product, onSave }: ProductFormSheetProps) {
    const { toast } = useToast();
    const firestore = useFirestore();

    // Form State
    const [formData, setFormData] = useState<Partial<Product>>(initialProductState);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState("basic");

    // Variant Input State
    const [newVariant, setNewVariant] = useState({ unit: '', price: '', stock: '' });

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
            setActiveTab("basic");
        }
    }, [open, product]);

    const handleChange = (field: keyof Product, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
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

    // --- Calculations ---
    const totalVariantStock = (formData.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0);
    const effectiveStock = (formData.variants?.length || 0) > 0 ? totalVariantStock : formData.stockQuantity;

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
            const finalProductData = {
                ...formData,
                pricePerUnit: Number(formData.pricePerUnit),
                costPrice: Number(formData.costPrice || 0),
                originalPrice: Number(formData.originalPrice || 0),
                // Use total variant stock if variants exist, otherwise use manual input
                stockQuantity: Number((formData.variants?.length || 0) > 0 ? totalVariantStock : formData.stockQuantity),
                cutCharge: Number(formData.cutCharge),
                variants: formData.variants || [],
                images: formData.images || [],
                keywords: formData.keywords || [],
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
            onSave();
            onOpenChange(false);
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
            <SheetContent side="right" className="w-[100%] sm:w-[540px] overflow-y-auto">
                <SheetHeader className="mb-6">
                    <SheetTitle>{isEdit ? `Edit ${formData.name}` : 'New Product'}</SheetTitle>
                    <SheetDescription>
                        {isEdit ? 'Make changes to your product here.' : 'Add a new item to your catalog.'}
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="space-y-6 pb-20">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="basic">Basic</TabsTrigger>
                            <TabsTrigger value="media">Media</TabsTrigger>
                            <TabsTrigger value="variants">Variants</TabsTrigger>
                            <TabsTrigger value="seo">SEO</TabsTrigger>
                        </TabsList>

                        {/* --- BASIC INFO TAB --- */}
                        <TabsContent value="basic" className="space-y-4 pt-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Product Name</Label>
                                <Input id="name" value={formData.name} onChange={e => handleChange('name', e.target.value)} placeholder="e.g. Tomato" required />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="category">Category</Label>
                                    <Select value={formData.category} onValueChange={val => handleChange('category', val)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PRODUCT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="unit">Base Unit</Label>
                                    <Input id="unit" value={formData.unit} onChange={e => handleChange('unit', e.target.value)} placeholder="e.g. kg" />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="costPrice">Cost Price</Label>
                                    <Input id="costPrice" type="number" value={formData.costPrice} onChange={e => handleChange('costPrice', e.target.value)} placeholder="cost" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="price">Selling Price</Label>
                                    <Input id="price" type="number" value={formData.pricePerUnit} onChange={e => handleChange('pricePerUnit', e.target.value)} required placeholder="price" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="mrp">MRP</Label>
                                    <Input id="mrp" type="number" value={formData.originalPrice} onChange={e => handleChange('originalPrice', e.target.value)} placeholder="MRP" />
                                </div>
                            </div>

                            {/* Margin Indicator */}
                            <div className="flex items-center justify-between text-xs px-2 py-1 bg-muted/50 rounded">
                                <span className="text-muted-foreground">Estimated Margin:</span>
                                <span className={`font-bold ${profitMargin > 20 ? 'text-green-600' : profitMargin > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {profitMargin.toFixed(1)}%
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="stock">Current Stock {(formData.variants?.length || 0) > 0 && '(Auto-sum from Variants)'}</Label>
                                    <Input
                                        id="stock"
                                        type="number"
                                        value={effectiveStock}
                                        onChange={e => handleChange('stockQuantity', e.target.value)}
                                        disabled={(formData.variants?.length || 0) > 0}
                                        className={(formData.variants?.length || 0) > 0 ? "bg-muted text-muted-foreground" : ""}
                                    />
                                </div>
                                <div className="flex items-center space-x-2 pt-8">
                                    <Checkbox id="trackInventory" checked={formData.trackInventory} onCheckedChange={(c) => handleChange('trackInventory', c)} />
                                    <Label htmlFor="trackInventory">Track Inventory</Label>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2 pt-2">
                                <Checkbox id="isActive" checked={formData.isActive} onCheckedChange={(c) => handleChange('isActive', c)} />
                                <Label htmlFor="isActive">Active (Visible in App)</Label>
                            </div>

                            <div className="border-t pt-4 mt-4">
                                <h4 className="border-b pb-2 mb-4 font-semibold text-sm">Services</h4>
                                <div className="flex items-center space-x-2 mb-4">
                                    <Checkbox id="isCut" checked={formData.isCutVegetable} onCheckedChange={(c) => handleChange('isCutVegetable', c)} />
                                    <Label htmlFor="isCut">Cutting Service Available</Label>
                                </div>
                                {formData.isCutVegetable && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="cutCharge">Cutting Charge (₹)</Label>
                                        <Input id="cutCharge" type="number" value={formData.cutCharge} onChange={e => handleChange('cutCharge', e.target.value)} />
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* --- MEDIA TAB --- */}
                        <TabsContent value="media" className="space-y-4 pt-4">
                            <div className="grid grid-cols-3 gap-4">
                                {(formData.images || []).map((url, index) => (
                                    <div key={index} className="relative aspect-square border rounded-lg overflow-hidden group bg-gray-50">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={url} alt={`Product ${index}`} className="w-full h-full object-cover" />

                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                            {index !== 0 && (
                                                <Button type="button" size="xs" variant="secondary" onClick={() => handleSetPrimaryImage(index)}>
                                                    Make Primary
                                                </Button>
                                            )}
                                            <Button type="button" size="icon" variant="destructive" className="h-8 w-8" onClick={() => handleRemoveImage(index)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        {index === 0 && (
                                            <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded shadow">
                                                Primary
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <div className="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-4 hover:bg-gray-50 transition-colors relative">
                                    <Label htmlFor="imageUpload" className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
                                        {uploadingImage ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> : <Plus className="h-8 w-8 text-muted-foreground" />}
                                        <span className="text-xs text-muted-foreground mt-2">{uploadingImage ? 'Uploading...' : 'Add Image'}</span>
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
                            </div>

                            <div className="space-y-2 pt-4 border-t">
                                <Label className="text-sm text-muted-foreground">Add by URL</Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="https://..."
                                        value={formData.imageUrl || ''}
                                        onChange={e => handleChange('imageUrl', e.target.value)}
                                        className="text-xs"
                                    />
                                    <Button type="button" size="sm" variant="outline" onClick={() => {
                                        if (formData.imageUrl && !formData.images?.includes(formData.imageUrl)) {
                                            handleChange('images', [...(formData.images || []), formData.imageUrl]);
                                            toast({ title: "Image Added" });
                                        }
                                    }}>Add</Button>
                                </div>
                            </div>
                        </TabsContent>

                        {/* --- VARIANTS TAB --- */}
                        <TabsContent value="variants" className="space-y-4 pt-4">
                            <div className="space-y-4">
                                <div className="flex items-end gap-2 border p-3 rounded-lg bg-gray-50">
                                    <div className="flex-1">
                                        <Label className="text-xs">Unit (e.g. 500g)</Label>
                                        <Input className="bg-white" value={newVariant.unit} onChange={e => setNewVariant({ ...newVariant, unit: e.target.value })} placeholder="Size" />
                                    </div>
                                    <div className="w-24">
                                        <Label className="text-xs">Price</Label>
                                        <Input className="bg-white" type="number" value={newVariant.price} onChange={e => setNewVariant({ ...newVariant, price: e.target.value })} placeholder="₹" />
                                    </div>
                                    <div className="w-24">
                                        <Label className="text-xs">Stock</Label>
                                        <Input className="bg-white" type="number" value={newVariant.stock} onChange={e => setNewVariant({ ...newVariant, stock: e.target.value })} placeholder="#" />
                                    </div>
                                    <Button type="button" onClick={handleAddVariant} size="icon">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    {formData.variants?.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                                            No variants added.<br />Use the form above to add sizes like 500g, 1kg.
                                        </div>
                                    )}
                                    {formData.variants?.map((v) => (
                                        <div key={v.id} className="flex items-center justify-between p-3 border rounded-lg bg-white shadow-sm">
                                            <div className="flex items-center gap-3">
                                                {/* Variant Image Selector */}
                                                <div className="w-12 h-12 flex-shrink-0">
                                                    {(formData.images?.length || 0) > 0 ? (
                                                        <Select value={v.image || ''} onValueChange={(val) => {
                                                            const updatedVariants = formData.variants?.map(variant =>
                                                                variant.id === v.id ? { ...variant, image: val } : variant
                                                            );
                                                            handleChange('variants', updatedVariants);
                                                        }}>
                                                            <SelectTrigger className="p-0 h-12 w-12 overflow-hidden border-0">
                                                                {v.image ? (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img src={v.image} alt={v.unit} className="w-full h-full object-cover rounded" />
                                                                ) : (
                                                                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-muted-foreground rounded">
                                                                        <ImagePlus className="w-4 h-4" />
                                                                    </div>
                                                                )}
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="no-image">No Image</SelectItem>
                                                                {formData.images?.map((url, i) => (
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

                                                <div>
                                                    <div className="font-bold text-sm">{v.unit}</div>
                                                    <div className="text-xs text-muted-foreground">Stock: {v.stock}</div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="font-bold text-green-600">₹{v.price}</div>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveVariant(v.id)} className="text-red-500 h-8 w-8 hover:bg-red-50">
                                                    <Minus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </TabsContent>

                        {/* --- SEO TAB --- */}
                        <TabsContent value="seo" className="space-y-4 pt-4">
                            <div className="grid gap-2">
                                <Label htmlFor="seoTitle">SEO Title</Label>
                                <Input id="seoTitle" value={formData.seoTitle || ''} onChange={e => handleChange('seoTitle', e.target.value)} placeholder="Wait a moment..." />
                                <p className="text-[10px] text-muted-foreground">Recommended: Product Name | Store Name</p>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="seoDescription">SEO Description</Label>
                                <Textarea
                                    id="seoDescription"
                                    value={formData.seoDescription || ''}
                                    onChange={e => handleChange('seoDescription', e.target.value)}
                                    placeholder="Fresh organic tomatoes..."
                                    className="h-20"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label>Keywords</Label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {(formData.keywords || []).map(k => (
                                        <Badge key={k} variant="secondary" className="gap-1">
                                            {k}
                                            <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => handleRemoveKeyword(k)} />
                                        </Badge>
                                    ))}
                                </div>
                                <Input
                                    placeholder="Type keyword and press Enter..."
                                    value={keywordInput}
                                    onChange={e => setKeywordInput(e.target.value)}
                                    onKeyDown={handleAddKeyword}
                                />
                            </div>
                        </TabsContent>
                    </Tabs>

                    <SheetFooter className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t flex flex-row justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting || uploadingImage}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Product
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}
