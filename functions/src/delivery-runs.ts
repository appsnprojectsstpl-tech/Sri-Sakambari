import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { adminDb } from '../config/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { startOfDay, addDays, isAfter, isBefore } from 'date-fns';

interface DeliveryRun {
  id: string;
  deliveryPartnerId: string;
  orders: string[];
  area: string;
  deliverySlot: string;
  date: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  createdAt: Date;
  updatedAt: Date;
}

interface DeliveryPartner {
  id: string;
  name: string;
  areas: string[];
  slots: string[];
  maxOrdersPerSlot: number;
  isActive: boolean;
}

interface Order {
  id: string;
  customerId: string;
  deliveryPartnerId?: string;
  area: string;
  deliverySlot: string;
  deliveryDate: string;
  status: 'PENDING' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  subscriptionId?: string;
}

/**
 * Automated delivery runs creation function
 * Runs every morning at 6 AM to create delivery runs for the day
 */
export const createDeliveryRuns = onSchedule({
  schedule: '0 6 * * *', // 6 AM daily
  timeZone: 'Asia/Kolkata',
  memory: '512Mi',
  timeoutSeconds: 300,
}, async (event) => {
  logger.info('Starting automated delivery runs creation', { timestamp: new Date().toISOString() });

  try {
    const today = startOfDay(new Date());
    const todayStr = today.toISOString();

    // Fetch active delivery partners
    const partnersSnapshot = await adminDb
      .collection('users')
      .where('role', '==', 'delivery')
      .where('isActive', '==', true)
      .get();

    const partners: DeliveryPartner[] = partnersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as any
    }));

    logger.info(`Found ${partners.length} active delivery partners`);

    // Fetch pending orders for today
    const ordersSnapshot = await adminDb
      .collection('orders')
      .where('deliveryDate', '==', todayStr)
      .where('status', '==', 'PENDING')
      .get();

    const pendingOrders: Order[] = ordersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as any
    }));

    logger.info(`Found ${pendingOrders.length} pending orders for today`);

    // Group orders by area and slot
    const ordersByAreaSlot = new Map<string, Order[]>();
    pendingOrders.forEach(order => {
      const key = `${order.area}-${order.deliverySlot}`;
      if (!ordersByAreaSlot.has(key)) {
        ordersByAreaSlot.set(key, []);
      }
      ordersByAreaSlot.get(key)!.push(order);
    });

    // Create delivery runs for each partner
    const deliveryRuns: DeliveryRun[] = [];
    
    for (const partner of partners) {
      for (const area of partner.areas) {
        for (const slot of partner.slots) {
          const key = `${area}-${slot}`;
          const orders = ordersByAreaSlot.get(key) || [];
          
          if (orders.length === 0) continue;

          // Sort orders by priority (HIGH first, then MEDIUM, then LOW)
          const sortedOrders = orders.sort((a, b) => {
            const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          });

          // Take only up to maxOrdersPerSlot
          const assignedOrders = sortedOrders.slice(0, partner.maxOrdersPerSlot);

          if (assignedOrders.length > 0) {
            const deliveryRun: DeliveryRun = {
              id: `delivery-${todayStr}-${partner.id}-${area}-${slot}`,
              deliveryPartnerId: partner.id,
              orders: assignedOrders.map(o => o.id),
              area,
              deliverySlot: slot,
              date: todayStr,
              status: 'PENDING',
              createdAt: new Date(),
              updatedAt: new Date()
            };

            deliveryRuns.push(deliveryRun);

            // Update order status to ASSIGNED
            const batch = adminDb.batch();
            assignedOrders.forEach(order => {
              const orderRef = adminDb.collection('orders').doc(order.id);
              batch.update(orderRef, {
                deliveryPartnerId: partner.id,
                status: 'ASSIGNED',
                updatedAt: FieldValue.serverTimestamp()
              });
            });

            await batch.commit();

            // Create delivery run document
            await adminDb.collection('deliveryRuns').doc(deliveryRun.id).set(deliveryRun);

            // Send notification to delivery partner
            await adminDb.collection('notifications').add({
              userId: partner.id,
              title: 'New Delivery Run Created',
              message: `You have ${assignedOrders.length} orders assigned for ${slot} slot in ${area}`,
              type: 'DELIVERY_ASSIGNED',
              isRead: false,
              createdAt: FieldValue.serverTimestamp()
            });

            logger.info(`Created delivery run for partner ${partner.id}, area ${area}, slot ${slot} with ${assignedOrders.length} orders`);
          }
        }
      }
    }

    logger.info(`Successfully created ${deliveryRuns.length} delivery runs`);
    
    return { success: true, deliveryRunsCount: deliveryRuns.length };
  } catch (error) {
    logger.error('Error creating delivery runs:', error);
    throw error;
  }
});

/**
 * Optimize delivery routes for assigned orders
 * Uses simple distance-based optimization
 */
export const optimizeDeliveryRoutes = onSchedule({
  schedule: '30 6 * * *', // 6:30 AM daily
  timeZone: 'Asia/Kolkata',
  memory: '512Mi',
  timeoutSeconds: 300,
}, async (event) => {
  logger.info('Starting delivery route optimization', { timestamp: new Date().toISOString() });

  try {
    const today = startOfDay(new Date());
    const todayStr = today.toISOString();

    // Fetch pending delivery runs for today
    const deliveryRunsSnapshot = await adminDb
      .collection('deliveryRuns')
      .where('date', '==', todayStr)
      .where('status', '==', 'PENDING')
      .get();

    for (const doc of deliveryRunsSnapshot.docs) {
      const deliveryRun = doc.data() as DeliveryRun;
      
      // Fetch order details
      const ordersSnapshot = await adminDb
        .collection('orders')
        .where('__name__', 'in', deliveryRun.orders)
        .get();

      const orders = ordersSnapshot.docs.map(orderDoc => ({
        id: orderDoc.id,
        ...orderDoc.data()
      }));

      // Simple optimization: sort by area and then by customer location
      // In a real implementation, you'd use a proper routing algorithm
      const optimizedOrders = orders.sort((a, b) => {
        // Sort by area first
        if (a.area !== b.area) return a.area.localeCompare(b.area);
        // Then by customer address (simplified)
        return (a.address || '').localeCompare(b.address || '');
      });

      // Update delivery run with optimized order
      await doc.ref.update({
        optimizedOrders: optimizedOrders.map(o => o.id),
        updatedAt: FieldValue.serverTimestamp()
      });

      logger.info(`Optimized delivery run ${deliveryRun.id} with ${optimizedOrders.length} orders`);
    }

    logger.info('Delivery route optimization completed');
    return { success: true };
  } catch (error) {
    logger.error('Error optimizing delivery routes:', error);
    throw error;
  }
});

/**
 * Monitor delivery runs and send reminders
 */
export const monitorDeliveryRuns = onSchedule({
  schedule: '0 9,12,15 * * *', // 9 AM, 12 PM, 3 PM daily
  timeZone: 'Asia/Kolkata',
  memory: '256Mi',
  timeoutSeconds: 180,
}, async (event) => {
  logger.info('Starting delivery run monitoring', { timestamp: new Date().toISOString() });

  try {
    const now = new Date();
    const today = startOfDay(now);
    const todayStr = today.toISOString();

    // Fetch active delivery runs
    const deliveryRunsSnapshot = await adminDb
      .collection('deliveryRuns')
      .where('date', '==', todayStr)
      .where('status', 'in', ['PENDING', 'IN_PROGRESS'])
      .get();

    for (const doc of deliveryRunsSnapshot.docs) {
      const deliveryRun = doc.data() as DeliveryRun;
      
      // Check if delivery slot is approaching or has passed
      const slotTime = getSlotTime(deliveryRun.deliverySlot);
      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      if (currentTime >= slotTime - 30 && deliveryRun.status === 'PENDING') {
        // Send reminder to delivery partner
        await adminDb.collection('notifications').add({
          userId: deliveryRun.deliveryPartnerId,
          title: 'Delivery Reminder',
          message: `Your ${deliveryRun.deliverySlot} delivery slot in ${deliveryRun.area} is starting soon. You have ${deliveryRun.orders.length} orders to deliver.`,
          type: 'DELIVERY_REMINDER',
          isRead: false,
          createdAt: FieldValue.serverTimestamp()
        });
      }
    }

    logger.info('Delivery run monitoring completed');
    return { success: true };
  } catch (error) {
    logger.error('Error monitoring delivery runs:', error);
    throw error;
  }
});

/**
 * Helper function to get slot time in minutes
 */
function getSlotTime(slot: string): number {
  switch (slot) {
    case 'morning':
      return 9 * 60; // 9:00 AM
    case 'afternoon':
      return 14 * 60; // 2:00 PM
    case 'evening':
      return 18 * 60; // 6:00 PM
    default:
      return 12 * 60; // 12:00 PM
  }
}