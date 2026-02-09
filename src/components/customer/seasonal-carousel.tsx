'use client';

import { Product, CartItem, ProductVariant } from "@/lib/types";
import ProductCard from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";

interface SeasonalCarouselProps {
    products: Product[];
    loading: boolean;
    cart: CartItem[];
    addToCart: (product: Product, quantity: number, isCut: boolean, variant?: ProductVariant | null) => void;
    updateCartQuantity: (productId: string, isCut: boolean, newQuantity: number, variantId?: string) => void;
    onProductClick?: (product: Product) => void;
}

export default function SeasonalCarousel({
    products,
    loading,
    cart,
    addToCart,
    updateCartQuantity,
    onProductClick
}: SeasonalCarouselProps) {

    if (loading) {
        return (
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="min-w-[80vw] sm:min-w-[200px] aspect-video sm:h-[180px] rounded-2xl flex-shrink-0 snap-center" />
                ))}
            </div>
        );
    }

    if (!products || products.length === 0) return null;

    return (
        <section>
            <div className="flex items-center justify-between mb-4 px-1">
                <h2 className="text-xl font-headline font-bold text-gray-900 flex items-center gap-2">
                    <span>✨</span> Seasonal Picks
                </h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0">
                {products.map((product) => {
                    const productCartItems = cart.filter((item) => item.product.id === product.id);
                    // Legacy check if needed
                    // const legacyCartItem = productCartItems.find(i => !i.isCut && !i.selectedVariant);

                    return (
                        <div key={product.id} className="min-w-[85vw] sm:min-w-[280px] md:min-w-[300px] snap-center flex-shrink-0">
                            <ProductCard
                                product={product}
                                onAddToCart={addToCart}
                                onUpdateQuantity={updateCartQuantity}
                                cartItems={productCartItems}
                                // Pass 0 for legacy quantities if using variants mainly, 
                                // or calculate if legacy fallback needed. 
                                // ProductCard handles variant logic internally mostly now.
                                cartQuantity={0}
                                onClick={onProductClick ? () => onProductClick(product) : undefined}
                            />
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
