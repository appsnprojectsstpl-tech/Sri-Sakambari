'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useSubscriptions } from '@/hooks/use-subscriptions';
import { useProducts } from '@/hooks/use-products';
import { useAuth } from '@/firebase';
import { Plus, Edit, Trash2, Pause, Play, Calendar, MapPin, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { Subscription } from '@/lib/types';
import { useLanguage } from '@/context/language-context';
import { t } from '@/lib/translations';

interface SubscriptionFormData {
  planName: string;
  items: { productId: string; qty: number }[];
  frequency: 'DAILY' | 'ALTERNATE' | 'WEEKEND' | 'CUSTOM';
  customDays?: number[];
  area: string;
  deliverySlot: string;
  startDate: string;
  endDate?: string;
  notes?: string;
}

export default function CustomerSubscriptions() {
  const auth = useAuth();
  const { language } = useLanguage();
  const { subscriptions, loading, createSubscription, updateSubscription, deleteSubscription, pauseSubscription, resumeSubscription } = useSubscriptions({
    customerId: auth?.currentUser?.uid,
    enabled: !!auth?.currentUser
  });

  const { products } = useProducts({
    filters: { isActive: true },
    enabled: true
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSubscriptions, setSelectedSubscriptions] = useState<Set<string>>(new Set());
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [formData, setFormData] = useState<SubscriptionFormData>({
    planName: '',
    items: [],
    frequency: 'DAILY',
    area: '',
    deliverySlot: 'morning',
    startDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const resetForm = () => {
    setFormData({
      planName: '',
      items: [],
      frequency: 'DAILY',
      area: '',
      deliverySlot: 'morning',
      startDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setEditingSubscription(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!auth?.currentUser) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must be logged in to manage subscriptions'
      });
      return;
    }

    // Enhanced validation
    if (!formData.planName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a plan name'
      });
      return;
    }

    if (formData.items.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please add at least one item to your subscription'
      });
      return;
    }

    // Validate items have valid quantities
    const invalidItems = formData.items.filter(item => !item.productId || item.qty <= 0);
    if (invalidItems.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a product and enter a valid quantity for all items'
      });
      return;
    }

    // Validate custom days for CUSTOM frequency
    if (formData.frequency === 'CUSTOM' && (!formData.customDays || formData.customDays.length === 0)) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select at least one day for custom frequency'
      });
      return;
    }

    // Validate start date is not in the past
    const startDate = new Date(formData.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDate < today) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Start date cannot be in the past'
      });
      return;
    }

    // Validate end date if provided
    if (formData.endDate) {
      const endDate = new Date(formData.endDate);
      if (endDate <= startDate) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'End date must be after start date'
        });
        return;
      }
    }

    // Validate area is not empty
    if (!formData.area.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a delivery area'
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const subscriptionData = {
        ...formData,
        customerId: auth.currentUser.uid,
        isActive: true,
        customDays: formData.frequency === 'CUSTOM' ? formData.customDays : undefined,
        endDate: formData.endDate || undefined
      };

      if (editingSubscription) {
        await updateSubscription(editingSubscription.id, subscriptionData);
        toast({
          title: 'Subscription Updated',
          description: 'Your subscription has been updated successfully'
        });
      } else {
        await createSubscription(subscriptionData);
        toast({
          title: 'Subscription Created',
          description: 'Your subscription has been created successfully'
        });
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving subscription:', error);
      
      // Provide more specific error messages based on error type
      let errorMessage = 'Failed to save subscription';
      if (error instanceof Error) {
        if (error.message.includes('permission-denied')) {
          errorMessage = 'You do not have permission to create subscriptions';
        } else if (error.message.includes('invalid-argument')) {
          errorMessage = 'Invalid subscription data provided';
        } else if (error.message.includes('already-exists')) {
          errorMessage = 'A subscription with this name already exists';
        } else if (error.message.includes('not-found')) {
          errorMessage = 'Subscription not found';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setFormData({
      planName: subscription.planName,
      items: subscription.items,
      frequency: subscription.frequency,
      customDays: subscription.customDays,
      area: subscription.area,
      deliverySlot: subscription.deliverySlot,
      startDate: subscription.startDate.toISOString().split('T')[0],
      endDate: subscription.endDate?.toISOString().split('T')[0],
      notes: subscription.notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (subscription: Subscription) => {
    const confirmed = window.confirm(`Are you sure you want to delete "${subscription.planName}" subscription? This action cannot be undone.`);
    if (confirmed) {
      try {
        await deleteSubscription(subscription.id);
        toast({
          title: 'Subscription Deleted',
          description: `"${subscription.planName}" subscription has been deleted successfully`
        });
      } catch (error) {
        console.error('Error deleting subscription:', error);
        
        // Provide more specific error messages based on error type
        let errorMessage = 'Failed to delete subscription';
        if (error instanceof Error) {
          if (error.message.includes('permission-denied')) {
            errorMessage = 'You do not have permission to delete this subscription';
          } else if (error.message.includes('not-found')) {
            errorMessage = 'Subscription not found';
          } else if (error.message.includes('has-orders')) {
            errorMessage = 'Cannot delete subscription with existing orders';
          } else {
            errorMessage = error.message;
          }
        }
        
        toast({
          variant: 'destructive',
          title: 'Error',
          description: errorMessage
        });
      }
    }
  };

  const handlePauseResume = async (subscription: Subscription) => {
    try {
      if (subscription.isActive) {
        await pauseSubscription(subscription.id);
        toast({
          title: 'Subscription Paused',
          description: `"${subscription.planName}" subscription has been paused"
        });
      } else {
        await resumeSubscription(subscription.id);
        toast({
          title: 'Subscription Resumed',
          description: `"${subscription.planName}" subscription has been resumed"
        });
      }
    } catch (error) {
      console.error('Error toggling subscription:', error);
      
      // Provide more specific error messages based on error type
      let errorMessage = 'Failed to update subscription status';
      if (error instanceof Error) {
        if (error.message.includes('permission-denied')) {
          errorMessage = 'You do not have permission to update this subscription';
        } else if (error.message.includes('not-found')) {
          errorMessage = 'Subscription not found';
        } else if (error.message.includes('invalid-state')) {
          errorMessage = 'Cannot change subscription status in current state';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage
      });
    }
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { productId: '', qty: 1 }]
    }));
  };

  const updateItem = (index: number, field: 'productId' | 'qty', value: string | number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const toggleCustomDay = (day: number) => {
    setFormData(prev => {
      const customDays = prev.customDays || [];
      const newCustomDays = customDays.includes(day)
        ? customDays.filter(d => d !== day)
        : [...customDays, day];
      
      return {
        ...prev,
        customDays: newCustomDays
      };
    });
  };

  const handleSelectAll = () => {
    if (selectedSubscriptions.size === subscriptions.length) {
      setSelectedSubscriptions(new Set());
    } else {
      setSelectedSubscriptions(new Set(subscriptions.map(s => s.id)));
    }
  };

  const handleSelectSubscription = (subscriptionId: string) => {
    setSelectedSubscriptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subscriptionId)) {
        newSet.delete(subscriptionId);
      } else {
        newSet.add(subscriptionId);
      }
      return newSet;
    });
  };

  const handleBulkPauseResume = async () => {
    if (selectedSubscriptions.size === 0) return;
    
    setIsBulkActionLoading(true);
    const selectedList = subscriptions.filter(s => selectedSubscriptions.has(s.id));
    const allActive = selectedList.every(s => s.isActive);
    
    try {
      if (allActive) {
        await Promise.all(selectedList.map(s => pauseSubscription(s.id)));
        toast({
          title: 'Bulk Action Completed',
          description: `${selectedList.length} subscriptions paused successfully`
        });
      } else {
        await Promise.all(selectedList.map(s => resumeSubscription(s.id)));
        toast({
          title: 'Bulk Action Completed',
          description: `${selectedList.length} subscriptions resumed successfully`
        });
      }
      setSelectedSubscriptions(new Set());
    } catch (error) {
      console.error('Bulk action error:', error);
      toast({
        variant: 'destructive',
        title: 'Bulk Action Failed',
        description: 'Failed to update selected subscriptions'
      });
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSubscriptions.size === 0) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedSubscriptions.size} selected subscriptions? This action cannot be undone.`);
    if (!confirmed) return;
    
    setIsBulkActionLoading(true);
    try {
      await Promise.all(Array.from(selectedSubscriptions).map(id => deleteSubscription(id)));
      toast({
        title: 'Bulk Action Completed',
        description: `${selectedSubscriptions.size} subscriptions deleted successfully`
      });
      setSelectedSubscriptions(new Set());
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast({
        variant: 'destructive',
        title: 'Bulk Action Failed',
        description: 'Failed to delete selected subscriptions'
      });
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t('mySubscriptions', language)}</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              {t('createSubscription', language)}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSubscription ? t('editSubscription', language) : t('createSubscription', language)}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="planName">{t('planName', language)}</Label>
                  <Input
                    id="planName"
                    value={formData.planName}
                    onChange={(e) => setFormData(prev => ({ ...prev, planName: e.target.value }))}
                    placeholder={t('enterPlanName', language)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="frequency">{t('frequency', language)}</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">{t('daily', language)}</SelectItem>
                      <SelectItem value="ALTERNATE">{t('alternateDays', language)}</SelectItem>
                      <SelectItem value="WEEKEND">{t('weekends', language)}</SelectItem>
                      <SelectItem value="CUSTOM">{t('custom', language)}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.frequency === 'CUSTOM' && (
                <div>
                  <Label>{t('selectDays', language)}</Label>
                  <div className="grid grid-cols-7 gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Checkbox
                          id={`day-${index}`}
                          checked={formData.customDays?.includes(index) || false}
                          onCheckedChange={() => toggleCustomDay(index)}
                        />
                        <Label htmlFor={`day-${index}`} className="text-sm">{day}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="area">{t('deliveryArea', language)}</Label>
                  <Input
                    id="area"
                    value={formData.area}
                    onChange={(e) => setFormData(prev => ({ ...prev, area: e.target.value }))}
                    placeholder={t('enterArea', language)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="deliverySlot">{t('deliverySlot', language)}</Label>
                  <Select
                    value={formData.deliverySlot}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, deliverySlot: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">{t('morning', language)}</SelectItem>
                      <SelectItem value="afternoon">{t('afternoon', language)}</SelectItem>
                      <SelectItem value="evening">{t('evening', language)}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="startDate">{t('startDate', language)}</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">{t('endDate', language)} (Optional)</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    min={formData.startDate}
                  />
                </div>
              </div>

              <div>
                <Label>{t('subscriptionItems', language)}</Label>
                <div className="space-y-2">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Select
                        value={item.productId}
                        onValueChange={(value) => updateItem(index, 'productId', value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={t('selectProduct', language)} />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => updateItem(index, 'qty', parseInt(e.target.value) || 1)}
                        className="w-20"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('addItem', language)}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">{t('notes', language)}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder={t('enterNotes', language)}
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  {t('cancel', language)}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {t('saving', language)}
                    </>
                  ) : (
                    editingSubscription ? t('update', language) : t('create', language)
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {subscriptions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">{t('noSubscriptions', language)}</p>
            <Button onClick={() => setIsDialogOpen(true)} className="mt-4">
              {t('createFirstSubscription', language)}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {selectedSubscriptions.size > 0 && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">
                      {selectedSubscriptions.size} subscription{selectedSubscriptions.size !== 1 ? 's' : ''} selected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      disabled={isBulkActionLoading}
                    >
                      {selectedSubscriptions.size === subscriptions.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkPauseResume}
                      disabled={isBulkActionLoading}
                    >
                      {isBulkActionLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          {subscriptions.filter(s => selectedSubscriptions.has(s.id)).every(s => s.isActive) ? (
                            <><Pause className="w-4 h-4 mr-1" /> Pause Selected</>
                          ) : (
                            <><Play className="w-4 h-4 mr-1" /> Resume Selected</>
                          )}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={isBulkActionLoading}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete Selected
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {subscriptions.map((subscription) => (
            <Card key={subscription.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      checked={selectedSubscriptions.has(subscription.id)}
                      onCheckedChange={() => handleSelectSubscription(subscription.id)}
                      disabled={isBulkActionLoading}
                    />
                    <div>
                      <CardTitle className="text-lg">{subscription.planName}</CardTitle>
                    <CardDescription>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {subscription.frequency}
                        </span>
                        <span className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          {subscription.area}
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {subscription.deliverySlot}
                        </span>
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={subscription.isActive ? 'default' : 'secondary'}>
                      {subscription.isActive ? t('active', language) : t('paused', language)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">{t('items', language)}</h4>
                    <div className="space-y-1">
                      {subscription.items.map((item, index) => {
                        const product = products.find(p => p.id === item.productId);
                        return (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{product?.name || t('unknownProduct', language)}</span>
                            <span>{item.qty} {t('units', language)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {subscription.notes && (
                    <div>
                      <h4 className="font-medium mb-1">{t('notes', language)}</h4>
                      <p className="text-sm text-muted-foreground">{subscription.notes}</p>
                    </div>
                  )}

                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(subscription)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      {t('edit', language)}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePauseResume(subscription)}
                    >
                      {subscription.isActive ? (
                        <Pause className="w-4 h-4 mr-1" />
                      ) : (
                        <Play className="w-4 h-4 mr-1" />
                      )}
                      {subscription.isActive ? t('pause', language) : t('resume', language)}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(subscription)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      {t('delete', language)}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}