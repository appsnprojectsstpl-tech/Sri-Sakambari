'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, Mail, Package, Tag } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { User, NotificationPreferences } from '@/lib/types';

interface NotificationSettingsProps {
    user: User;
}

export default function NotificationSettings({ user }: NotificationSettingsProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [preferences, setPreferences] = useState<NotificationPreferences>({
        orderUpdates: true,
        promotions: true,
        deliveryAlerts: true,
        emailNotifications: false,
        ...user.notifications // Merge with user preferences if they exist
    });

    const handleToggle = async (key: keyof NotificationPreferences) => {
        const newPreferences = {
            ...preferences,
            [key]: !preferences[key],
        };
        setPreferences(newPreferences);

        try {
            await setDoc(doc(firestore, 'users', user.id), {
                notifications: newPreferences
            }, { merge: true });

            toast({
                title: 'Settings Saved',
                description: 'Your notification preferences have been updated.',
            });
        } catch (error) {
            console.error('Error saving settings:', error);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: 'Could not save your preferences. Please try again.',
            });
            // Revert on error
            setPreferences(preferences);
        }
    };

    const settings = [
        {
            key: 'orderUpdates' as keyof NotificationPreferences,
            icon: Package,
            title: 'Order Updates',
            description: 'Get notified about order status changes',
            color: 'text-blue-600',
        },
        {
            key: 'deliveryAlerts' as keyof NotificationPreferences,
            icon: Bell,
            title: 'Delivery Alerts',
            description: 'Receive alerts when your order is out for delivery',
            color: 'text-green-600',
        },
        {
            key: 'promotions' as keyof NotificationPreferences,
            icon: Tag,
            title: 'Promotions & Offers',
            description: 'Stay updated on special deals and discounts',
            color: 'text-orange-600',
        },
        {
            key: 'emailNotifications' as keyof NotificationPreferences,
            icon: Mail,
            title: 'Email Notifications',
            description: 'Receive notifications via email',
            color: 'text-purple-600',
        },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notification Settings
                </CardTitle>
                <CardDescription>Manage how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {settings.map((setting) => {
                    const Icon = setting.icon;
                    return (
                        <div
                            key={setting.key}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                            <div className="flex items-start gap-3 flex-1">
                                <div className={`mt-1 ${setting.color}`}>
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <Label htmlFor={setting.key} className="text-base font-medium cursor-pointer">
                                        {setting.title}
                                    </Label>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {setting.description}
                                    </p>
                                </div>
                            </div>
                            <Switch
                                id={setting.key}
                                checked={preferences[setting.key]}
                                onCheckedChange={() => handleToggle(setting.key)}
                            />
                        </div>
                    );
                })}

                <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground">
                        💡 You can change these settings anytime. Some notifications may still be sent for important account updates.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
