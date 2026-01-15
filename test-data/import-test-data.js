const admin = require('firebase-admin');
const serviceAccount = require('../firebase-service-account.json'); // You'll need to download this from Firebase Console

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Test data
const testData = {
    users: [
        {
            id: "test_customer_1",
            name: "Rajesh Kumar",
            email: "rajesh.test@example.com",
            phone: "9876543210",
            role: "customer",
            address: "123 MG Road",
            area: "Jubilee Hills",
            pincode: "500033",
            landmark: "Near Apollo Hospital",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            addresses: [
                {
                    id: "addr_1",
                    label: "Home",
                    line1: "123 MG Road",
                    area: "Jubilee Hills",
                    pincode: "500033",
                    landmark: "Near Apollo Hospital",
                    isDefault: true
                }
            ]
        },
        {
            id: "test_customer_2",
            name: "Priya Sharma",
            email: "priya.test@example.com",
            phone: "9876543211",
            role: "customer",
            address: "456 Banjara Hills",
            area: "Banjara Hills",
            pincode: "500034",
            landmark: "Near KBR Park",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            addresses: [
                {
                    id: "addr_2",
                    label: "Home",
                    line1: "456 Banjara Hills",
                    area: "Banjara Hills",
                    pincode: "500034",
                    landmark: "Near KBR Park",
                    isDefault: true
                }
            ]
        },
        {
            id: "test_delivery_1",
            name: "Venkat Rao",
            email: "venkat.delivery@example.com",
            phone: "9876543212",
            role: "delivery",
            address: "321 Kukatpally",
            area: "Kukatpally",
            pincode: "500072",
            landmark: "Near Metro Station",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            addresses: []
        }
    ],

    products: [
        {
            id: "prod_tomato",
            name: "Tomato",
            name_te: "టమాటా",
            category: "Vegetables",
            pricePerUnit: 40,
            unit: "kg",
            isActive: true,
            isAvailable: true,
            imageUrl: "https://picsum.photos/seed/tomato/300/200",
            description: "Fresh red tomatoes",
            stock: 100
        },
        {
            id: "prod_potato",
            name: "Potato",
            name_te: "బంగాళదుంప",
            category: "Vegetables",
            pricePerUnit: 30,
            unit: "kg",
            isActive: true,
            isAvailable: true,
            imageUrl: "https://picsum.photos/seed/potato/300/200",
            description: "Fresh potatoes",
            stock: 150
        },
        {
            id: "prod_onion",
            name: "Onion",
            name_te: "ఉల్లిపాయ",
            category: "Vegetables",
            pricePerUnit: 35,
            unit: "kg",
            isActive: true,
            isAvailable: true,
            imageUrl: "https://picsum.photos/seed/onion/300/200",
            description: "Fresh onions",
            stock: 120
        },
        {
            id: "prod_apple",
            name: "Apple",
            name_te: "ఆపిల్",
            category: "Fruits",
            pricePerUnit: 150,
            unit: "kg",
            isActive: true,
            isAvailable: true,
            imageUrl: "https://picsum.photos/seed/apple/300/200",
            description: "Fresh apples",
            stock: 80
        },
        {
            id: "prod_banana",
            name: "Banana",
            name_te: "అరటిపండు",
            category: "Fruits",
            pricePerUnit: 50,
            unit: "dozen",
            isActive: true,
            isAvailable: true,
            imageUrl: "https://picsum.photos/seed/banana/300/200",
            description: "Fresh bananas",
            stock: 200
        },
        {
            id: "prod_carrot",
            name: "Carrot",
            name_te: "క్యారెట్",
            category: "Vegetables",
            pricePerUnit: 45,
            unit: "kg",
            isActive: true,
            isAvailable: true,
            imageUrl: "https://picsum.photos/seed/carrot/300/200",
            description: "Fresh carrots",
            stock: 90
        }
    ],

    areas: [
        {
            id: "area_1",
            name: "Jubilee Hills",
            pincode: "500033",
            deliveryCharge: 20,
            isActive: true
        },
        {
            id: "area_2",
            name: "Banjara Hills",
            pincode: "500034",
            deliveryCharge: 20,
            isActive: true
        },
        {
            id: "area_3",
            name: "Hitech City",
            pincode: "500081",
            deliveryCharge: 30,
            isActive: true
        }
    ],

    coupons: [
        {
            id: "WELCOME10",
            code: "WELCOME10",
            discount: 10,
            discountType: "percentage",
            minOrderAmount: 100,
            maxDiscount: 50,
            isActive: true,
            expiryDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
            description: "Welcome offer - 10% off"
        },
        {
            id: "FLAT50",
            code: "FLAT50",
            discount: 50,
            discountType: "fixed",
            minOrderAmount: 200,
            maxDiscount: 50,
            isActive: true,
            expiryDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)),
            description: "Flat ₹50 off on orders above ₹200"
        }
    ]
};

async function importTestData() {
    console.log('🚀 Starting test data import...\n');

    try {
        // Import Users
        console.log('📱 Importing users...');
        for (const user of testData.users) {
            await db.collection('users').doc(user.id).set(user);
            console.log(`  ✅ Added user: ${user.name}`);
        }

        // Import Products
        console.log('\n🥬 Importing products...');
        for (const product of testData.products) {
            await db.collection('products').doc(product.id).set(product);
            console.log(`  ✅ Added product: ${product.name}`);
        }

        // Import Areas
        console.log('\n📍 Importing areas...');
        for (const area of testData.areas) {
            await db.collection('areas').doc(area.id).set(area);
            console.log(`  ✅ Added area: ${area.name}`);
        }

        // Import Coupons
        console.log('\n🎟️  Importing coupons...');
        for (const coupon of testData.coupons) {
            await db.collection('coupons').doc(coupon.id).set(coupon);
            console.log(`  ✅ Added coupon: ${coupon.code}`);
        }

        console.log('\n✅ Test data import completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`  - Users: ${testData.users.length}`);
        console.log(`  - Products: ${testData.products.length}`);
        console.log(`  - Areas: ${testData.areas.length}`);
        console.log(`  - Coupons: ${testData.coupons.length}`);

    } catch (error) {
        console.error('❌ Error importing test data:', error);
    }

    process.exit(0);
}

// Run import
importTestData();
