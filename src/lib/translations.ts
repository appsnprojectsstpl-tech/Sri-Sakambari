
import type { Product } from './types';

export type Language = 'en' | 'te';

type Translations = {
    [key: string]: {
        [lang in Language]: string;
    };
};

const translations: Translations = {
    logout: { en: 'Logout', te: 'లాగ్అవుట్' },
    login: { en: 'Login', te: 'ప్రవేశించండి' },
    notifications: { en: 'Notifications', te: 'ప్రకటనలు' },
    noNotifications: { en: 'No new notifications', te: 'కొత్త ప్రకటనలు లేవు' },
    adminDashboard: { en: 'Admin Dashboard', te: 'అడ్మిన్ డాష్‌బోర్డ్' },
    products: { en: 'Products', te: 'ఉత్పత్తులు' },
    orders: { en: 'Orders', te: 'ఆర్డర్లు' },
    subscriptions: { en: 'Subscriptions', te: 'చందాలు' },
    users: { en: 'Users', te: 'వినియోగదారులు' },
    addNewProduct: { en: 'Add New Product', te: 'కొత్త ఉత్పత్తిని జోడించండి' },
    Vegetables: { en: 'Vegetables', te: 'కూరగాయలు' },
    Fruits: { en: 'Fruits', te: 'పండ్లు' },
    Dairy: { en: 'Dairy', te: 'పాల ఉత్పత్తులు' },
    Subscription: { en: 'Subscription', te: 'చందా' },
    yourCart: { en: 'Your Cart', te: 'మీ కార్ట్' },
    cartEmpty: { en: 'Your cart is empty', te: 'మీ కార్ట్ ఖాళీగా ఉంది' },
    cartEmptyHint: { en: 'Add some fresh products to get started!', te: 'ప్రారంభించడానికి కొన్ని తాజా ఉత్పత్తులను జోడించండి!' },
    total: { en: 'Total', te: 'మొత్తం' },
    proceedToCheckout: { en: 'Proceed to Checkout', te: 'చెక్అవుట్‌కు వెళ్లండి' },
    checkout: { en: 'Checkout', te: 'చెక్అవుట్' },
    address: { en: 'Address', te: 'చిరునామా' },
    area: { en: 'Area', te: 'ప్రాంతం' },
    deliverySlot: { en: 'Delivery Slot', te: 'డెలివరీ స్లాట్' },
    cancel: { en: 'Cancel', te: 'రద్దు చేయండి' },
    placeOrderCOD: { en: 'Place Order (COD)', te: 'ఆర్డర్ చేయండి (COD)' },
    orderSuccessful: { en: 'Order Successful', te: 'ఆర్డర్ విజయవంతమైంది' },
    orderPlacedMessage: { en: 'Your order has been placed.', te: 'మీ ఆర్డర్ చేయబడింది.' },
    shareOnWhatsApp: { en: 'Share your order on WhatsApp!', te: 'మీ ఆర్డర్‌ను వాట్సాప్‌లో షేర్ చేయండి!' },
    whatsAppMessage: { en: 'Hey! I just ordered fresh vegetables from Sree Sakambari Devi eVeggie Market. You should check them out!', te: 'హే! నేను శ్రీ శాకాంబరి దేవి ఈ-వెజ్జీ మార్కెట్ నుండి తాజా కూరగాయలను ఆర్డర్ చేసాను. మీరు కూడా చూడండి!' },
    whatsappOrderConfirmation: { en: 'Thank you for your order from Sree Sakambari Devi eVeggie Market! Your order number is {ORDER_ID}.', te: 'శ్రీ శాకాంబరి దేవి ఈ-వెజ్జీ మార్కెట్ నుండి ఆర్డర్ చేసినందుకు ధన్యవాదాలు! మీ ఆర్డర్ నంబర్ {ORDER_ID}.' },
    continueShopping: { en: 'Continue Shopping', te: 'షాపింగ్ కొనసాగించండి' },
    addToCart: { en: 'Add to Cart', te: 'కార్ట్‌కు జోడించండి' },
    myDeliveries: { en: 'My Deliveries', te: 'నా డెలివరీలు' },
    inProgress: { en: 'In Progress', te: 'ప్రోగ్రెస్‌లో ఉంది' },
    completed: { en: 'Completed', te: 'పూర్తయింది' },
    contact: { en: 'Contact', te: 'సంప్రదించండి' },
    items: { en: 'Items', te: 'వస్తువులు' },
    startDelivery: { en: 'Start Delivery', te: 'డెలివరీ ప్రారంభించండి' },
    markAsDelivered: { en: 'Mark as Delivered', te: 'డెలివరీ అయినట్లు గుర్తించండి' },
    noDeliveriesInProgress: { en: 'No deliveries in progress.', te: 'ప్రోగ్రెస్‌లో డెలివరీలు లేవు.' },
    checkBackLater: { en: 'Check back later for new assignments.', te: 'కొత్త అసైన్‌మెంట్‌ల కోసం తర్వాత మళ్ళీ చూడండి.' },
    noCompletedDeliveries: { en: 'No completed deliveries yet.', te: 'ఇంకా పూర్తి అయిన డెలివరీలు లేవు.' },
    vegetableMarket: { en: 'Vegetable Market', te: 'కూరగాయల మార్కెట్' },
    directFromFarms: { en: 'DIRECT FROM FARMS', te: 'పొలాల నుండి నేరుగా' },
    shopFreshAndGreen: { en: 'Shop Fresh & Green', te: 'తాజాగా మరియు పచ్చగా షాపింగ్ చేయండి' },
    sweetAndJuicy: { en: 'Sweet & Juicy', te: 'తీయగా మరియు రసభరితంగా' },
    availableServices: { en: 'Available Services', te: 'అందుబాటులో ఉన్న సేవలు' },
    clickToRequestService: { en: 'Click a service to request it on WhatsApp.', te: 'వాట్సాప్‌లో సేవను అభ్యర్థించడానికి క్లిక్ చేయండి.' },
    orderOnWhatsApp: { en: 'Order on WhatsApp', te: 'వాట్సాప్‌లో ఆర్డర్ చేయండి' },
    Nurse: { en: 'Nurse', te: 'నర్సు' },
    Electrician: { en: 'Electrician', te: 'ఎలక్ట్రీషియన్' },
    Plumber: { en: 'Plumber', te: 'ప్లంబర్' },
    'House Cleaning': { en: 'House Cleaning', te: 'ఇంటి శుభ్రపరచడం' },
    Drivers: { en: 'Drivers', te: 'డ్రైవర్లు' },
    Catering: { en: 'Catering', te: 'క్యాటరింగ్' },
    cutVegAndDoorDelivery: { en: 'Cut Vegetables and Door Delivery Available', te: 'కట్ కూరగాయలు మరియు డోర్ డెలివరీ అందుబాటులో ఉంది' },
    conditionsApply: { en: '*Conditions Apply', te: '*షరతులు వర్తిస్తాయి' },
    uploadImage: { en: 'Upload Image', te: 'చిత్రాన్ని అప్‌లోడ్ చేయండి' },
    uploading: { en: 'Uploading...', te: 'అప్‌లోడ్ అవుతోంది...' },
    imageUploaded: { en: 'Image Uploaded', te: 'చిత్రం అప్‌లోడ్ చేయబడింది' },
};

export function t(key: string, lang: Language): string {
    return translations[key]?.[lang] || key;
}

export function getProductName(product: Product, lang: Language): string {
    if (lang === 'te' && product.name_te) {
        return product.name_te;
    }
    return product.name;
}
