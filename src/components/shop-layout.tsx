'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useUser } from '@/firebase';
import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { signOut } from 'firebase/auth';
import type { Product, CartItem } from '@/lib/types';
import { FlyToCartProvider } from './fly-to-cart-context';
import { BottomNav } from './bottom-nav';
import { Toaster } from './ui/toaster';
import { logger, safeLocalStorage } from '@/lib/logger';
import Header from '@/components/header';
import CartSheet from '@/components/cart-sheet';
import ProductCard from '@/components/product-card';
import ProductCardSkeleton from '@/components/product-card-skeleton';
import SearchBar from '@/components/search-bar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/language-context';
import { t } from '@/lib/translations';
import ProductDetailsSheet from '@/components/product-details-sheet';
import { ArrowUp } from 'lucide-react';
import { useUserNotifications } from '@/hooks/use-user-notifications';

export interface CategoryData {
    id: string;
    name: string;
    products: Product[];
}

interface ShopLayoutProps {
    title: string;
    description?: string;
    categories: CategoryData[];
    loading: boolean;
}

export default function ShopLayout({ title, categories, loading }: ShopLayoutProps) {
    const { user } = useUser();
    const auth = useAuth();
    const router = useRouter();
    const { language } = useLanguage();

    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setCartOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>(categories[0]?.id || 'all');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const mainContentRef = useRef<HTMLDivElement>(null);

    // Handle initial category selection
    useEffect(() => {
        if (categories.length > 0 && !activeCategory) {
            setActiveCategory(categories[0].id);
        }
    }, [categories]);

    // Cart Persistence
    useEffect(() => {
        const savedCart = safeLocalStorage.getItem('cart');
        if (savedCart) {
            try {
                setCart(JSON.parse(savedCart));
            } catch (e) {
                logger.error('Failed to parse cart', e);
                setCart([]);
            }
        }
    }, []);

    useEffect(() => {
        if (cart.length > 0) {
            localStorage.setItem('cart', JSON.stringify(cart));
        } else {
            localStorage.removeItem('cart');
        }
    }, [cart]);

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

    const clearCart = () => setCart([]);

    const handleLogout = async () => {
        if (auth) {
            await signOut(auth);
            router.push('/home');
        }
    };

    const cartTotal = useMemo(() => {
        return cart.reduce((total, item) => {
            const price = Number(item.product.pricePerUnit) || 0;
            const quantity = Number(item.quantity) || 0;
            const cutCharge = item.isCut ? (Number(item.product.cutCharge) || 10) : 0;

            const itemTotal = price * quantity;
            const cutChargeTotal = cutCharge * quantity;

            return total + itemTotal + cutChargeTotal;
        }, 0);
    }, [cart]);

    const cartItemCount = useMemo(() => cart.reduce((total, item) => total + (Number(item.quantity) || 0), 0), [cart]);

    // Filtering Logic
    const visibleCategories = useMemo(() => {
        if (!searchQuery) return categories;
        const lowerQ = searchQuery.toLowerCase();

        // Filter products inside categories and return valid categories only
        return categories.map(cat => ({
            ...cat,
            products: cat.products.filter(p =>
                (p.name?.toLowerCase().includes(lowerQ)) ||
                (p.name_te?.toLowerCase().includes(lowerQ))
            )
        })).filter(cat => cat.products.length > 0);

    }, [categories, searchQuery]);

    // Scroll tracking for scroll-to-top button
    useEffect(() => {
        const mainContent = mainContentRef.current;
        if (!mainContent) return;

        const handleScroll = () => {
            setShowScrollTop(mainContent.scrollTop > 300);
        };

        mainContent.addEventListener('scroll', handleScroll);
        return () => mainContent.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const { notifications } = useUserNotifications();

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 text-foreground pb-20 overflow-hidden sm:pb-0">
            <Header user={user || null} onLogout={handleLogout} cartCount={cartItemCount} notifications={notifications || []} onCartClick={() => setCartOpen(true)} />

            {/* Sticky Header Group: Search + Horizontal Tabs */}
            <div className="sticky top-[64px] z-30 bg-white/95 backdrop-blur shadow-sm border-b">
                <div className="px-3 py-2 space-y-2">
                    {/* Top Level Section Tabs */}
                    <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-lg">
                        <Link href="/vegetables" className={cn(
                            "text-center py-1.5 text-sm font-bold rounded-md transition-all",
                            title === 'Vegetables' ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-900"
                        )}>
                            Vegetables
                        </Link>
                        <Link href="/fruits" className={cn(
                            "text-center py-1.5 text-sm font-bold rounded-md transition-all",
                            title === 'Fruits' ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-900"
                        )}>
                            Fruits
                        </Link>
                    </div>

                    <SearchBar value={searchQuery} onChange={setSearchQuery} />
                </div>

                {/* Horizontal Category Tabs */}
                {visibleCategories.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-3 pb-2">
                        {visibleCategories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => {
                                    setActiveCategory(cat.id);
                                    document.getElementById(`category-${cat.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all whitespace-nowrap text-xs font-bold shrink-0",
                                    activeCategory === cat.id
                                        ? "bg-primary text-white border-primary shadow-sm"
                                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                )}
                            >
                                <div className={cn(
                                    "w-6 h-6 rounded-full overflow-hidden bg-white/20 shrink-0 relative",
                                    activeCategory === cat.id ? "border border-white/30" : "border border-gray-100"
                                )}>
                                    {cat.products[0]?.imageUrl ? (
                                        <Image
                                            src={cat.products[0].imageUrl}
                                            fill
                                            className="object-cover"
                                            alt=""
                                            sizes="24px"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gray-200" />
                                    )}
                                </div>
                                {cat.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex flex-1 overflow-hidden h-full">
                {/* Main Content - Full Width now */}
                <main ref={mainContentRef} className="flex-1 h-full overflow-y-auto bg-gray-50/50 p-3 pb-32 relative">
                    {loading ? (
                        <div className="grid grid-cols-2 gap-3">
                            {Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)}
                        </div>
                    ) : (
                        <div className="space-y-8 pt-2">
                            {visibleCategories.map(cat => (
                                <div key={cat.id} id={`category-${cat.id}`} className="scroll-mt-[180px]">
                                    {/* Offset increased for sticky header */}
                                    <div className="flex items-center justify-between mb-3 px-1">
                                        <h2 className="text-lg font-bold text-gray-800">{cat.name}</h2>
                                    </div>
                                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                        {cat.products.map(product => {
                                            const cartItem = cart.find(item => item.product.id === product.id && !item.isCut);
                                            const cutCartItem = cart.find(item => item.product.id === product.id && item.isCut);
                                            return (
                                                <ProductCard
                                                    key={product.id}
                                                    product={product}
                                                    onAddToCart={addToCart}
                                                    onUpdateQuantity={updateCartQuantity}
                                                    cartQuantity={cartItem?.quantity || 0}
                                                    cutCartQuantity={cutCartItem?.quantity || 0}
                                                    onClick={() => setSelectedProduct(product)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {visibleCategories.length === 0 && (
                                <div className="text-center py-10 text-muted-foreground">
                                    No products found.
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>


            <ProductDetailsSheet
                isOpen={!!selectedProduct}
                onClose={() => setSelectedProduct(null)}
                product={selectedProduct}
                cartQuantity={selectedProduct ? (cart.find(i => i.product.id === selectedProduct.id && !i.isCut)?.quantity || 0) : 0}
                cutCartQuantity={selectedProduct ? (cart.find(i => i.product.id === selectedProduct.id && i.isCut)?.quantity || 0) : 0}
                onAddToCart={addToCart}
                onUpdateQuantity={updateCartQuantity}
            />

            <CartSheet
                isOpen={isCartOpen}
                onOpenChange={setCartOpen}
                cart={cart}
                cartTotal={cartTotal}
                updateCartQuantity={updateCartQuantity}
                clearCart={clearCart}
            />

            {/* Floating Scroll to Top Button */}
            {showScrollTop && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-24 right-4 z-50 p-3 bg-primary text-white rounded-full shadow-lg hover:bg-primary/90 transition-all active:scale-95 animate-in fade-in slide-in-from-bottom-4"
                    aria-label="Scroll to top"
                >
                    <ArrowUp className="h-6 w-6" />
                </button>
            )}
        </div>
    );
}
