'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export interface FlyingItem {
    id: number;
    rect: DOMRect;
    imageSrc: string;
}

interface FlyToCartContextType {
    addToCart: (rect: DOMRect, imageSrc: string) => void;
    flyingItems: FlyingItem[];
    removeFlyingItem: (id: number) => void;
}

const FlyToCartContext = createContext<FlyToCartContextType>({
    addToCart: () => { },
    flyingItems: [],
    removeFlyingItem: () => { },
});

export function FlyToCartProvider({ children }: { children: ReactNode }) {
    const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);

    const addToCart = useCallback((rect: DOMRect, imageSrc: string) => {
        const id = Date.now() + Math.random();
        setFlyingItems((prev) => [...prev, { id, rect, imageSrc }]);
    }, []);

    const removeFlyingItem = useCallback((id: number) => {
        setFlyingItems((prev) => prev.filter((item) => item.id !== id));
    }, []);

    return (
        <FlyToCartContext.Provider value={{ addToCart, flyingItems, removeFlyingItem }}>
            {children}
        </FlyToCartContext.Provider>
    );
}

export function useFlyToCart() {
    return useContext(FlyToCartContext);
}
