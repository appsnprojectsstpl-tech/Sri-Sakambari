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
                <div className="relative w-full aspect-square bg-gradient-to-br from-gray-50 to-gray-100 dark:from-white dark:to-gray-50 flex items-center justify-center p-8">
                    <div className="relative w-full h-full">
                        <Image
                            src={product.imageUrl || `https://picsum.photos/seed/${product.id}/600/400`}
                            alt={product.name}
                            fill
                            className="object-contain mix-blend-multiply drop-shadow-2xl"
                            sizes="100vw"
                            priority
                        />
                    </div>

                    {/* Discount Badge - Enhanced */}
                    <div className="absolute top-6 left-6 bg-gradient-to-r from-red-600 to-pink-600 text-white text-sm font-black px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                        <span className="text-lg">🔥</span>
                        <span>{discount}% OFF</span>
                    </div>

                    {/* Share Button - Enhanced */}
                    <div className="absolute top-6 right-6">
                        <Button size="icon" variant="secondary" className="rounded-full h-10 w-10 bg-white/95 backdrop-blur shadow-lg hover:bg-white border border-gray-200">
                            <Share2 className="w-4 h-4 text-gray-700" />
                        </Button>
                    </div>
                </div>

                {/* Content Container with better spacing */}
                <div className="p-6 pb-28 space-y-6">
                    {/* Title & Unit - Enhanced */}
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                            {getProductName(product, language)}
                        </h2>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs font-medium">
                                {product.unit}
                            </Badge>
                            <Badge variant="outline" className="text-xs font-medium text-green-700 border-green-200 bg-green-50">
                                In Stock
                            </Badge>
                        </div>
                    </div>

                    {/* Price Section - Enhanced */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-2xl p-4">
                        <div className="flex items-baseline gap-3">
                            <span className="text-3xl font-black text-gray-900">₹{product.pricePerUnit}</span>
                            <span className="text-lg text-gray-400 line-through">₹{originalPrice}</span>
                            <span className="text-sm font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full">
                                Save ₹{originalPrice - product.pricePerUnit}
                            </span>
                        </div>
                    </div>

                    {/* Cut Vegetable Toggle - Enhanced */}
                    {product.isCutVegetable && (
                        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 p-4 rounded-2xl">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">✂️</span>
                                        <span className="text-base font-bold text-orange-900">Cut & Cleaned</span>
                                    </div>
                                    <span className="text-xs text-orange-700">Pre-washed & diced • +₹{product.cutCharge}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={cn("text-xs font-bold transition-colors", !isCutSelected ? "text-gray-900" : "text-gray-400")}>NO</span>
                                    <button
                                        className={cn(
                                            "w-12 h-7 rounded-full p-1 transition-all duration-200 ease-in-out relative shadow-inner",
                                            isCutSelected ? "bg-orange-500" : "bg-gray-300"
                                        )}
                                        onClick={() => setIsCutSelected(!isCutSelected)}
                                    >
                                        <div className={cn(
                                            "bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200",
                                            isCutSelected ? "translate-x-5" : "translate-x-0"
                                        )} />
                                    </button>
                                    <span className={cn("text-xs font-bold transition-colors", isCutSelected ? "text-gray-900" : "text-gray-400")}>YES</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Product Details - Enhanced */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                <span>📋</span>
                                Product Details
                            </h3>
                            <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">
                                {product.description || `Fresh and high-quality ${getProductName(product, language)} sourced directly from local farms. We ensure the best quality and freshness for your daily needs.`}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                <span>🕐</span>
                                Shelf Life
                            </h3>
                            <p className="text-sm text-gray-600 bg-blue-50 p-4 rounded-xl border border-blue-100">
                                2-3 days under refrigeration
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sticky Bottom Action Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col">
                            <span className="text-xs text-green-600 font-bold tracking-wider">IN STOCK</span>
                            <span className="text-lg font-bold">Total: ₹{(product.pricePerUnit + (isCutSelected ? (product.cutCharge || 0) : 0)) * (currentQuantity || 1)}</span>
                        </div>

                        {currentQuantity === 0 ? (
                            <Button size="lg" className="bg-[#E0215F] hover:bg-[#C81D55] text-white font-bold w-1/2" onClick={handleAdd}>
                                ADD TO CART
                            </Button>
                        ) : (
                            <div className="flex items-center h-12 bg-[#FF3269] rounded-lg shadow-sm w-1/2 justify-between px-2">
                                <button onClick={handleRemove} className="w-10 h-full flex items-center justify-center text-white active:opacity-70">
                                    <Minus className="w-5 h-5" strokeWidth={3} />
                                </button>
                                <span className="text-white font-bold text-lg">{currentQuantity}</span>
                                <button onClick={handleAdd} className="w-10 h-full flex items-center justify-center text-white active:opacity-70">
                                    <Plus className="w-5 h-5" strokeWidth={3} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

            </SheetContent>
        </Sheet>
    );
}
