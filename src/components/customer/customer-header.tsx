'use client';

import { useState } from 'react';
import { Filter, Search, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from '@/components/ui/button';
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown } from 'lucide-react';

export const CATEGORIES = [
    { id: 'All', label: 'All', icon: '🧺', color: 'bg-gray-100 text-gray-700' },
    { id: 'Vegetables', label: 'Vegetables', icon: '🥦', color: 'bg-green-100 text-green-700' },
    { id: 'Leafy Vegetables', label: 'Leafy Veg', icon: '🍃', color: 'bg-emerald-100 text-emerald-700' },
    { id: 'Fruits', label: 'Fruits', icon: '🍎', color: 'bg-red-100 text-red-700' },
    { id: 'Dairy', label: 'Dairy', icon: '🥛', color: 'bg-blue-100 text-blue-700' },
    { id: 'Cool Drinks', label: 'Cool Drinks', icon: '🥤', color: 'bg-cyan-100 text-cyan-700' },
    { id: 'Drinking Water', label: 'Water', icon: '💧', color: 'bg-sky-100 text-sky-700' },
];

interface CustomerHeaderProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    activeCategory: string;
    setActiveCategory: (category: string) => void;
    sortOption: string;
    setSortOption: (option: string) => void;
    isStoreOpen: boolean;
}

export default function CustomerHeader({
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    sortOption,
    setSortOption,
    isStoreOpen
}: CustomerHeaderProps) {
    const [isFilterOpen, setFilterOpen] = useState(false);

    return (
        <div className={`sticky ${!isStoreOpen ? 'top-12' : 'top-0'} z-30 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100 transition-all pb-1`}>
            <div className="container mx-auto px-4 py-2 space-y-2">
                <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                            placeholder="Search for vegetables..."
                            className="pl-10 bg-gray-100/50 border-gray-200 rounded-2xl h-11 focus-visible:ring-primary focus-visible:border-primary/50 text-base shadow-sm hover:bg-gray-100 transition-colors"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    {/* Filter Sidebar Trigger */}
                    <Sheet open={isFilterOpen} onOpenChange={setFilterOpen}>
                        <SheetTrigger asChild>
                            <button
                                className="p-3 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all border border-gray-200 shadow-sm"
                                aria-label="Filter"
                            >
                                <Filter className="w-5 h-5" />
                            </button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                            <SheetHeader>
                                <SheetTitle className="text-xl font-headline">Filters & Sort</SheetTitle>
                            </SheetHeader>
                            <div className="py-6 flex flex-col gap-6">
                                {/* Sort Section in Sheet */}
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                        <ArrowUpDown className="w-4 h-4" /> Sort By
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['recommended', 'price-low', 'price-high', 'name'].map((opt) => (
                                            <button
                                                key={opt}
                                                onClick={() => setSortOption(opt)}
                                                className={cn(
                                                    "px-3 py-2 rounded-lg text-sm border transition-all",
                                                    sortOption === opt
                                                        ? "bg-primary text-white border-primary font-medium"
                                                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                                )}
                                            >
                                                {opt === 'recommended' && 'Recommended'}
                                                {opt === 'price-low' && 'Price: Low to High'}
                                                {opt === 'price-high' && 'Price: High to Low'}
                                                {opt === 'name' && 'Name (A-Z)'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Categories Section in Sheet */}
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-gray-900">Categories</h3>
                                    <div className="grid grid-cols-1 gap-2">
                                        {CATEGORIES.map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => {
                                                    setActiveCategory(cat.id);
                                                    setFilterOpen(false);
                                                }}
                                                className={cn(
                                                    "flex items-center gap-3 p-3 rounded-xl transition-all text-left border",
                                                    activeCategory === cat.id
                                                        ? "bg-primary/5 border-primary/20 text-primary font-bold shadow-sm"
                                                        : "hover:bg-gray-50 border-transparent hover:border-gray-200 text-gray-700"
                                                )}
                                            >
                                                <span className="text-2xl">{cat.icon}</span>
                                                <span className="font-medium">{cat.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>

                {/* Sticky Horizontal Categories (Hidden if searching, to reduce clutter) */}
                {!searchQuery && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2 pt-1 sm:mx-0 sm:px-0 scroll-smooth">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={cn(
                                    "px-4 py-1.5 rounded-full font-bold text-xs transition-all border flex items-center gap-1.5 whitespace-nowrap shrink-0 select-none",
                                    activeCategory === cat.id
                                        ? "bg-primary text-white border-primary shadow-md scale-105"
                                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                                )}
                            >
                                <span>{cat.icon}</span>
                                {cat.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
