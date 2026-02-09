// Basic keyword mapping for auto-categorization
export const PRODUCT_KEYWORDS: Record<string, { category: string; unit: string }> = {
    // Vegetables
    'tomato': { category: 'Vegetables', unit: 'Kg' },
    'potato': { category: 'Vegetables', unit: 'Kg' },
    'onion': { category: 'Vegetables', unit: 'Kg' },
    'carrot': { category: 'Vegetables', unit: 'Kg' },
    'beans': { category: 'Vegetables', unit: 'Kg' },
    'brinjal': { category: 'Vegetables', unit: 'Kg' },
    'chilli': { category: 'Vegetables', unit: 'Kg' },
    'capsicum': { category: 'Vegetables', unit: 'Kg' },
    'cabbage': { category: 'Vegetables', unit: 'Kg' },
    'cauliflower': { category: 'Vegetables', unit: 'Kg' },
    'ladies finger': { category: 'Vegetables', unit: 'Kg' },
    'drumstick': { category: 'Vegetables', unit: 'Kg' },
    'bottle gourd': { category: 'Vegetables', unit: 'Kg' },
    'bitter gourd': { category: 'Vegetables', unit: 'Kg' },
    'snake gourd': { category: 'Vegetables', unit: 'Kg' },
    'cucumber': { category: 'Vegetables', unit: 'Kg' },
    'beetroot': { category: 'Vegetables', unit: 'Kg' },
    'radish': { category: 'Vegetables', unit: 'Kg' },
    'pumpkin': { category: 'Vegetables', unit: 'Kg' },

    // Leafy Veg
    'spinach': { category: 'Leafy Veg', unit: 'Pcs' },
    'palak': { category: 'Leafy Veg', unit: 'Pcs' },
    'coriander': { category: 'Leafy Veg', unit: 'Pcs' },
    'curry leaves': { category: 'Leafy Veg', unit: 'Pcs' },
    'mint': { category: 'Leafy Veg', unit: 'Pcs' },
    'methi': { category: 'Leafy Veg', unit: 'Pcs' },
    'amaranth': { category: 'Leafy Veg', unit: 'Pcs' },
    'gongura': { category: 'Leafy Veg', unit: 'Pcs' },

    // Fruits
    'apple': { category: 'Fruits', unit: 'Kg' },
    'banana': { category: 'Fruits', unit: 'Kg' },
    'orange': { category: 'Fruits', unit: 'Kg' },
    'mango': { category: 'Fruits', unit: 'Kg' },
    'grapes': { category: 'Fruits', unit: 'Kg' },
    'papaya': { category: 'Fruits', unit: 'Kg' },
    'pomegranate': { category: 'Fruits', unit: 'Kg' },
    'watermelon': { category: 'Fruits', unit: 'Pcs' },
    'guava': { category: 'Fruits', unit: 'Kg' },

    // Dairy
    'milk': { category: 'Dairy', unit: 'Pkts' },
    'curd': { category: 'Dairy', unit: 'Pkts' },
    'paneer': { category: 'Dairy', unit: 'Pkts' },
    'butter': { category: 'Dairy', unit: 'Pkts' },
    'cheese': { category: 'Dairy', unit: 'Pkts' },
    'ghee': { category: 'Dairy', unit: 'Ltr' },

    // Cool Drinks
    'thumbs up': { category: 'Cool Drinks', unit: 'Pcs' },
    'sprite': { category: 'Cool Drinks', unit: 'Pcs' },
    'coke': { category: 'Cool Drinks', unit: 'Pcs' },
    'pepsi': { category: 'Cool Drinks', unit: 'Pcs' },
    'fanta': { category: 'Cool Drinks', unit: 'Pcs' },
    'maaza': { category: 'Cool Drinks', unit: 'Pcs' },

    // Water
    'water': { category: 'Water', unit: 'Pcs' },
    'bisleri': { category: 'Water', unit: 'Pcs' },
    'kinley': { category: 'Water', unit: 'Pcs' },

    // Meat & Eggs
    'chicken': { category: 'Meat', unit: 'Kg' },
    'mutton': { category: 'Meat', unit: 'Kg' },
    'fish': { category: 'Meat', unit: 'Kg' },
    'prawns': { category: 'Meat', unit: 'Kg' },
    'egg': { category: 'Eggs', unit: 'Pcs' },
    'eggs': { category: 'Eggs', unit: 'Pcs' }
};

export function detectCategoryAndUnit(productName: string) {
    if (!productName) return null;
    const lowerName = productName.toLowerCase();

    // Exact or partial match check
    for (const [key, value] of Object.entries(PRODUCT_KEYWORDS)) {
        if (lowerName.includes(key)) {
            return value;
        }
    }
    return null;
}
