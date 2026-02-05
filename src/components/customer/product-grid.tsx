'use client';

import { useState, useEffect } from 'react';
import ProductCard from "@/components/product-card";
import { Product, CartItem, ProductVariant } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface ProductGridProps {
    products: Product[] | null;
    loading: boolean;
    cart: CartItem[];
    addToCart: (product: Product, quantity: number, isCut: boolean, variant?: ProductVariant | null) => void;
    updateCartQuantity: (productId: string, isCut: boolean, newQuantity: number, variantId?: string) => void;
}

export default function ProductGrid({
    products,
    loading,
    cart,
    addToCart,
    updateCartQuantity,
}: ProductGridProps) {
    if (loading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm h-full">
                        <div className="relative w-full aspect-[4/3] bg-gray-50 p-4">
                            <Skeleton className="w-full h-full rounded-xl" />
                        </div>
                        <div className="flex flex-col p-3 gap-2 flex-grow">
                            <Skeleton className="h-4 w-3/4 rounded-full" />
                            <Skeleton className="h-3 w-1/4 rounded-full" />
                            <div className="mt-auto flex items-end justify-between pt-2">
                                <div className="space-y-1">
                                    <Skeleton className="h-5 w-12 rounded-md" />
                                </div>
                                <Skeleton className="h-8 w-8 rounded-full" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    const [visibleCount, setVisibleCount] = useState(12);

    // Reset visible count when products array changes
    useEffect(() => {
        setVisibleCount(12);
    }, [products]);

    if (!products || products.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
                <div className="bg-gray-100 p-4 rounded-full mb-4">
                    <span className="text-4xl">🥬</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">No products found</h3>
                <p className="text-sm text-gray-500 max-w-[250px] mx-auto mt-1">
                    Try adjusting your search or filters to find what you're looking for.
                </p>
            </div>
        );
    }

    const visibleProducts = products.slice(0, visibleCount);
    const hasMore = visibleProducts.length < products.length;

    return (
        <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 pb-12 animate-in fade-in duration-500">
                {visibleProducts.map((product) => {
                    const productCartItems = cart.filter((item) => item.product.id === product.id);
                    // Legacy support check if needed, but variants handle it now
                    const legacyCartItem = productCartItems.find(i => !i.isCut && !i.selectedVariant);

                    return (
                        <ProductCard
                            key={product.id}
                            product={product}
                            onAddToCart={addToCart}
                            onUpdateQuantity={updateCartQuantity}
                            cartItems={productCartItems}
                            cartQuantity={legacyCartItem?.quantity || 0}
                            cutCartQuantity={0}
                        />
                    );
                })}
            </div>

            {hasMore && (
                <div className="flex justify-center pb-24">
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setVisibleCount(prev => prev + 12)}
                        className="min-w-[200px] rounded-full shadow-sm hover:shadow-md transition-all text-primary border-primary/20 hover:bg-primary/5"
                    >
                        Load More Products
                    </Button>
                </div>
            )}
        </>
    );
};
