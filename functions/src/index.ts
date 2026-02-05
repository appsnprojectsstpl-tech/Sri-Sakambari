import { logger } from 'firebase-functions';
import * as deliveryRuns from './delivery-runs';
import * as notifications from './whatsapp-sms-notifications';

// Export delivery runs functions
export const createDeliveryRuns = deliveryRuns.createDeliveryRuns;
export const optimizeDeliveryRoutes = deliveryRuns.optimizeDeliveryRoutes;
export const monitorDeliveryRuns = deliveryRuns.monitorDeliveryRuns;

// Export notification functions
export const onOrderStatusChange = notifications.onOrderStatusChange;
export const sendSubscriptionReminder = notifications.sendSubscriptionReminder;
export const sendStockAlert = notifications.sendStockAlert;
export const handleWhatsAppWebhook = notifications.handleWhatsAppWebhook;

logger.info('Sakambari Firebase Functions initialized');