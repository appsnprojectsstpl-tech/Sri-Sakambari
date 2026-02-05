import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSubscriptions } from '@/hooks/use-subscriptions';
import { useAuth, useCollection } from '@/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

// Mock Firebase
vi.mock('@/firebase', () => ({
  useAuth: vi.fn(),
  useFirestore: vi.fn(() => ({})),
  useCollection: vi.fn(() => ({ data: [], loading: false, error: null })),
  firestore: {}
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ id: 'subscriptions' })),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-sub-id' })),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn(() => ({ id: 'sub-1' })),
  serverTimestamp: vi.fn(() => 'mock-timestamp')
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn()
}));

describe('useSubscriptions Hook', () => {
  const mockAuth = {
    currentUser: { uid: 'test-user-id' }
  };

  const mockSubscription = {
    id: 'sub-1',
    customerId: 'test-user-id',
    planName: 'Weekly Veggies',
    frequency: 'weekly' as const,
    items: [{ productId: 'prod-1', qty: 2 }],
    deliverySlot: 'morning',
    deliveryArea: 'Area 1',
    isActive: true,
    nextDeliveryDate: '2024-01-15',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue(mockAuth);
  });

  it('should fetch subscriptions for authenticated user', async () => {
    // Mock useCollection to return the subscription data
    (useCollection as any).mockReturnValue({
      data: [mockSubscription],
      loading: false,
      error: null
    });
    
    // Mock the actual hook to return the subscription data
    vi.mocked(useCollection).mockReturnValue({
      data: [mockSubscription],
      loading: false,
      error: null
    });

    const { result } = renderHook(() => 
      useSubscriptions({ customerId: 'test-user-id', enabled: true })
    );

    await waitFor(() => {
      expect(result.current.subscriptions).toHaveLength(1);
      expect(result.current.subscriptions[0]).toEqual(mockSubscription);
    });
  });

  it('should create subscription', async () => {
    const mockDocRef = { id: 'new-sub-id' };
    (addDoc as any).mockResolvedValue(mockDocRef);

    const { result } = renderHook(() => 
      useSubscriptions({ customerId: 'test-user-id', enabled: true })
    );

    const newSub = {
      planName: 'Daily Fruits',
      frequency: 'daily' as const,
      items: [{ productId: 'prod-2', qty: 1 }],
      deliverySlot: 'evening',
      deliveryArea: 'Area 2',
      nextDeliveryDate: '2024-01-16'
    };

    await act(async () => {
      await result.current.createSubscription(newSub);
    });

    expect(addDoc).toHaveBeenCalledWith(
      { id: 'subscriptions' },
      expect.objectContaining({
        customerId: 'test-user-id',
        planName: newSub.planName,
        frequency: newSub.frequency,
        items: newSub.items,
        deliverySlot: newSub.deliverySlot,
        deliveryArea: newSub.deliveryArea,
        nextDeliveryDate: newSub.nextDeliveryDate,
        createdAt: 'mock-timestamp',
        updatedAt: 'mock-timestamp'
      })
    );
  });

  it('should update subscription', async () => {
    (updateDoc as any).mockResolvedValue(undefined);

    const { result } = renderHook(() => 
      useSubscriptions({ customerId: 'test-user-id', enabled: true })
    );

    const updates = {
      planName: 'Updated Plan',
      frequency: 'biweekly' as const
    };

    await act(async () => {
      await result.current.updateSubscription('sub-1', updates);
    });

    expect(updateDoc).toHaveBeenCalledWith(
      { id: 'sub-1' },
      expect.objectContaining({
        planName: updates.planName,
        frequency: updates.frequency,
        updatedAt: 'mock-timestamp'
      })
    );
  });

  it('should pause subscription', async () => {
    (updateDoc as any).mockResolvedValue(undefined);

    const { result } = renderHook(() => 
      useSubscriptions({ customerId: 'test-user-id', enabled: true })
    );

    await act(async () => {
      await result.current.pauseSubscription('sub-1');
    });

    expect(updateDoc).toHaveBeenCalledWith(
      { id: 'sub-1' },
      expect.objectContaining({
        isActive: false,
        updatedAt: 'mock-timestamp'
      })
    );
  });

  it('should resume subscription', async () => {
    (updateDoc as any).mockResolvedValue(undefined);

    const { result } = renderHook(() => 
      useSubscriptions({ customerId: 'test-user-id', enabled: true })
    );

    await act(async () => {
      await result.current.resumeSubscription('sub-1');
    });

    expect(updateDoc).toHaveBeenCalledWith(
      { id: 'sub-1' },
      expect.objectContaining({
        isActive: true,
        updatedAt: 'mock-timestamp'
      })
    );
  });

  it('should delete subscription', async () => {
    (deleteDoc as any).mockResolvedValue(undefined);

    const { result } = renderHook(() => 
      useSubscriptions({ customerId: 'test-user-id', enabled: true })
    );

    await act(async () => {
      await result.current.deleteSubscription('sub-1');
    });

    expect(deleteDoc).toHaveBeenCalledWith(doc(expect.anything(), 'subscriptions', 'sub-1'));
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Network error');
    
    // Mock useCollection to return an error
    (useCollection as any).mockReturnValue({
      data: [],
      loading: false,
      error: error.message
    });

    const { result } = renderHook(() => 
      useSubscriptions({ customerId: 'test-user-id', enabled: true })
    );

    await waitFor(() => {
      expect(result.current.error).toBe(error.message);
    });
  });

  it('should not fetch when disabled', () => {
    renderHook(() => 
      useSubscriptions({ customerId: 'test-user-id', enabled: false })
    );

    expect(onSnapshot).not.toHaveBeenCalled();
  });
});