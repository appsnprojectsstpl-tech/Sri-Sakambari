
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
  // Mock standard price if needed, or just hide discount as requested.
  // User requested "Remove 15% Off labels". So we show just the current price.

  return (
    <div
      onClick={onClick}
      className="relative flex flex-col w-full bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm transition-all active:scale-[0.98]"
    >
      {/* Image Container */}
      <div className="relative w-full aspect-[4/3] bg-gray-50 p-3 flex items-center justify-center">
        <Image
          src={product.imageUrl || `https://picsum.photos/seed/${product.id}/400/300`}
          alt={product.name}
          fill
          className="object-contain mix-blend-multiply transition-transform hover:scale-105"
          sizes="(max-width: 768px) 50vw, 33vw"
          priority={false}
        />

      </div>

      {/* Content */}
      <div className="flex flex-col p-2.5 flex-grow">
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
            <span className="text-base sm:text-lg font-extrabold text-primary">
              ₹{price}
            </span>
            {/* Cut Option - Micro Button */}
            {product.category === 'Vegetables' && (
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
          {cartQuantity === 0 ? (
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
