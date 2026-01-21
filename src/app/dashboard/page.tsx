
'use client';
import type { FC } from 'react';
import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import type { Product, Role, CartItem, User, Notification } from '@/lib/types';
import Header from '@/components/header';
import CustomerView from '@/components/views/customer-view';
// Lazy load admin and delivery views to reduce initial bundle size
const AdminView = lazy(() => import('@/components/views/admin-view'));
const DeliveryView = lazy(() => import('@/components/views/delivery-view'));
import LoginView from '@/components/views/login-view';
import { useUser, useAuth, useCollection } from '@/firebase';
import { signOut } from 'firebase/auth';
// import CartSheet from '@/components/cart-sheet'; // Removed
import { useRouter } from 'next/navigation';
import { logger, safeLocalStorage } from '@/lib/logger';
import { settings } from '@/lib/settings';
import { ErrorBoundary } from '@/components/error-boundary';

const Views: Record<Role, FC<any>> = {
  customer: CustomerView,
  admin: AdminView,
  delivery: DeliveryView,
  guest: CustomerView, // Guest sees the customer view
};

export default function DashboardPage() {
  const { user, loading: userLoading, error: userError } = useUser();
  const { data: notifications, loading: notificationsLoading, error: notificationsError } = useCollection<Notification>('notifications', {
    constraints: [['where', 'userId', '==', user?.id || '']]
  });
  const auth = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  // const [isCartOpen, setCartOpen] = useState(false); // Removed


  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Restore cart from localStorage on initial load
    try {
      const savedCart = safeLocalStorage.getItem('cart');
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    } catch (e) {
      logger.error("Failed to parse cart from localStorage", e);
      setCart([]);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Effect to persist cart to localStorage whenever it changes
  useEffect(() => {
    if (!isInitialized) return; // Don't write before loading

    if (cart.length > 0) {
      localStorage.setItem('cart', JSON.stringify(cart));
    } else {
      localStorage.removeItem('cart');
    }
  }, [cart, isInitialized]);


  // Effect to handle pre-selected products from the landing page
  useEffect(() => {
    const preselectedProductsStr = localStorage.getItem('preselectedProducts');
    if (preselectedProductsStr) {
      // This is a complex way to handle this.
      // A better way would be to just add the product objects directly.
      // However, we only have names. We can't query for them here.
      // The solution is to let the product components handle this.
      // This logic will be removed and handled inside the CustomerView or ProductCard components
      // but for now, we leave it, acknowledging it may not work if products aren't loaded.
      localStorage.removeItem('preselectedProducts'); // Consume it
    }
  }, []);


  const role: Role = useMemo(() => {
    if (userLoading) return 'guest'; // Show guest view while loading
    if (userError || !user) return 'guest';
    return user.role || 'customer';
  }, [user, userLoading, userError]);

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/home'); // Redirect to new landing page on logout
    }
  };

  const addToCart = (product: Product, quantity: number = 1, isCut: boolean = false) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find(
        (item) => item.product.id === product.id && item.isCut === isCut
      );
      if (existingItem) {
        return prevCart.map((item) =>
          item.product.id === product.id && item.isCut === isCut
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prevCart, { product, quantity, isCut }];
    });
  };

  const updateCartQuantity = (productId: string, isCut: boolean, quantity: number) => {
    setCart((prevCart) => {
      if (quantity <= 0) {
        return prevCart.filter(
          (item) => !(item.product.id === productId && item.isCut === isCut)
        );
      }
      return prevCart.map((item) =>
        item.product.id === productId && item.isCut === isCut
          ? { ...item, quantity }
          : item
      );
    });
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => {
      const itemTotal = item.product.pricePerUnit * item.quantity;
      const cutChargeTotal = item.isCut ? ((item.product.cutCharge || settings.defaultCutCharge) * item.quantity) : 0;
      return total + itemTotal + cutChargeTotal;
    }, 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  // Show a global loading indicator until user auth is resolved
  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  // The main view for both logged-in users and guests.
  const CurrentView = Views[role];

  const viewProps = {
    customer: { addToCart, updateCartQuantity, cart },
    guest: { addToCart, updateCartQuantity, cart },
    admin: { user },
    delivery: { user },
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header user={user ?? null} onLogout={handleLogout} cartCount={cartItemCount} notifications={notifications || []} onCartClick={() => router.push('/cart')} />
      <main className="flex-1">
        <ErrorBoundary>
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-sm text-muted-foreground">Loading view...</p>
              </div>
            </div>
          }>
            <CurrentView {...viewProps[role]} />
          </Suspense>
        </ErrorBoundary>
      </main>
      {/* CartSheet Removed - Using Dedicated /cart Page */}
    </div>
  );
}
