'use client';

import { useEffect, useState } from 'react';
import React from 'react';

// Simple confetti particle system without external dependencies
export function Confetti() {
    const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string; rotation: number; delay: number }[]>([]);

    useEffect(() => {
        const colors = ['#EF4444', '#10B981', '#3B82F6', '#FBBF24', '#8B5CF6'];
        const count = 50;
        const newParticles = [];

        for (let i = 0; i < count; i++) {
            newParticles.push({
                id: i,
                x: Math.random() * 100,
                y: -10,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                delay: Math.random() * 2,
            });
        }
        setParticles(newParticles);
    }, []);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="absolute w-3 h-3 rounded-[1px] animate-fall"
                    style={{
                        left: `${p.x}%`,
                        top: `-20px`,
                        backgroundColor: p.color,
                        transform: `rotate(${p.rotation}deg)`,
                        animation: `fall 3s linear forwards ${p.delay}s`,
                    }}
                />
            ))}
            <style jsx global>{`
        @keyframes fall {
          0% { top: -20px; transform: rotate(0deg) translateX(0); opacity: 1; }
          100% { top: 100%; transform: rotate(720deg) translateX(20px); opacity: 0; }
        }
      `}</style>
        </div>
    );
}
