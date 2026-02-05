'use client';

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle
} from '@/components/ui/sheet';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Share2 } from 'lucide-react';
import { getProductName } from '@/lib/translations';
import { useLanguage } from '@/context/language-context';
import type { Product } from '@/lib/types';
import { haptics, ImpactStyle } from '@/lib/haptics';
import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ProductDetailsSheetProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    cartQuantity: number;
    cutCartQuantity: number;
    onAddToCart: (product: Product, quantity: number, isCut: boolean) => void;
    onUpdateQuantity: (productId: string, isCut: boolean, newQuantity: number) => void;
}

export default function ProductDetailsSheet({
    isOpen,
    onClose,
    product,
    cartQuantity,
    cutCartQuantity,
    onAddToCart,
    onUpdateQuantity
}: ProductDetailsSheetProps) {
    const { language } = useLanguage();
    const [isCutSelected, setIsCutSelected] = useState(false);

    if (!product) return null;

    const discountValues = [15, 20, 25, 40];
    const discount = discountValues[product.id.charCodeAt(0) % discountValues.length];
    const originalPrice = Math.round(product.pricePerUnit * (100 / (100 - discount)));

    // Active quantity based on selection (Regular vs Cut)
    // Actually, Zepto details often show one main add button, or variants.
    // We will show a toggle or simply default to Regular, with Cut as an option if available.

    const currentQuantity = isCutSelected ? cutCartQuantity : cartQuantity;

    const handleAdd = () => {
        haptics.impact(ImpactStyle.Medium);
        if (currentQuantity === 0) {
            onAddToCart(product, 1, isCutSelected);
        } else {
            onUpdateQuantity(product.id, isCutSelected, currentQuantity + 1);
        }
    };

    const handleRemove = () => {
        haptics.impact(ImpactStyle.Light);
        if (currentQuantity > 0) {
            onUpdateQuantity(product.id, isCutSelected, currentQuantity - 1);
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="bottom" className="p-0 rounded-t-3xl max-h-[90vh] overflow-y-auto">
                <SheetHeader className="sr-only">
                    <SheetTitle>Product Details</SheetTitle>
                </SheetHeader>

                {/* Enhanced Image Container */}
                <div className="relative w-full aspect-square bg-muted/20 flex items-center justify-center p-8">
                    <div className="relative w-full h-full">
                        {product.imageUrl ? (
                            <Image
                                src={product.imageUrl}
                                alt={product.name}
                                fill
                                className="object-contain mix-blend-multiply drop-shadow-xl"
                                sizes="(max-width: 768px) 100vw, 50vw"
                                priority
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                        )}
                    </div>

                    {/* Discount Badge - Enhanced */}
                    <div className="absolute top-6 left-6 bg-destructive text-destructive-foreground text-sm font-black px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                        <span className="text-lg">🔥</span>
                        <span>{discount}% OFF</span>
                    </div>

                    {/* Share Button - Enhanced */}
                    <div className="absolute top-6 right-6">
                        <Button size="icon" variant="secondary" className="rounded-full h-10 w-10 bg-background/95 backdrop-blur shadow-lg hover:bg-background border">
                            <Share2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Content Container with better spacing */}
                <div className="p-6 pb-28 space-y-6">
                    {/* Title & Unit - Enhanced */}
                    <div className="space-y-2">
                        <h2 className="text-2xl font-headline font-bold leading-tight">
                            {getProductName(product, language)}
                        </h2>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs font-medium">
                                {product.unit}
                            </Badge>
                            <Badge variant="outline" className="text-xs font-medium text-primary border-primary/20 bg-primary/5">
                                In Stock
                            </Badge>
                        </div>
                    </div>

                    {/* Price Section - Enhanced */}
                    <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
                        <div className="flex items-baseline gap-3">
                            <span className="text-3xl font-black text-primary">₹{product.pricePerUnit}</span>
                            <span className="text-lg text-muted-foreground line-through">₹{originalPrice}</span>
                            <span className="text-sm font-bold text-primary-foreground bg-primary px-2 py-1 rounded-full">
                                Save ₹{originalPrice - product.pricePerUnit}
                            </span>
                        </div>
                    </div>

                    {/* Cut Vegetable Toggle - Enhanced */}
                    {product.isCutVegetable && (
                        <div className="bg-orange-50/50 border-2 border-orange-100 p-4 rounded-2xl">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">✂️</span>
                                        <span className="text-base font-bold text-orange-900">Cut & Cleaned</span>
                                    </div>
                                    <span className="text-xs text-orange-700">Pre-washed & diced • +₹{product.cutCharge}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={cn("text-xs font-bold transition-colors", !isCutSelected ? "text-foreground" : "text-muted-foreground")}>NO</span>
                                    <button
                                        className={cn(
                                            "w-12 h-7 rounded-full p-1 transition-all duration-200 ease-in-out relative shadow-inner",
                                            isCutSelected ? "bg-orange-500" : "bg-muted"
                                        )}
                                        onClick={() => setIsCutSelected(!isCutSelected)}
                                    >
                                        <div className={cn(
                                            "bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200",
                                            isCutSelected ? "translate-x-5" : "translate-x-0"
                                        )} />
                                    </button>
                                    <span className={cn("text-xs font-bold transition-colors", isCutSelected ? "text-foreground" : "text-muted-foreground")}>YES</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Product Details - Enhanced */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <span>📋</span>
                                Product Details
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed bg-muted/30 p-4 rounded-xl border border-border/50">
                                {product.description || `Fresh and high-quality ${getProductName(product, language)} sourced directly from local farms. We ensure the best quality and freshness for your daily needs.`}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <span>🕐</span>
                                Shelf Life
                            </h3>
                            <p className="text-sm text-muted-foreground bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                                2-3 days under refrigeration
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sticky Bottom Action Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col">
                            <span className="text-xs text-primary font-bold tracking-wider">IN STOCK</span>
                            <span className="text-lg font-bold">Total: ₹{(product.pricePerUnit + (isCutSelected ? (product.cutCharge || 0) : 0)) * (currentQuantity || 1)}</span>
                        </div>

                        {currentQuantity === 0 ? (
                            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold w-1/2" onClick={handleAdd}>
                                ADD TO CART
                            </Button>
                        ) : (
                            <div className="flex items-center h-10 bg-primary/10 border border-primary/20 rounded-lg shadow-sm w-1/2 justify-between px-2">
                                <button onClick={handleRemove} className="w-8 h-full flex items-center justify-center text-primary active:opacity-70">
                                    <Minus className="w-4 h-4" strokeWidth={3} />
                                </button>
                                <span className="text-primary font-bold text-lg">{currentQuantity}</span>
                                <button onClick={handleAdd} className="w-8 h-full flex items-center justify-center text-primary active:opacity-70">
                                    <Plus className="w-4 h-4" strokeWidth={3} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

            </SheetContent>
        </Sheet>
    );
}
