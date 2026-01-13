'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingBag, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlyToCart } from '@/components/fly-to-cart-context';

export function BottomNav() {
    const pathname = usePathname();
    // Cart count might be used later if we add a badge elsewhere, but here we removed cart icon.
    // Kept hook if needed for other logic, or can remove.
    const { cartCount } = useFlyToCart();

    // Hide on landing page if needed
    if (pathname === '/home') return null;

    const navItems = [
        { href: '/home', label: 'Home', icon: Home },
        { href: '/dashboard', label: 'Shop', icon: ShoppingBag },
        { href: '/profile', label: 'Profile', icon: User },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] pb-safe-area">
            <div className="flex items-center justify-around h-16">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-center justify-center w-full h-full relative group"
                        >
                            <div className={cn(
                                "flex items-center justify-center p-2 rounded-xl transition-all duration-200",
                                isActive ? "bg-primary/10 text-primary" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                            )}>
                                <Icon className={cn("w-6 h-6 sm:w-7 sm:h-7", isActive && "fill-current")} strokeWidth={isActive ? 2 : 2} />
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
