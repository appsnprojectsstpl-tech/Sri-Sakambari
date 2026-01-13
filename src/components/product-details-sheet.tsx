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
            <SheetContent side="bottom" className="p-0 rounded-t-[20px] max-h-[90vh] overflow-y-auto">
                <SheetHeader className="sr-only">
                    <SheetTitle>Product Details</SheetTitle>
                </SheetHeader>
                <div className="relative w-full aspect-[4/3] bg-gray-50 dark:bg-white flex items-center justify-center p-6">
                    <Image
                        src={product.imageUrl || `https://picsum.photos/seed/${product.id}/600/400`}
                        alt={product.name}
                        fill
                        className="object-contain mix-blend-multiply"
                    />

                    {/* Discount Badge */}
                    <div className="absolute top-4 left-4 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-md shadow-md">
                        {discount}% OFF
                    </div>

                    <div className="absolute top-4 right-4 flex gap-2">
                        <Button size="icon" variant="secondary" className="rounded-full h-8 w-8 bg-white/90 shadow-sm">
                            <Share2 className="w-4 h-4 text-gray-700" />
                        </Button>
                    </div>
                </div>

                <div className="p-5 pb-24">
                    {/* Title & Price */}
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 leading-tight mb-1">
                                {getProductName(product, language)}
                            </h2>
                            <p className="text-sm text-gray-500 font-medium">{product.unit}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mb-6">
                        <span className="text-2xl font-black text-gray-900">₹{product.pricePerUnit}</span>
                        <span className="text-sm text-gray-400 line-through">₹{originalPrice}</span>
                    </div>

                    {/* Cut Vegetable Toggle */}
                    {product.isCutVegetable && (
                        <div className="bg-orange-50 border border-orange-100 p-3 rounded-lg mb-6 flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-orange-900">Need Cut Vegetables?</span>
                                <span className="text-xs text-orange-700">Pre-washed & diced (+₹{product.cutCharge})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={cn("text-xs font-bold transition-colors", !isCutSelected ? "text-gray-900" : "text-gray-400")}>NO</span>
                                <button
                                    className={cn(
                                        "w-10 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out relative",
                                        isCutSelected ? "bg-orange-500" : "bg-gray-300"
                                    )}
                                    onClick={() => setIsCutSelected(!isCutSelected)}
                                >
                                    <div className={cn(
                                        "bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200",
                                        isCutSelected ? "translate-x-4" : "translate-x-0"
                                    )} />
                                </button>
                                <span className={cn("text-xs font-bold transition-colors", isCutSelected ? "text-gray-900" : "text-gray-400")}>YES</span>
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-gray-900">Product Details</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            {product.description || `Fresh and high-quality ${getProductName(product, language)} sourced directly from local farms. We ensure the best quality and freshness for your daily needs.`}
                        </p>

                        <h3 className="font-bold text-gray-900 pt-2">Shelf Life</h3>
                        <p className="text-sm text-gray-600">
                            2-3 days under refrigeration.
                        </p>
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
