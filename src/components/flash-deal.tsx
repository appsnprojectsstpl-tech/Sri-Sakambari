'use client';

import { useState, useEffect } from 'react';
import { Timer, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/language-context';
import Image from 'next/image';

export function FlashDealCard() {
    const [timeLeft, setTimeLeft] = useState('');
    const { language } = useLanguage();

    useEffect(() => {
        // Set deadline to end of day
        const calculateTime = () => {
            const now = new Date();
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            const diff = end.getTime() - now.getTime();

            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            return `${hours}h ${minutes}m ${seconds}s`;
        };

        const timer = setInterval(() => {
            setTimeLeft(calculateTime());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="w-full max-w-sm sm:max-w-xl bg-gradient-to-r from-red-600 to-red-500 rounded-xl overflow-hidden shadow-lg border-2 border-white/20 my-4 text-white relative">
            <div className='absolute top-0 right-0 p-4 opacity-10'>
                <Timer className='w-32 h-32' />
            </div>

            <div className="p-4 flex gap-4 items-center relative z-10">
                <div className="relative w-24 h-24 sm:w-32 sm:h-32 bg-white rounded-lg p-1 shrink-0 rotate-3 shadow-md">
                    <Image
                        src="https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=200"
                        alt="Flash Deal"
                        fill
                        className='object-cover rounded'
                    />
                    <div className='absolute -top-2 -right-2 bg-yellow-400 text-red-700 font-bold text-xs px-2 py-1 rounded-full shadow-sm'>
                        -40%
                    </div>
                </div>

                <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-white/20 text-xs px-2 py-0.5 rounded font-medium flex items-center gap-1 animate-pulse">
                            <Timer className="w-3 h-3" /> Ends in {timeLeft}
                        </span>
                    </div>
                    <h3 className="font-bold text-lg leading-tight">Hybrid Tomato Box (5kg)</h3>
                    <div className='flex items-end gap-2'>
                        <span className='text-2xl font-extrabold text-yellow-300'>₹149</span>
                        <span className='text-sm opacity-75 line-through mb-1'>₹250</span>
                    </div>
                    <Button size="sm" variant="secondary" className="w-full mt-2 bg-yellow-400 text-red-700 hover:bg-yellow-300 border-none font-bold">
                        <ShoppingBag className="w-4 h-4 mr-1" /> Buy Now
                    </Button>
                </div>
            </div>
        </div>
    );
}
