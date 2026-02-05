import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Edit,
  Trash2,
  ShoppingCart,
  Eye,
  Star,
  Package,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { Product } from '@/lib/types';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';

interface ProductGridProps {
  products: Product[];
  userRole: 'admin' | 'customer';
  onEdit?: (product: Product) => void;
  onView?: (product: Product) => void;
}

export function ProductGrid({ products, userRole, onEdit, onView }: ProductGridProps) {
  const { addToCart, cart } = useCart();
  const { toast } = useToast();
  const { user } = useUser();
  const [isAddingToCart, setIsAddingToCart] = useState<string | null>(null);

  const getCartQuantity = (productId: string) => {
    return cart.find(item => item.id === productId)?.quantity || 0;
  };

  const handleAddToCart = async (product: Product) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please log in to add items to your cart."
      });
      return;
    }

    if ((product.stockQuantity || 0) === 0) {
      toast({
        variant: "destructive",
        title: "Out of Stock",
        description: "This product is currently out of stock."
      });
      return;
    }

    setIsAddingToCart(product.id);

    try {
      await addToCart(product);
      toast({
        title: "Added to Cart",
        description: `${product.name} has been added to your cart.`
      });
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add item to cart. Please try again."
      });
    } finally {
      setIsAddingToCart(null);
    }
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { status: 'out-of-stock', label: 'Out of Stock', color: 'destructive' };
    if (stock <= 10) return { status: 'low-stock', label: 'Low Stock', color: 'warning' };
    return { status: 'in-stock', label: 'In Stock', color: 'success' };
  };

  const getStockIcon = (stock: number) => {
    if (stock === 0) return <AlertTriangle className="w-4 h-4" />;
    if (stock <= 10) return <Package className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Products Found</h3>
        <p className="text-muted-foreground">Try adjusting your search or filter criteria.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
      {products.map((product) => {
        const stockStatus = getStockStatus(product.stockQuantity || 0);
        const cartQuantity = getCartQuantity(product.id);
        const isInCart = cartQuantity > 0;

        return (
          <Card key={product.id} className="group hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="p-3 sm:p-4 pb-2">
              <div className="flex justify-between items-start mb-2 gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base sm:text-lg line-clamp-2 leading-tight">{product.name}</CardTitle>
                  {product.subCategory && (
                    <Badge variant="outline" className="text-xs mt-1">
                      {product.subCategory}
                    </Badge>
                  )}
                </div>
                <Avatar className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
                  <AvatarImage
                    src={product.imageUrl}
                    alt={product.name}
                    className="object-cover"
                  />
                  <AvatarFallback className="text-xs">
                    {product.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </CardHeader>

            <CardContent className="p-3 sm:p-4 pt-0">
              {product.description && (
                <CardDescription className="line-clamp-2 sm:line-clamp-3 mb-2 sm:mb-3 text-sm sm:text-base">
                  {product.description}
                </CardDescription>
              )}

              <div className="space-y-1 sm:space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-lg sm:text-2xl font-bold text-primary">
                    ₹{product.pricePerUnit}
                  </span>
                  {product.unit && (
                    <span className="text-xs sm:text-sm text-muted-foreground">
                      / {product.unit}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <Badge variant={stockStatus.color as any} className="flex items-center gap-1 text-xs sm:text-sm">
                    {getStockIcon(product.stockQuantity || 0)}
                    <span className="hidden sm:inline">{stockStatus.label}</span>
                    <span className="sm:hidden">{product.stockQuantity || 0}</span>
                  </Badge>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {product.stockQuantity || 0} {product.unit || 'units'}
                  </span>
                </div>

                {product.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 sm:w-4 sm:h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs sm:text-sm font-medium">{product.rating}</span>
                    {product.reviewCount && (
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        ({product.reviewCount})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="p-3 sm:p-4 pt-0">
              <div className="flex gap-1 sm:gap-2 w-full">
                {userRole === 'admin' ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit?.(product)}
                      className="flex-1 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                    >
                      <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Edit</span>
                      <span className="sm:hidden">✏️</span>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onView?.(product)}
                      className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                    >
                      <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">View</span>
                      <span className="sm:hidden">👁️</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => handleAddToCart(product)}
                    disabled={isAddingToCart === product.id || (product.stockQuantity || 0) === 0}
                    className="flex-1 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                    variant={isInCart ? "secondary" : "default"}
                  >
                    {isAddingToCart === product.id ? (
                      <>
                        <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span className="hidden sm:inline">Adding...</span>
                        <span className="sm:hidden">⏳</span>
                      </>
                    ) : isInCart ? (
                      <>
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">In Cart ({cartQuantity})</span>
                        <span className="sm:hidden">✓ ({cartQuantity})</span>
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Add to Cart</span>
                        <span className="sm:hidden">🛒</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}