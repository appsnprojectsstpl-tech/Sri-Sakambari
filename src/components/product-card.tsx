'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import type { Product } from '@/lib/types';
import { Plus, Minus } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { getProductName } from '@/lib/translations';
import { useState } from 'react';
import { haptics, ImpactStyle } from '@/lib/haptics';
import { useFlyToCart } from '@/components/fly-to-cart-context';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, quantity: number, isCut: boolean) => void;
  onUpdateQuantity: (productId: string, isCut: boolean, newQuantity: number) => void;
  cartQuantity: number;
  cutCartQuantity: number;
  onClick?: () => void;
}

export default function ProductCard({
  product,
  onAddToCart,
  onUpdateQuantity,
  cartQuantity,
  cutCartQuantity,
  onClick
}: ProductCardProps) {
  const { language } = useLanguage();
  const { addToCart: triggerFlyToCart } = useFlyToCart();
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);

  // Combine quantities for the main +/- count (simplification for clean UI)
  // Logic: If we have cut items, the card might need to indicate that more complexly,
  // but for the main grid, we just show total items or default control.
  // For now, let's treat the +/- as adding/removing "Regular" items unless context changes.
  // "Cut" is a separate special action.
  const totalDisplayQuantity = cartQuantity; // Only showing regular quantity on main counter to avoid confusion? 
  // User asked for "Cut" visibility. 
  // Let's keep the logic: Green + adds Regular. "Cut" button adds Cut.

  const handleAddClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    haptics.impact(ImpactStyle.Medium);

    const rect = e.currentTarget.getBoundingClientRect();
    triggerFlyToCart(rect, product.imageUrl || '');
    onAddToCart(product, 1, false);
  };

  const handleIncrement = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    haptics.impact(ImpactStyle.Light);
    onUpdateQuantity(product.id, false, cartQuantity + 1);
  };

  const handleDecrement = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    haptics.impact(ImpactStyle.Light);
    if (cartQuantity > 0) {
      onUpdateQuantity(product.id, false, cartQuantity - 1);
    }
  };

  // Price formatting
  const price = product.pricePerUnit;
  const originalPrice = product.originalPrice || 0;
  const discountPercentage = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

  // New check (simple logic: explicit flag or created within 7 days if we had real dates, but let's stick to flag or random for demo if needed)
  const isNew = product.isNew;

  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col w-full bg-white rounded-2xl overflow-hidden border transition-all active:scale-[0.98] ${!product.isActive ? 'border-gray-200' : 'border-gray-100 shadow-sm'}`}
    >
      {/* Image Container */}
      <div className="relative w-full aspect-[4/3] bg-gray-50 p-3 flex items-center justify-center overflow-hidden">
        <Image
          src={product.imageUrl || `https://picsum.photos/seed/${product.id}/400/300`}
          alt={product.name}
          fill
          className={cn("object-contain mix-blend-multiply transition-transform hover:scale-105", !product.isActive && "grayscale opacity-50")}
          sizes="(max-width: 768px) 50vw, 33vw"
          priority={false}
        />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {discountPercentage > 0 && product.isActive && (
            <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm animate-in zoom-in">
              {discountPercentage}% OFF
            </span>
          )}
          {isNew && product.isActive && (
            <span className="bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm animate-in zoom-in delay-75">
              NEW
            </span>
          )}
        </div>

        {/* OOS Overlay */}
        {!product.isActive && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-20">
            <span className="bg-gray-900 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg transform -rotate-12 border-2 border-white">
              OUT OF STOCK
            </span>
          </div>
        )}

      </div>

      {/* Content */}
      <div className={cn("flex flex-col p-2.5 flex-grow", !product.isActive && "opacity-60")}>
        <div className="mb-0.5">
          <h3 className="font-bold text-gray-900 text-[13px] sm:text-base leading-tight line-clamp-2 min-h-[2.4em]">
            {getProductName(product, language)}
          </h3>
          <p className="text-[10px] sm:text-xs text-gray-500 font-medium">{product.unit}</p>
        </div>

        {/* Action Row */}
        <div className="mt-auto flex items-end justify-between pt-1">

          {/* Price */}
          <div className="flex flex-col">
            <div className='flex items-baseline gap-1.5'>
              <span className="text-base sm:text-lg font-extrabold text-primary">
                ₹{price}
              </span>
              {originalPrice > price && (
                <span className="text-xs text-muted-foreground line-through decoration-red-500/50">
                  ₹{originalPrice}
                </span>
              )}
            </div>

            {/* Cut Option - Micro Button */}
            {product.category === 'Vegetables' && product.isActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  haptics.impact(ImpactStyle.Medium);
                  const rect = e.currentTarget.getBoundingClientRect();
                  triggerFlyToCart(rect, product.imageUrl || '');
                  onAddToCart(product, 1, true);
                }}
                className="mt-1 flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full w-fit active:bg-primary/20"
              >
                <Plus className="w-2.5 h-2.5" />
                Cut (+₹10)
              </button>
            )}
          </div>

          {/* Add Button */}
          {!product.isActive ? (
            <div className='h-8 sm:h-9' /> // Spacer to keep height consistent
          ) : cartQuantity === 0 ? (
            <Button
              size="icon"
              onClick={handleAddClick}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary hover:bg-primary/90 text-white shadow-md active:scale-95 transition-transform flex items-center justify-center"
            >
              <Plus className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} />
            </Button>
          ) : (
            <div className="flex items-center bg-white border border-primary/20 rounded-full shadow-sm h-8 sm:h-9 overflow-hidden">
              <button
                onClick={handleDecrement}
                className="w-8 h-full flex items-center justify-center text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors"
              >
                <Minus className="w-4 h-4" strokeWidth={3} />
              </button>
              <span className="min-w-[20px] text-center text-xs sm:text-sm font-bold text-gray-900">
                {cartQuantity}
              </span>
              <button
                onClick={handleIncrement}
                className="w-8 h-full flex items-center justify-center text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors"
              >
                <Plus className="w-4 h-4" strokeWidth={3} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
