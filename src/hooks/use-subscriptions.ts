import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCollection, useFirestore, useAuth } from '@/firebase';
import { collection, query, where, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import type { Subscription, Product } from '@/lib/types';
import type { Constraint } from '@/firebase/firestore/utils';
import { toast } from '@/hooks/use-toast';

export interface UseSubscriptionsOptions {
  customerId?: string;
  enabled?: boolean;
}

export interface UseSubscriptionsReturn {
  subscriptions: Subscription[];
  loading: boolean;
  error: string | null;
  createSubscription: (subscription: Omit<Subscription, 'id'>) => Promise<void>;
  updateSubscription: (id: string, updates: Partial<Subscription>) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  pauseSubscription: (id: string) => Promise<void>;
  resumeSubscription: (id: string) => Promise<void>;
}

export function useSubscriptions(options: UseSubscriptionsOptions = {}): UseSubscriptionsReturn {
  const { customerId, enabled = true } = options;
  const firestore = useFirestore();
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);

  // Build query constraints based on customerId
  const constraints = useMemo(() => {
    const baseConstraints: Constraint[] = [];
    if (customerId) {
      baseConstraints.push(['where', 'customerId', '==', customerId]);
    }
    return baseConstraints;
  }, [customerId]);

  // Fetch subscriptions
  const { data: subscriptions, loading, error: collectionError } = useCollection<Subscription>(
    'subscriptions',
    {
      constraints: constraints,
      disabled: !enabled || !firestore
    }
  );

  // Update error state when collection error changes
  useEffect(() => {
    if (collectionError) {
      setError(typeof collectionError === 'string' ? collectionError : collectionError.message);
    } else {
      setError(null);
    }
  }, [collectionError]);

  const createSubscription = useCallback(async (subscription: Omit<Subscription, 'id'>): Promise<void> => {
    if (!firestore || !auth?.currentUser) {
      throw new Error('Not authenticated');
    }

    try {
      const subscriptionData = {
        ...subscription,
        customerId: subscription.customerId || auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(firestore, 'subscriptions'), subscriptionData);

      toast({
        title: 'Subscription Created',
        description: 'Your subscription has been created successfully.'
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create subscription';
      setError(errorMessage);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage
      });
      throw err;
    }
  }, [firestore, auth]);

  const updateSubscription = useCallback(async (id: string, updates: Partial<Subscription>): Promise<void> => {
    if (!firestore) {
      throw new Error('Firestore not available');
    }

    try {
      const subscriptionRef = doc(firestore, 'subscriptions', id);
      await updateDoc(subscriptionRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });

      toast({
        title: 'Subscription Updated',
        description: 'Your subscription has been updated successfully.'
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update subscription';
      setError(errorMessage);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage
      });
      throw err;
    }
  }, [firestore]);

  const deleteSubscription = useCallback(async (id: string): Promise<void> => {
    if (!firestore) {
      throw new Error('Firestore not available');
    }

    try {
      const subscriptionRef = doc(firestore, 'subscriptions', id);
      await deleteDoc(subscriptionRef);

      toast({
        title: 'Subscription Deleted',
        description: 'Your subscription has been deleted successfully.'
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete subscription';
      setError(errorMessage);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage
      });
      throw err;
    }
  }, [firestore]);

  const pauseSubscription = useCallback(async (id: string): Promise<void> => {
    await updateSubscription(id, { isActive: false });
  }, [updateSubscription]);

  const resumeSubscription = useCallback(async (id: string): Promise<void> => {
    await updateSubscription(id, { isActive: true });
  }, [updateSubscription]);

  return {
    subscriptions: subscriptions || [],
    loading,
    error,
    createSubscription,
    updateSubscription,
    deleteSubscription,
    pauseSubscription,
    resumeSubscription
  };
}