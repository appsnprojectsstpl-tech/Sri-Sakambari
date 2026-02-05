import type { Role, AdminPermissions } from './types';

export const ADMIN_PERMISSIONS: Record<'admin' | 'restricted_admin', AdminPermissions> = {
    admin: {
        canAccessDashboard: true,
        canAccessInventory: true,
        canAccessProducts: true,
        canAccessOrders: true,
        canAccessSubscriptions: true,
        canAccessUsers: true,
        canAccessCoupons: true,
        canAccessWhatsApp: true,
    },
    restricted_admin: {
        canAccessDashboard: false,
        canAccessInventory: false,
        canAccessProducts: true,
        canAccessOrders: true,
        canAccessSubscriptions: false,
        canAccessUsers: false,
        canAccessCoupons: false,
        canAccessWhatsApp: true,
    },
};

export function getAdminPermissions(role: Role): AdminPermissions | null {
    if (role === 'admin' || role === 'restricted_admin') {
        return ADMIN_PERMISSIONS[role];
    }
    return null;
}

export function getAllowedTabs(role: Role): string[] {
    const permissions = getAdminPermissions(role);
    if (!permissions) return [];

    const tabs: string[] = [];
    if (permissions.canAccessDashboard) tabs.push('dashboard');
    if (permissions.canAccessInventory) tabs.push('inventory');
    if (permissions.canAccessProducts) tabs.push('products');
    if (permissions.canAccessOrders) tabs.push('orders');
    if (permissions.canAccessSubscriptions) tabs.push('subscriptions');
    if (permissions.canAccessUsers) tabs.push('users');
    if (permissions.canAccessCoupons) tabs.push('coupons');
    if (permissions.canAccessWhatsApp) tabs.push('whatsapp');

    return tabs;
}
