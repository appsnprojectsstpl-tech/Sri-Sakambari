'use client';

import { Logo } from '@/components/icons';
import { ShoppingCart, LogOut, LogIn, User as UserIcon, Bell, Languages, History, Home, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { User, Notification } from '@/lib/types';
import { Button } from './ui/button';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLanguage } from '@/context/language-context';
import { t } from '@/lib/translations';
import { haptics, ImpactStyle } from '@/lib/haptics';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  cartCount: number;
  notifications: Notification[];
  onCartClick: () => void;
}

export default function Header({ user, onLogout, cartCount, notifications, onCartClick }: HeaderProps) {
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const unreadNotifications = notifications.filter(n => !n.isRead);
  const isCustomer = !user || user.role === 'customer';

  return (
    // Mobile-first: Fixed height, clear z-indexing, solid background for readability
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {/* Mobile: Logo + Name simpler */}
          <Link href="/home" className="flex items-center gap-3">
            <Logo className="h-10 w-10 text-primary" />
            <div className='flex flex-col'>
              <h1 className="text-lg font-bold leading-tight tracking-tight text-foreground sm:text-2xl">
                Sri Sakambari Devi
              </h1>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Mobile: 44px touch targets enforced using h-11 w-11 or p-3 */}

          {/* Language Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11 hover:bg-muted/50" onClick={() => haptics.selection()}>
                <Languages className="h-6 w-6" />
                <span className="sr-only">Change language</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => {
                haptics.selection();
                setLanguage('en');
              }} className="h-11 cursor-pointer">English</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => {
                haptics.selection();
                setLanguage('te');
              }} className="h-11 cursor-pointer">Telugu</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Switcher */}
          <Button variant="ghost" size="icon" className="h-11 w-11 hover:bg-muted/50" onClick={() => {
            haptics.impact(ImpactStyle.Medium);
            setTheme(theme === 'dark' ? 'light' : 'dark');
          }}>
            <Sun className="h-6 w-6 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-6 w-6 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Notifications */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-11 w-11 hover:bg-muted/50" onClick={() => haptics.selection()}>
                  <Bell className="h-6 w-6" />
                  {unreadNotifications.length > 0 && (
                    <span className="absolute top-2 right-2 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    </span>
                  )}
                  <span className="sr-only">Notifications</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="p-4 text-base">{t('notifications', language)}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-[60vh] overflow-y-auto">
                  {notifications.length > 0 ? (
                    [...notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5).map(n => (
                      <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 p-3 cursor-pointer">
                        <p className={`font-semibold text-sm ${!n.isRead ? '' : 'text-muted-foreground'}`}>{n.title}</p>
                        <p className="text-xs text-muted-foreground">{n.message}</p>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <p className="p-4 text-center text-sm text-muted-foreground">{t('noNotifications', language)}</p>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Cart - Primary Action */}
          {isCustomer && (
            <Button id="cart-trigger-button" variant="ghost" size="icon" className="relative h-11 w-11 hover:bg-muted/50" onClick={() => {
              haptics.impact(ImpactStyle.Light);
              onCartClick();
            }}>
              <ShoppingCart className="h-6 w-6" />
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground border-2 border-background">
                  {cartCount}
                </span>
              )}
              <span className="sr-only">Shopping Cart</span>
            </Button>
          )}

          {/* User Menu */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 hover:bg-muted/50" onClick={() => haptics.selection()}>
                  <UserIcon className="h-6 w-6" />
                  <span className="sr-only">Menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="p-3 text-base font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.phone}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="h-11 cursor-pointer">
                  <Link href="/profile" className="flex items-center"><History className="mr-2 h-4 w-4" /> My Orders</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  haptics.impact(ImpactStyle.Medium);
                  onLogout();
                }} className="h-11 cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t('logout', language)}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="default" size="sm" className="ml-2 h-10 px-4">
              <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" />
                {t('login', language)}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
