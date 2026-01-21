
import type { Product, Area } from './types';

// Helper function to generate a unique but consistent ID from the product name
const generateId = (name: string): string => {
    return `prod_${name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
}

const rawProducts: Omit<Product, 'id' | 'imageUrl' | 'imageHint' | 'displayOrder' | 'createdAt' | 'isCutVegetable' | 'cutCharge' | 'isActive' | 'subCategory'>[] = [
    // Vegetables
    { name: 'Sweet Corn', name_te: 'స్వీట్ కార్న్', category: 'Vegetables', pricePerUnit: 25, unit: 'pcs' },
    { name: 'Baby Corn', name_te: 'బేబీ కార్న్', category: 'Vegetables', pricePerUnit: 20, unit: '200 grm' },
    { name: 'Mushrooms', name_te: 'పుట్టగొడుగులు', category: 'Vegetables', pricePerUnit: 40, unit: 'packet' },
    { name: 'Green Peas', name_te: 'పచ్చి బఠానీలు', category: 'Vegetables', pricePerUnit: 80, unit: 'kg' },
    { name: 'Broccoli', name_te: 'బ్రోకలీ', category: 'Vegetables', pricePerUnit: 60, unit: 'pcs' },
    { name: 'Capsicum', name_te: 'క్యాప్సికమ్', category: 'Vegetables', pricePerUnit: 70, unit: 'kg' },
    { name: 'Panasa Pottu (Jackfruit pieces)', name_te: 'పనస పొట్టు', category: 'Vegetables', pricePerUnit: 50, unit: '250g' },
    { name: 'Red Cabbage', name_te: 'ఎర్ర క్యాబేజీ', category: 'Vegetables', pricePerUnit: 45, unit: 'pcs' },
    { name: 'Tomato', name_te: 'టమాటా', category: 'Vegetables', pricePerUnit: 40, unit: 'kg' },
    { name: 'Onion', name_te: 'ఉల్లిపాయ', category: 'Vegetables', pricePerUnit: 35, unit: 'kg' },
    { name: 'Potato', name_te: 'బంగాళదుంప', category: 'Vegetables', pricePerUnit: 30, unit: 'kg' },
    { name: 'Brinjal (Vankaya)', name_te: 'వంకాయ', category: 'Vegetables', pricePerUnit: 40, unit: 'kg' },
    { name: 'Ladies Finger (Bendakaya)', name_te: 'బెండకాయ', category: 'Vegetables', pricePerUnit: 50, unit: 'kg' },
    { name: 'Bottle Gourd (Sorakaya)', name_te: 'సొరకాయ', category: 'Vegetables', pricePerUnit: 30, unit: 'kg' },
    { name: 'Ridge Gourd (Beerakaya)', name_te: 'బీరకాయ', category: 'Vegetables', pricePerUnit: 45, unit: 'kg' },
    { name: 'Snake Gourd (Potlakaya)', name_te: 'పొట్లకాయ', category: 'Vegetables', pricePerUnit: 40, unit: 'kg' },
    { name: 'Drumstick (Munagakaya)', name_te: 'మునగకాయ', category: 'Vegetables', pricePerUnit: 15, unit: 'pcs' },
    { name: 'Cluster Beans (Goruchikkudu)', name_te: 'గోరుచిక్కుడు', category: 'Vegetables', pricePerUnit: 55, unit: 'kg' },
    { name: 'French Beans', name_te: 'ఫ్రెంచ్ బీన్స్', category: 'Vegetables', pricePerUnit: 65, unit: 'kg' },
    { name: 'Carrot', name_te: 'క్యారెట్', category: 'Vegetables', pricePerUnit: 50, unit: 'kg' },
    { name: 'Beetroot', name_te: 'బీట్‌రూట్', category: 'Vegetables', pricePerUnit: 45, unit: 'kg' },
    { name: 'Cabbage', name_te: 'క్యాబేజీ', category: 'Vegetables', pricePerUnit: 25, unit: 'pcs' },
    { name: 'Cauliflower', name_te: 'కాలీఫ్లవర్', category: 'Vegetables', pricePerUnit: 30, unit: 'pcs' },
    { name: 'Cucumber', name_te: 'దోసకాయ', category: 'Vegetables', pricePerUnit: 30, unit: 'kg' },
    { name: 'Raw Banana', name_te: 'పచ్చి అరటికాయ', category: 'Vegetables', pricePerUnit: 10, unit: 'pcs' },
    { name: 'Pumpkin', name_te: 'గుమ్మడికాయ', category: 'Vegetables', pricePerUnit: 30, unit: 'kg' },
    { name: 'Ivy Gourd (Dondakaya)', name_te: 'దొండకాయ', category: 'Vegetables', pricePerUnit: 40, unit: 'kg' },
    { name: 'Chow Chow (Bangalore Vankaya)', name_te: 'చౌ చౌ (బెంగుళూరు వంకాయ)', category: 'Vegetables', pricePerUnit: 35, unit: 'kg' },

    // Leafy Vegetables
    { name: 'Spinach (Palak)', name_te: 'పాలకూర', category: 'Vegetables', pricePerUnit: 15, unit: 'bunch' },
    { name: 'Gongura', name_te: 'గోంగూర', category: 'Vegetables', pricePerUnit: 15, unit: 'bunch' },
    { name: 'Coriander Leaves', name_te: 'కొత్తిమీర', category: 'Vegetables', pricePerUnit: 10, unit: 'bunch' },
    { name: 'Mint Leaves', name_te: 'పుదీనా ఆకులు', category: 'Vegetables', pricePerUnit: 10, unit: 'bunch' },
    { name: 'Curry Leaves', name_te: 'కరివేపాకు', category: 'Vegetables', pricePerUnit: 5, unit: 'bunch' },
    { name: 'Fenugreek Leaves (Menthikura)', name_te: 'మెంతులు ఆకులు (మెంతికూర)', category: 'Vegetables', pricePerUnit: 15, unit: 'bunch' },
    { name: 'Sorrel Leaves', name_te: 'సోరెల్ ఆకులు', category: 'Vegetables', pricePerUnit: 15, unit: 'bunch' },

    // Fruits
    { name: 'Banana', name_te: 'అరటిపండు', category: 'Fruits', pricePerUnit: 40, unit: 'dozen' },
    { name: 'Apple', name_te: 'ఆపిల్', category: 'Fruits', pricePerUnit: 150, unit: 'kg' },
    { name: 'Orange', name_te: 'నారింజ', category: 'Fruits', pricePerUnit: 80, unit: 'kg' },
    { name: 'Sweet Lime (Mosambi)', name_te: 'మోసంబి', category: 'Fruits', pricePerUnit: 70, unit: 'kg' },
    { name: 'Papaya', name_te: 'బొప్పాయి', category: 'Fruits', pricePerUnit: 40, unit: 'pcs' },
    { name: 'Guava', name_te: 'జామకాయ', category: 'Fruits', pricePerUnit: 60, unit: 'kg' },
    { name: 'Watermelon', name_te: 'పుచ్చకాయ', category: 'Fruits', pricePerUnit: 50, unit: 'pcs' },
    { name: 'Muskmelon', name_te: 'కర్బూజ', category: 'Fruits', pricePerUnit: 40, unit: 'pcs' },
    { name: 'Mango (Seasonal)', name_te: 'మామిడి (సీజనల్)', category: 'Fruits', pricePerUnit: 120, unit: 'kg' },
    { name: 'Grapes', name_te: 'ద్రాక్ష', category: 'Fruits', pricePerUnit: 90, unit: 'kg' },
    { name: 'Pineapple', name_te: 'పైనాపిల్', category: 'Fruits', pricePerUnit: 50, unit: 'pcs' },
    { name: 'Pomegranate', name_te: 'దానిమ్మ', category: 'Fruits', pricePerUnit: 140, unit: 'kg' },
    { name: 'Custard Apple (Seethaphalam)', name_te: 'సీతాఫలం', category: 'Fruits', pricePerUnit: 100, unit: 'kg' },
    { name: 'Dragon Fruit', name_te: 'డ్రాగన్ ఫ్రూట్', category: 'Fruits', pricePerUnit: 80, unit: 'pcs' },

    // Dairy Products
    { name: 'Milk', name_te: 'పాలు', category: 'Dairy', pricePerUnit: 60, unit: 'litre' },
    { name: 'Curd', name_te: 'పెరుగు', category: 'Dairy', pricePerUnit: 50, unit: 'kg' },
    { name: 'Butter', name_te: 'వెన్న', category: 'Dairy', pricePerUnit: 550, unit: 'kg' },
    { name: 'Paneer', name_te: 'పనీర్', category: 'Dairy', pricePerUnit: 350, unit: 'kg' },
];

const productImages: Record<string, string> = {
    'Sweet Corn': 'https://placehold.co/400x300/E8F5E9/2E7D32?text=Sweet+Corn',
    'Baby Corn': 'https://placehold.co/400x300/FFF8E1/FF8F00?text=Baby+Corn',
    'Mushrooms': 'https://placehold.co/400x300/EFEBE9/4E342E?text=Mushrooms',
    'Green Peas': 'https://placehold.co/400x300/E8F5E9/2E7D32?text=Green+Peas',
    'Broccoli': 'https://placehold.co/400x300/E8F5E9/1B5E20?text=Broccoli',
    'Capsicum': 'https://placehold.co/400x300/E8F5E9/1B5E20?text=Capsicum',
    'Panasa Pottu (Jackfruit pieces)': 'https://placehold.co/400x300/FFF3E0/E65100?text=Jackfruit',
    'Red Cabbage': 'https://placehold.co/400x300/F3E5F5/4A148C?text=Red+Cabbage',
    'Tomato': 'https://placehold.co/400x300/FFEBEE/C62828?text=Tomato',
    'Onion': 'https://placehold.co/400x300/FCE4EC/880E4F?text=Onion',
    'Potato': 'https://placehold.co/400x300/FFFDE7/FBC02D?text=Potato',
    'Brinjal (Vankaya)': 'https://placehold.co/400x300/F3E5F5/4A148C?text=Brinjal',
    'Ladies Finger (Bendakaya)': 'https://placehold.co/400x300/E8F5E9/2E7D32?text=Ladies+Finger',
    'Bottle Gourd (Sorakaya)': 'https://placehold.co/400x300/E8F5E9/388E3C?text=Bottle+Gourd',
    'Ridge Gourd (Beerakaya)': 'https://placehold.co/400x300/E8F5E9/388E3C?text=Ridge+Gourd',
    'Snake Gourd (Potlakaya)': 'https://placehold.co/400x300/E8F5E9/388E3C?text=Snake+Gourd',
    'Drumstick (Munagakaya)': 'https://placehold.co/400x300/E8F5E9/388E3C?text=Drumstick',
    'Cluster Beans (Goruchikkudu)': 'https://placehold.co/400x300/E8F5E9/388E3C?text=Cluster+Beans',
    'French Beans': 'https://placehold.co/400x300/E8F5E9/388E3C?text=French+Beans',
    'Carrot': 'https://placehold.co/400x300/FFF3E0/EF6C00?text=Carrot',
    'Beetroot': 'https://placehold.co/400x300/FCE4EC/880E4F?text=Beetroot',
    'Cabbage': 'https://placehold.co/400x300/E8F5E9/2E7D32?text=Cabbage',
    'Cauliflower': 'https://placehold.co/400x300/F5F5F5/616161?text=Cauliflower',
    'Cucumber': 'https://placehold.co/400x300/E8F5E9/388E3C?text=Cucumber',
    'Raw Banana': 'https://placehold.co/400x300/E8F5E9/388E3C?text=Raw+Banana',
    'Pumpkin': 'https://placehold.co/400x300/FFF3E0/E65100?text=Pumpkin',
    'Ivy Gourd (Dondakaya)': 'https://placehold.co/400x300/E8F5E9/388E3C?text=Ivy+Gourd',
    'Chow Chow (Bangalore Vankaya)': 'https://placehold.co/400x300/E8F5E9/388E3C?text=Chow+Chow',
    'Spinach (Palak)': 'https://placehold.co/400x300/E8F5E9/1B5E20?text=Spinach',
    'Gongura': 'https://placehold.co/400x300/E8F5E9/1B5E20?text=Gongura',
    'Coriander Leaves': 'https://placehold.co/400x300/E8F5E9/1B5E20?text=Coriander',
    'Mint Leaves': 'https://placehold.co/400x300/E8F5E9/1B5E20?text=Mint',
    'Curry Leaves': 'https://placehold.co/400x300/E8F5E9/1B5E20?text=Curry+Leaves',
    'Fenugreek Leaves (Menthikura)': 'https://placehold.co/400x300/E8F5E9/1B5E20?text=Fenugreek',
    'Sorrel Leaves': 'https://placehold.co/400x300/E8F5E9/1B5E20?text=Sorrel',
    'Banana': 'https://placehold.co/400x300/FFFDE7/FBC02D?text=Banana',
    'Apple': 'https://placehold.co/400x300/FFEBEE/C62828?text=Apple',
    'Orange': 'https://placehold.co/400x300/FFF3E0/EF6C00?text=Orange',
    'Sweet Lime (Mosambi)': 'https://placehold.co/400x300/F9FBE7/AFB42B?text=Sweet+Lime',
    'Papaya': 'https://placehold.co/400x300/FFF3E0/E65100?text=Papaya',
    'Guava': 'https://placehold.co/400x300/E8F5E9/388E3C?text=Guava',
    'Watermelon': 'https://placehold.co/400x300/FFEBEE/C62828?text=Watermelon',
    'Muskmelon': 'https://placehold.co/400x300/FFF3E0/E65100?text=Muskmelon',
    'Mango (Seasonal)': 'https://placehold.co/400x300/FFF8E1/FFC107?text=Mango',
    'Grapes': 'https://placehold.co/400x300/F3E5F5/4A148C?text=Grapes',
    'Pineapple': 'https://placehold.co/400x300/FFF8E1/FBC02D?text=Pineapple',
    'Pomegranate': 'https://placehold.co/400x300/FFEBEE/C62828?text=Pomegranate',
    'Custard Apple (Seethaphalam)': 'https://placehold.co/400x300/E8F5E9/2E7D32?text=Custard+Apple',
    'Dragon Fruit': 'https://placehold.co/400x300/FCE4EC/880E4F?text=Dragon+Fruit',
    'Milk': 'https://placehold.co/400x300/E3F2FD/1976D2?text=Milk',
    'Curd': 'https://placehold.co/400x300/FAFAFA/616161?text=Curd',
    'Butter': 'https://placehold.co/400x300/FFF8E1/FFB300?text=Butter',
    'Paneer': 'https://placehold.co/400x300/FAFAFA/616161?text=Paneer',
};

const assignSubCategory = (product: Omit<Product, 'id' | 'imageUrl' | 'imageHint' | 'displayOrder' | 'createdAt' | 'isCutVegetable' | 'cutCharge' | 'isActive' | 'subCategory'>): string => {
    const leafyVegetableNames = ['Spinach', 'Gongura', 'Coriander', 'Mint', 'Curry', 'Fenugreek', 'Sorrel'];
    if (product.category === 'Vegetables' && leafyVegetableNames.some(lv => product.name.includes(lv))) {
        return 'Leafy Vegetables';
    }
    if (product.category === 'Fruits') {
        const commonFruits = ['Banana', 'Apple', 'Orange', 'Grapes', 'Pomegranate', 'Sweet Lime'];
        if (commonFruits.some(f => product.name.includes(f))) {
            return 'Commonly Used Fresh Fruits';
        } else {
            return 'Traditional & Seasonal';
        }
    }
    return '';
}


export const products: Product[] = rawProducts.map((p, index) => {
    const cleanedName = p.name.replace(/\s*\(.*?\)\s*/g, '').trim();
    return {
        ...p,
        id: generateId(p.name),
        subCategory: assignSubCategory(p),
        imageUrl: productImages[p.name] || 'https://i.ibb.co/2k1p9Yq/tomato.jpg', // Fallback image
        imageHint: `fresh ${cleanedName.toLowerCase()}`,
        displayOrder: index + 1,
        isActive: true,
        isCutVegetable: false,
        cutCharge: 10,
        stockQuantity: 0,
        createdAt: new Date(), // This will be replaced by serverTimestamp() during seeding
    };
});


export const areas: Area[] = [
    { id: 'area_1', name: 'New Nallakunta', defaultSlots: ['7-9 AM', '5-7 PM'], pincode: '500044' },
    { id: 'area_2', name: 'Vidya Nagar', defaultSlots: ['7-9 AM', '5-7 PM'], pincode: '500044' },
    { id: 'area_3', name: 'Amberpet', defaultSlots: ['9-11 AM', '7-9 PM'], pincode: '500013' },
    { id: 'area_4', name: 'Himayath Nagar', defaultSlots: ['9-11 AM', '7-9 PM'], pincode: '500029' },
];





