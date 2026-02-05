import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { adminDb } from '../config/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { https } from 'firebase-functions/v2';
import * as twilio from 'twilio';

// WhatsApp Business API Configuration
const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0/YOUR_PHONE_NUMBER_ID/messages';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

// Twilio SMS Configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

interface NotificationMessage {
  to: string;
  message: string;
  type: 'WHATSAPP' | 'SMS';
  template?: string;
  variables?: Record<string, string>;
}

interface User {
  id: string;
  phoneNumber: string;
  whatsappNumber?: string;
  notificationPreferences: {
    whatsapp: boolean;
    sms: boolean;
    email: boolean;
  };
  language: 'en' | 'hi' | 'te';
}

interface Order {
  id: string;
  customerId: string;
  status: 'PENDING' | 'CONFIRMED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  totalAmount: number;
  deliveryDate: string;
  deliverySlot: string;
  items: Array<{
    productName: string;
    quantity: number;
    price: number;
  }>;
}

interface Subscription {
  id: string;
  customerId: string;
  isActive: boolean;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  nextDeliveryDate: string;
  totalAmount: number;
}

// Message templates for different notification types
const MESSAGE_TEMPLATES = {
  en: {
    ORDER_CONFIRMED: {
      whatsapp: "🛒 *Order Confirmed*\n\nHello {name}!\n\nYour order #{orderId} has been confirmed.\n\n📦 Total: ₹{totalAmount}\n📅 Delivery: {deliveryDate} ({deliverySlot})\n\nThank you for choosing Sakambari!",
      sms: "Order #{orderId} confirmed! Total: ₹{totalAmount}. Delivery on {deliveryDate} ({deliverySlot}). Thank you for choosing Sakambari!"
    },
    ORDER_OUT_FOR_DELIVERY: {
      whatsapp: "🚚 *Out for Delivery*\n\nHello {name}!\n\nYour order #{orderId} is out for delivery.\n\n📍 Our delivery partner will reach you soon\n⏰ Expected delivery: {deliverySlot}\n\nPlease keep your phone available!",
      sms: "Order #{orderId} is out for delivery! Expected delivery: {deliverySlot}. Please keep your phone available."
    },
    ORDER_DELIVERED: {
      whatsapp: "✅ *Order Delivered*\n\nHello {name}!\n\nYour order #{orderId} has been delivered successfully.\n\n📦 We hope you enjoy your fresh produce!\n⭐ Rate your experience: {feedbackLink}\n\nThank you for choosing Sakambari!",
      sms: "Order #{orderId} delivered successfully! Enjoy your fresh produce. Rate us: {feedbackLink}"
    },
    SUBSCRIPTION_REMINDER: {
      whatsapp: "📅 *Subscription Reminder*\n\nHello {name}!\n\nYour subscription is scheduled for delivery on {deliveryDate}.\n\n🔄 Frequency: {frequency}\n💰 Total: ₹{totalAmount}\n\nReply with 'CONFIRM' to confirm or 'SKIP' to skip this delivery.",
      sms: "Subscription reminder: Delivery scheduled for {deliveryDate}. Reply CONFIRM to confirm or SKIP to skip."
    },
    STOCK_ALERT: {
      whatsapp: "📢 *Stock Alert*\n\nHello {name}!\n\n{itemName} is now available in stock!\n\n💰 Price: ₹{price}\n📦 Available quantity: {stock}\n\nOrder now before it runs out!",
      sms: "{itemName} is back in stock! Price: ₹{price}. Order now before it runs out!"
    }
  },
  hi: {
    ORDER_CONFIRMED: {
      whatsapp: "🛒 *ऑर्डर पुष्टि*\n\nनमस्ते {name}!\n\nआपका ऑर्डर #{orderId} पुष्टि हो गया है।\n\n📦 कुल: ₹{totalAmount}\n📅 डिलीवरी: {deliveryDate} ({deliverySlot})\n\nसकाम्बरी को चुनने के लिए धन्यवाद!",
      sms: "ऑर्डर #{orderId} पुष्टि हुई! कुल: ₹{totalAmount}. डिलीवरी {deliveryDate} ({deliverySlot}) को। धन्यवाद!"
    },
    ORDER_OUT_FOR_DELIVERY: {
      whatsapp: "🚚 *डिलीवरी के लिए निकला*\n\nनमस्ते {name}!\n\nआपका ऑर्डर #{orderId} डिलीवरी के लिए निकल गया है।\n\n📍 हमारा डिलीवरी पार्टनर जल्द ही आप तक पहुंचेगा\n⏰ अनुमानित डिलीवरी: {deliverySlot}\n\nकृपया अपना फोन उपलब्ध रखें!",
      sms: "ऑर्डर #{orderId} डिलीवरी के लिए निकल गया! अनुमानित डिलीवरी: {deliverySlot}। कृपया फोन उपलब्ध रखें।"
    },
    ORDER_DELIVERED: {
      whatsapp: "✅ *ऑर्डर डिलीवर हुआ*\n\nनमस्ते {name}!\n\nआपका ऑर्डर #{orderId} सफलतापूर्वक डिलीवर हो गया है।\n\n📦 हमें उम्मीद है कि आपको ताजा उत्पाद पसंद आएंगे!\n⭐ अपना अनुभव रेट करें: {feedbackLink}\n\nसकाम्बरी को चुनने के लिए धन्यवाद!",
      sms: "ऑर्डर #{orderId} सफलतापूर्वक डिलीवर हुआ! ताजा उत्पाद का आनंद लें। रेट करें: {feedbackLink}"
    },
    SUBSCRIPTION_REMINDER: {
      whatsapp: "📅 *सब्सक्रिप्शन अनुस्मारक*\n\nनमस्ते {name}!\n\nआपकी सब्सक्रिप्शन {deliveryDate} को डिलीवरी के लिए निर्धारित है।\n\n🔄 आवृत्ति: {frequency}\n💰 कुल: ₹{totalAmount}\n\nइस डिलीवरी की पुष्टि के लिए 'CONFIRM' जवाब दें या 'SKIP' छोड़ने के लिए।",
      sms: "सब्सक्रिप्शन अनुस्मारक: डिलीवरी {deliveryDate} को निर्धारित है। पुष्टि के लिए CONFIRM या छोड़ने के लिए SKIP जवाब दें।"
    },
    STOCK_ALERT: {
      whatsapp: "📢 *स्टॉक अलर्ट*\n\nनमस्ते {name}!\n\n{itemName} अब स्टॉक में उपलब्ध है!\n\n💰 कीमत: ₹{price}\n📦 उपलब्ध मात्रा: {stock}\n\nस्टॉक खत्म होने से पहले अभी ऑर्डर करें!",
      sms: "{itemName} स्टॉक में वापस आ गया है! कीमत: ₹{price}. स्टॉक खत्म होने से पहले अभी ऑर्डर करें!"
    }
  },
  te: {
    ORDER_CONFIRMED: {
      whatsapp: "🛒 *ఆర్డర్ నిర్ధారణ*\n\nనమస్తే {name}!\n\nమీ ఆర్డర్ #{orderId} నిర్ధారించబడింది.\n\n📦 మొత్తం: ₹{totalAmount}\n📅 డెలివరీ: {deliveryDate} ({deliverySlot})\n\nసకాంబరిని ఎంచుకున్నందుకు ధన్యవాదాలు!",
      sms: "ఆర్డర్ #{orderId} నిర్ధారించబడింది! మొత్తం: ₹{totalAmount}. డెలివరీ {deliveryDate} ({deliverySlot}). ధన్యవాదాలు!"
    },
    ORDER_OUT_FOR_DELIVERY: {
      whatsapp: "🚚 *డెలివరీ కోసం బయలుదేరింది*\n\nనమస్తే {name}!\n\nమీ ఆర్డర్ #{orderId} డెలివరీ కోసం బయలుదేరింది.\n\n📍 మా డెలివరీ భాగస్వామి త్వరలో మీ వద్దకు వస్తారు\n⏰ అంచనా డెలివరీ: {deliverySlot}\n\nదయచేసి మీ ఫోన్ అందుబాటులో ఉంచండి!",
      sms: "ఆర్డర్ #{orderId} డెలివరీ కోసం బయలుదేరింది! అంచనా డెలివరీ: {deliverySlot}. దయచేసి ఫోన్ అందుబాటులో ఉంచండి."
    },
    ORDER_DELIVERED: {
      whatsapp: "✅ *ఆర్డర్ డెలివరీ అయింది*\n\nనమస్తే {name}!\n\nమీ ఆర్డర్ #{orderId} విజయవంతంగా డెలివరీ అయింది.\n\n📦 తాజా ఉత్పత్తిని ఆస్వాదించండి!\n⭐ మీ అనుభవాన్ని రేట్ చేయండి: {feedbackLink}\n\nసకాంబరిని ఎంచుకున్నందుకు ధన్యవాదాలు!",
      sms: "ఆర్డర్ #{orderId} విజయవంతంగా డెలివరీ అయింది! తాజా ఉత్పత్తిని ఆస్వాదించండి. రేట్ చేయండి: {feedbackLink}"
    },
    SUBSCRIPTION_REMINDER: {
      whatsapp: "📅 *సబ్స్క్రిప్షన్ రిమైండర్*\n\nనమస్తే {name}!\n\nమీ సబ్స్క్రిప్షన్ {deliveryDate} న డెలివరీ కోసం షెడ్యూల్ చేయబడింది.\n\n🔄 పౌనఃపున్యం: {frequency}\n💰 మొత్తం: ₹{totalAmount}\n\nఈ డెలివరీని నిర్ధారించడానికి 'CONFIRM' అని స్పందించండి లేదా 'SKIP' అని వదిలేయండి.",
      sms: "సబ్స్క్రిప్షన్ రిమైండర్: డెలివరీ {deliveryDate} న షెడ్యూల్ చేయబడింది. నిర్ధారించడానికి CONFIRM లేదా వదిలేయడానికి SKIP స్పందించండి."
    },
    STOCK_ALERT: {
      whatsapp: "📢 *స్టాక్ అలర్ట్*\n\nనమస్తే {name}!\n\n{itemName} ఇప్పుడు స్టాక్లో అందుబాటులో ఉంది!\n\n💰 ధర: ₹{price}\n📦 అందుబాటులో ఉన్న మొత్తం: {stock}\n\nస్టాక్ అయిపోక ముందు ఇప్పుడే ఆర్డర్ చేయండి!",
      sms: "{itemName} స్టాక్లోకి తిరిగి వచ్చింది! ధర: ₹{price}. స్టాక్ అయిపోక ముందు ఇప్పుడే ఆర్డర్ చేయండి!"
    }
  }
};

/**
 * Send WhatsApp message using WhatsApp Business API
 */
async function sendWhatsAppMessage(message: NotificationMessage): Promise<void> {
  if (!WHATSAPP_ACCESS_TOKEN) {
    logger.warn('WhatsApp access token not configured');
    return;
  }

  try {
    const response = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: message.to,
        type: 'text',
        text: {
          body: message.message
        }
      })
    });

    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${response.status}`);
    }

    logger.info(`WhatsApp message sent to ${message.to}`);
  } catch (error) {
    logger.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

/**
 * Send SMS message using Twilio
 */
async function sendSMSMessage(message: NotificationMessage): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    logger.warn('Twilio credentials not configured');
    return;
  }

  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    
    await client.messages.create({
      body: message.message,
      from: TWILIO_PHONE_NUMBER,
      to: message.to
    });

    logger.info(`SMS message sent to ${message.to}`);
  } catch (error) {
    logger.error('Error sending SMS message:', error);
    throw error;
  }
}

/**
 * Get message template for notification type and language
 */
function getMessageTemplate(
  type: keyof typeof MESSAGE_TEMPLATES.en,
  language: keyof typeof MESSAGE_TEMPLATES,
  channel: 'whatsapp' | 'sms'
): string {
  return MESSAGE_TEMPLATES[language][type][channel];
}

/**
 * Replace template variables in message
 */
function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  let message = template;
  Object.entries(variables).forEach(([key, value]) => {
    message = message.replace(new RegExp(`{${key}}`, 'g'), value);
  });
  return message;
}

/**
 * Send notification based on user preferences
 */
async function sendNotification(
  userId: string,
  notificationType: keyof typeof MESSAGE_TEMPLATES.en,
  variables: Record<string, string>
): Promise<void> {
  try {
    // Get user details
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      logger.warn(`User ${userId} not found`);
      return;
    }

    const user = userDoc.data() as User;
    const language = user.language || 'en';

    // Get message template
    const whatsappTemplate = getMessageTemplate(notificationType, language, 'whatsapp');
    const smsTemplate = getMessageTemplate(notificationType, language, 'sms');

    // Send WhatsApp message if enabled
    if (user.notificationPreferences.whatsapp && user.whatsappNumber) {
      const message = replaceTemplateVariables(whatsappTemplate, variables);
      await sendWhatsAppMessage({
        to: user.whatsappNumber,
        message,
        type: 'WHATSAPP'
      });
    }

    // Send SMS if enabled
    if (user.notificationPreferences.sms && user.phoneNumber) {
      const message = replaceTemplateVariables(smsTemplate, variables);
      await sendSMSMessage({
        to: user.phoneNumber,
        message,
        type: 'SMS'
      });
    }

    // Log notification
    await adminDb.collection('notificationLogs').add({
      userId,
      type: notificationType,
      channel: user.notificationPreferences.whatsapp && user.whatsappNumber ? 'WHATSAPP' : 
              user.notificationPreferences.sms && user.phoneNumber ? 'SMS' : 'NONE',
      status: 'SENT',
      createdAt: FieldValue.serverTimestamp()
    });

  } catch (error) {
    logger.error(`Error sending notification to user ${userId}:`, error);
    
    // Log failed notification
    await adminDb.collection('notificationLogs').add({
      userId,
      type: notificationType,
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Unknown error',
      createdAt: FieldValue.serverTimestamp()
    });
  }
}

/**
 * Trigger notification when order status changes
 */
export const onOrderStatusChange = onDocumentUpdated('orders/{orderId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  if (!before || !after) return;

  const order = after as Order;
  const previousStatus = before.status;
  const currentStatus = after.status;

  // Only send notifications for specific status changes
  if (previousStatus === currentStatus) return;

  try {
    switch (currentStatus) {
      case 'CONFIRMED':
        await sendNotification(order.customerId, 'ORDER_CONFIRMED', {
          name: order.customerName || 'Customer',
          orderId: event.params.orderId,
          totalAmount: order.totalAmount.toString(),
          deliveryDate: new Date(order.deliveryDate).toLocaleDateString(),
          deliverySlot: order.deliverySlot
        });
        break;

      case 'OUT_FOR_DELIVERY':
        await sendNotification(order.customerId, 'ORDER_OUT_FOR_DELIVERY', {
          name: order.customerName || 'Customer',
          orderId: event.params.orderId,
          deliverySlot: order.deliverySlot
        });
        break;

      case 'DELIVERED':
        await sendNotification(order.customerId, 'ORDER_DELIVERED', {
          name: order.customerName || 'Customer',
          orderId: event.params.orderId,
          feedbackLink: `https://sakambari.com/feedback/${event.params.orderId}`
        });
        break;
    }
  } catch (error) {
    logger.error('Error sending order status notification:', error);
  }
});

/**
 * Send subscription reminder notifications
 */
export const sendSubscriptionReminder = https.onCall(async (request) => {
  const { subscriptionId } = request.data;

  try {
    const subscriptionDoc = await adminDb.collection('subscriptions').doc(subscriptionId).get();
    if (!subscriptionDoc.exists) {
      throw new Error('Subscription not found');
    }

    const subscription = subscriptionDoc.data() as Subscription;
    
    await sendNotification(subscription.customerId, 'SUBSCRIPTION_REMINDER', {
      name: subscription.customerName || 'Customer',
      deliveryDate: new Date(subscription.nextDeliveryDate).toLocaleDateString(),
      frequency: subscription.frequency,
      totalAmount: subscription.totalAmount.toString()
    });

    return { success: true };
  } catch (error) {
    logger.error('Error sending subscription reminder:', error);
    throw new https.HttpsError('internal', 'Failed to send subscription reminder');
  }
});

/**
 * Send stock alert notifications
 */
export const sendStockAlert = https.onCall(async (request) => {
  const { productId, userIds } = request.data;

  try {
    const productDoc = await adminDb.collection('products').doc(productId).get();
    if (!productDoc.exists) {
      throw new Error('Product not found');
    }

    const product = productDoc.data();
    
    for (const userId of userIds) {
      await sendNotification(userId, 'STOCK_ALERT', {
        itemName: product.name,
        price: product.price.toString(),
        stock: product.stock.toString()
      });
    }

    return { success: true, usersNotified: userIds.length };
  } catch (error) {
    logger.error('Error sending stock alert:', error);
    throw new https.HttpsError('internal', 'Failed to send stock alert');
  }
});

/**
 * Handle incoming WhatsApp messages (for subscription confirmations)
 */
export const handleWhatsAppWebhook = https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  try {
    const { entry } = req.body;
    
    if (!entry || !entry[0]?.changes?.[0]?.value?.messages) {
      res.status(200).send('OK');
      return;
    }

    const message = entry[0].changes[0].value.messages[0];
    const from = message.from;
    const text = message.text?.body?.toLowerCase().trim();

    if (text === 'confirm') {
      // Handle subscription confirmation
      await handleSubscriptionConfirmation(from, 'confirmed');
    } else if (text === 'skip') {
      // Handle subscription skip
      await handleSubscriptionConfirmation(from, 'skipped');
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error handling WhatsApp webhook:', error);
    res.status(500).send('Internal server error');
  }
});

/**
 * Handle subscription confirmation/skip from WhatsApp
 */
async function handleSubscriptionConfirmation(phoneNumber: string, action: 'confirmed' | 'skipped'): Promise<void> {
  try {
    // Find user by phone number
    const usersSnapshot = await adminDb
      .collection('users')
      .where('whatsappNumber', '==', phoneNumber)
      .get();

    if (usersSnapshot.empty) {
      logger.warn(`No user found with WhatsApp number ${phoneNumber}`);
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;

    // Find active subscription for the user
    const subscriptionsSnapshot = await adminDb
      .collection('subscriptions')
      .where('customerId', '==', userId)
      .where('isActive', '==', true)
      .orderBy('nextDeliveryDate', 'desc')
      .limit(1)
      .get();

    if (subscriptionsSnapshot.empty) {
      logger.warn(`No active subscription found for user ${userId}`);
      return;
    }

    const subscriptionDoc = subscriptionsSnapshot.docs[0];
    
    if (action === 'confirmed') {
      // Mark subscription as confirmed
      await subscriptionDoc.ref.update({
        isConfirmed: true,
        confirmationDate: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      // Send confirmation response
      await sendWhatsAppMessage({
        to: phoneNumber,
        message: "✅ Your subscription delivery has been confirmed! We'll deliver as scheduled.",
        type: 'WHATSAPP'
      });
    } else {
      // Skip this delivery
      await subscriptionDoc.ref.update({
        isSkipped: true,
        skipDate: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      // Update next delivery date
      const subscription = subscriptionDoc.data() as Subscription;
      const currentDate = new Date(subscription.nextDeliveryDate);
      let nextDeliveryDate = new Date(currentDate);
      
      switch (subscription.frequency) {
        case 'weekly':
          nextDeliveryDate.setDate(currentDate.getDate() + 7);
          break;
        case 'biweekly':
          nextDeliveryDate.setDate(currentDate.getDate() + 14);
          break;
        case 'monthly':
          nextDeliveryDate.setMonth(currentDate.getMonth() + 1);
          break;
      }

      await subscriptionDoc.ref.update({
        nextDeliveryDate: nextDeliveryDate.toISOString(),
        isSkipped: false
      });

      // Send skip response
      await sendWhatsAppMessage({
        to: phoneNumber,
        message: "⏭️ This delivery has been skipped. Your next delivery will be scheduled for the next cycle.",
        type: 'WHATSAPP'
      });
    }

  } catch (error) {
    logger.error('Error handling subscription confirmation:', error);
  }
}