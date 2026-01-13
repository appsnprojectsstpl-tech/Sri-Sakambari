'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFlyToCart } from './fly-to-cart-context';

export default function FlyToCartOverlay() {
    const { flyingItems, removeFlyingItem } = useFlyToCart();
    const [cartRect, setCartRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        const updateCartRect = () => {
            const cartElement = document.getElementById('cart-trigger-button');
            if (cartElement) {
                setCartRect(cartElement.getBoundingClientRect());
            }
        };

        // Update initially
        updateCartRect();

        // Update on resize
        window.addEventListener('resize', updateCartRect);

        // Optional: Update heavily as layout might shift
        const interval = setInterval(updateCartRect, 2000);

        return () => {
            window.removeEventListener('resize', updateCartRect);
            clearInterval(interval);
        };
    }, []);

    if (!cartRect) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-[100]">
            <AnimatePresence>
                {flyingItems.map((item) => (
                    <motion.img
                        key={item.id}
                        src={item.imageSrc}
                        initial={{
                            top: item.rect.top,
                            left: item.rect.left,
                            width: item.rect.width,
                            height: item.rect.height,
                            opacity: 1,
                            scale: 1,
                        }}
                        animate={{
                            top: cartRect.top + cartRect.height / 2 - 20, // Center roughly
                            left: cartRect.left + cartRect.width / 2 - 20,
                            width: 40,
                            height: 40,
                            opacity: 0.5,
                            scale: 0.5,
                        }}
                        transition={{ duration: 0.8, ease: "easeInOut" }}
                        style={{ position: 'absolute', objectFit: 'cover', borderRadius: '50%' }}
                        onAnimationComplete={() => removeFlyingItem(item.id)}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
}
