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

interface MobileProductCardProps {
  product: Product;
  onAddToCart: (product: Product, quantity: number, isCut: boolean, variant?: ProductVariant | null) => void;
  onUpdateQuantity: (productId: string, isCut: boolean, newQuantity: number, variantId?: string) => void;
  cartItems?: CartItem[];
  cartQuantity?: number;
  onClick?: () => void;
}

export default function MobileProductCard({
  product,
  onAddToCart,
  onUpdateQuantity,
  cartItems = [],
  cartQuantity = 0,
  onClick
}: MobileProductCardProps) {
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
    return cartQuantity;
  }, [hasVariants, selectedVariant, cartItems, product.id, cartQuantity]);

  const handleAddClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    haptics.impact(ImpactStyle.Medium);

    const rect = e.currentTarget.getBoundingClientRect();
    triggerFlyToCart(rect, product.imageUrl || '');
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
  const originalPrice = product.originalPrice || 0;
  const unit = selectedVariant ? selectedVariant.unit : product.unit;

  const discountPercentage = (originalPrice > price) ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative flex flex-col w-full bg-white rounded-xl overflow-hidden border transition-all active:scale-[0.98] mobile-touch-button select-none",
        !product.isActive ? 'border-gray-200' : 'border-gray-100 shadow-sm'
      )}
      role="article"
      aria-label={`${product.name} - ₹${price}`}
    >
      {/* Image Container - Optimized for Mobile */}
      <div className="relative w-full aspect-square bg-gray-50 p-2 flex items-center justify-center overflow-hidden">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className={cn("object-contain mix-blend-multiply transition-transform hover:scale-105", !product.isActive && "grayscale opacity-50")}
            sizes="(max-width: 768px) 50vw, 25vw"
            priority={false}
            quality={85}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Badges - Mobile Optimized */}
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-10">
          {discountPercentage > 0 && product.isActive && (
            <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm animate-in zoom-in">
              {discountPercentage}%
            </span>
          )}
          {product.trackInventory && getStockStatus(product) === 'LOW_STOCK' && product.isActive && (
            <span className="bg-yellow-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm animate-in zoom-in delay-75">
              Only {product.stockQuantity} left!
            </span>
          )}
        </div>

        {/* OOS Overlay - Mobile Optimized */}
        {!product.isActive && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-20">
            <span className="bg-gray-900 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg transform -rotate-12 border border-white">
              OUT OF STOCK
            </span>
          </div>
        )}

      </div>

      {/* Content - Mobile Optimized */}
      <div className={cn("flex flex-col p-2 gap-1 flex-grow", !product.isActive && "opacity-60")}>
        <div className="mb-0.5">
          <h3 className="font-bold text-gray-900 text-[12px] leading-tight line-clamp-2 min-h-[2.4em]">
            {getProductName(product, language)}
          </h3>
          {hasVariants ? (
            <div className="mb-0.5" onClick={e => e.stopPropagation()}>
              <div className="relative">
                <select
                  className="text-[9px] border border-gray-200 rounded p-1 w-full bg-gray-50 text-gray-900 appearance-none pr-5 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  value={selectedVariantId || ''}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                >
                  {variants.map(v => (
                    <option key={v.id} value={v.id}>{v.unit}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-gray-500">
                  <svg className="fill-current h-2.5 w-2.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[9px] text-gray-500 font-medium">{product.unit}</p>
          )}
        </div>

        {/* Action Row - Mobile Optimized */}
        <div className="mt-auto flex items-end justify-between pt-0.5">

          {/* Price - Mobile Optimized */}
          <div className="flex flex-col">
            <div className='flex items-baseline gap-1'>
              <span className="text-sm font-extrabold text-primary">
                ₹{price}
              </span>
              {originalPrice > price && (
                <span className="text-[9px] text-muted-foreground line-through decoration-red-500/50">
                  ₹{originalPrice}
                </span>
              )}
            </div>

            {/* Cut Option - Micro Button for Mobile */}
            {product.category === 'Vegetables' && product.isActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  haptics.impact(ImpactStyle.Medium);
                  const rect = e.currentTarget.getBoundingClientRect();
                  triggerFlyToCart(rect, product.imageUrl || '');
                  onAddToCart(product, 1, true, selectedVariant);
                }}
                className="mt-0.5 flex items-center gap-0.5 text-[9px] font-bold text-primary bg-primary/10 px-1 py-0.5 rounded-full w-fit active:bg-primary/20 mobile-touch-button"
              >
                <Plus className="w-2 h-2" />
                Cut (+₹10)
              </button>
            )}
          </div>

          {/* Add Button - Mobile Touch Optimized */}
          {!product.isActive ? (
            <div className='h-7' /> // Spacer to keep height consistent
          ) : quantity === 0 ? (
            <Button
              size="icon"
              onClick={handleAddClick}
              className="h-7 w-7 rounded-full bg-primary hover:bg-primary/90 text-white shadow-md active:scale-95 transition-transform mobile-touch-button"
              aria-label={`Add ${product.name} to cart`}
            >
              <Plus className="w-4 h-4" strokeWidth={3} />
            </Button>
          ) : (
            <div className="flex items-center bg-white border border-primary/20 rounded-full shadow-sm h-7 overflow-hidden">
              <button
                onClick={handleDecrement}
                className="w-7 h-full flex items-center justify-center text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors mobile-touch-button"
                aria-label={`Remove one ${product.name} from cart`}
              >
                <Minus className="w-3 h-3" strokeWidth={3} />
              </button>
              <span className="min-w-[16px] text-center text-xs font-bold text-gray-900">
                {quantity}
              </span>
              <button
                onClick={handleIncrement}
                className="w-7 h-full flex items-center justify-center text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors mobile-touch-button"
                aria-label={`Add one ${product.name} to cart`}
              >
                <Plus className="w-3 h-3" strokeWidth={3} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}