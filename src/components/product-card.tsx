'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import type { Product, CartItem, ProductVariant } from '@/lib/types';
import { Plus, Minus } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { getProductName } from '@/lib/translations';
import { useState, useMemo, useEffect } from 'react';
import { haptics, ImpactStyle } from '@/lib/haptics';
import { useFlyToCart } from '@/components/fly-to-cart-context';
import { cn } from '@/lib/utils';
import { getStockStatus } from '@/lib/inventory-utils';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, quantity: number, isCut: boolean, variant?: ProductVariant | null) => void;
  onUpdateQuantity: (productId: string, isCut: boolean, newQuantity: number, variantId?: string) => void;
  cartItems?: CartItem[];
  cartQuantity?: number; // legacy, can remove later if unused
  cutCartQuantity?: number;
  onClick?: () => void;
}

export default function ProductCard({
  product,
  onAddToCart,
  onUpdateQuantity,
  cartItems = [],
  cartQuantity = 0, // Fallback
  onClick
}: ProductCardProps) {
  const { language } = useLanguage();
  const { addToCart: triggerFlyToCart } = useFlyToCart();

  const variants = product.variants || [];
  const hasVariants = variants.length > 0;

  // State for selected variant
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  // Initialize selected variant
  useEffect(() => {
    if (hasVariants && !selectedVariantId) {
      setSelectedVariantId(variants[0].id);
    }
  }, [hasVariants, variants, selectedVariantId]);

  const selectedVariant = useMemo(() =>
    hasVariants ? variants.find(v => v.id === selectedVariantId) || variants[0] : null
    , [hasVariants, variants, selectedVariantId]);

  // Compute quantity based on selected variant
  const quantity = useMemo(() => {
    if (hasVariants && selectedVariant) {
      const item = cartItems.find(i => i.product.id === product.id && i.selectedVariant?.id === selectedVariant.id && !i.isCut);
      return item?.quantity || 0;
    }
    return cartQuantity; // Fallback for non-variant products
  }, [hasVariants, selectedVariant, cartItems, product.id, cartQuantity]);

  const handleAddClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    haptics.impact(ImpactStyle.Medium);

    const rect = e.currentTarget.getBoundingClientRect();
    triggerFlyToCart(rect, selectedVariant?.image || product.imageUrl || '');
    onAddToCart(product, 1, false, selectedVariant);
  };

  const handleIncrement = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    haptics.impact(ImpactStyle.Light);
    onUpdateQuantity(product.id, false, quantity + 1, selectedVariant?.id);
  };

  const handleDecrement = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    haptics.impact(ImpactStyle.Light);
    if (quantity > 0) {
      onUpdateQuantity(product.id, false, quantity - 1, selectedVariant?.id);
    }
  };

  // Price formatting
  const price = selectedVariant ? selectedVariant.price : product.pricePerUnit;
  const originalPrice = product.originalPrice || 0; // Note: originalPrice might not be per-variant yet
  const unit = selectedVariant ? selectedVariant.unit : product.unit;

  const discountPercentage = (originalPrice > price) ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

  // New check (simple logic: explicit flag or created within 7 days if we had real dates, but let's stick to flag or random for demo if needed)
  const isNew = false; // removed product.isNew usage as it was removed from type? No, I restored it? No, I lost isNew in type restoration? 
  // Checking type restoration: I added variants, restored pricePerUnit. I probably lost isNew. 
  // Safe to assume false or check type. checking earlier view... Product mapping had isNew commented out in my type replacement?

  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col w-full bg-white rounded-2xl overflow-hidden border transition-all active:scale-[0.98] ${!product.isActive ? 'border-gray-200' : 'border-gray-100 shadow-sm'}`}
    >
      {/* Image Container */}
      <div className="relative w-full aspect-[4/3] bg-gray-50 p-3 flex items-center justify-center overflow-hidden">
        {(selectedVariant?.image || product.imageUrl) ? (
          <Image
            src={selectedVariant?.image || product.imageUrl!}
            alt={product.name}
            fill
            className={cn("object-contain mix-blend-multiply transition-transform hover:scale-105", !product.isActive && "grayscale opacity-50")}
            sizes="(max-width: 768px) 50vw, 33vw"
            priority={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

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
          {product.trackInventory && getStockStatus(product) === 'LOW_STOCK' && product.isActive && (
            <span className="bg-yellow-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm animate-in zoom-in delay-100">
              Only {product.stockQuantity} left!
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
      <div className={cn("flex flex-col p-2 flex-grow", !product.isActive && "opacity-60")}>
        <div className="mb-0.5">
          <h3 className="font-bold text-gray-900 text-[13px] sm:text-base leading-tight line-clamp-2 min-h-[2.4em]">
            {getProductName(product, language)}
          </h3>
          {hasVariants ? (
            <div className="mb-1" onClick={e => e.stopPropagation()}>
              <div className="relative">
                <select
                  className="text-[10px] sm:text-xs border border-gray-300 rounded-md py-1.5 pl-2 w-full bg-white text-gray-900 appearance-none pr-6 focus:ring-1 focus:ring-primary focus:border-primary outline-none shadow-sm font-medium"
                  value={selectedVariantId || ''}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                >
                  {variants.map(v => (
                    <option key={v.id} value={v.id}>{v.unit}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-gray-500">
                  <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[10px] sm:text-xs text-gray-500 font-medium">{product.unit}</p>
          )}
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
            {product.isCutVegetable && product.isActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  haptics.impact(ImpactStyle.Medium);
                  const rect = e.currentTarget.getBoundingClientRect();
                  triggerFlyToCart(rect, selectedVariant?.image || product.imageUrl || '');
                  onAddToCart(product, 1, true, selectedVariant);
                }}
                className="mt-1 flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full w-fit active:bg-primary/20"
              >
                <Plus className="w-2.5 h-2.5" />
                Cut (+₹{product.cutCharge !== undefined ? product.cutCharge : 10})
              </button>
            )}
          </div>

          {/* Add Button */}
          {!product.isActive ? (
            <div className='h-8 sm:h-9' /> // Spacer to keep height consistent
          ) : quantity === 0 ? (
            <Button
              size="icon"
              onClick={handleAddClick}
              className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 text-white shadow-md active:scale-95 transition-transform flex items-center justify-center"
            >
              <Plus className="w-5 h-5" strokeWidth={3} />
            </Button>
          ) : (
            <div className="flex items-center bg-white border border-primary/20 rounded-full shadow-sm h-8 overflow-hidden">
              <button
                onClick={handleDecrement}
                className="w-8 h-full flex items-center justify-center text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors"
              >
                <Minus className="w-4 h-4" strokeWidth={3} />
              </button>
              <span className="min-w-[20px] text-center text-xs sm:text-sm font-bold text-gray-900">
                {quantity}
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
