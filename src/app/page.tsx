'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export default function InitialPage() {
  const router = useRouter();
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    try {
      // Attempt redirect
      router.replace('/home');

      // If still here after 2s, show manual button
      const timer = setTimeout(() => {
        setShowManual(true);
      }, 2000);

      return () => clearTimeout(timer);
    } catch (e) {
      console.error("Redirect Error:", e);
      setShowManual(true);
    }
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 gap-4">
      <p className="text-lg font-semibold animate-pulse">Loading Sri Sakambari Devi Market...</p>

      {showManual && (
        <Button
          onClick={() => router.push('/home')}
          variant="default"
          size="lg"
          className="animate-in fade-in zoom-in"
        >
          Enter Market
        </Button>
      )}
    </div>
  );
}
