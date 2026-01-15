// Test Users for Sri Sakambari App
// Import these users into Firestore for testing

export const testUsers = [
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
        createdAt: new Date(),
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
        createdAt: new Date(),
        addresses: [
            {
                id: "addr_2",
                label: "Home",
                line1: "456 Banjara Hills",
                area: "Banjara Hills",
                pincode: "500034",
                landmark: "Near KBR Park",
                isDefault: true
            },
            {
                id: "addr_3",
                label: "Office",
                line1: "789 Hitech City",
                area: "Hitech City",
                pincode: "500081",
                landmark: "Cyber Towers",
                isDefault: false
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
        createdAt: new Date(),
        addresses: []
    }
];

// Test Products
export const testProducts = [
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
];

// Test Orders
export const testOrders = [
    {
        id: "order_001",
        customerId: "test_customer_1",
        customerName: "Rajesh Kumar",
        items: [
            {
                productId: "prod_tomato",
                name: "Tomato",
                name_te: "టమాటా",
                qty: 2,
                priceAtOrder: 40,
                isCut: false
            },
            {
                productId: "prod_onion",
                name: "Onion",
                name_te: "ఉల్లిపాయ",
                qty: 1,
                priceAtOrder: 35,
                isCut: false
            }
        ],
        totalAmount: 115,
        status: "pending",
        deliveryAddress: {
            line1: "123 MG Road",
            area: "Jubilee Hills",
            pincode: "500033",
            landmark: "Near Apollo Hospital"
        },
        phone: "9876543210",
        createdAt: new Date(),
        notes: "Please deliver before 6 PM"
    },
    {
        id: "order_002",
        customerId: "test_customer_2",
        customerName: "Priya Sharma",
        items: [
            {
                productId: "prod_apple",
                name: "Apple",
                name_te: "ఆపిల్",
                qty: 1,
                priceAtOrder: 150,
                isCut: false
            },
            {
                productId: "prod_banana",
                name: "Banana",
                name_te: "అరటిపండు",
                qty: 2,
                priceAtOrder: 50,
                isCut: false
            }
        ],
        totalAmount: 250,
        status: "assigned",
        deliveryPersonId: "test_delivery_1",
        deliveryAddress: {
            line1: "456 Banjara Hills",
            area: "Banjara Hills",
            pincode: "500034",
            landmark: "Near KBR Park"
        },
        phone: "9876543211",
        createdAt: new Date()
    }
];

// Test Coupons
export const testCoupons = [
    {
        id: "WELCOME10",
        code: "WELCOME10",
        discount: 10,
        discountType: "percentage",
        minOrderAmount: 100,
        maxDiscount: 50,
        isActive: true,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
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
        expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        description: "Flat ₹50 off on orders above ₹200"
    }
];

// Test Areas
export const testAreas = [
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
    },
    {
        id: "area_4",
        name: "Kukatpally",
        pincode: "500072",
        deliveryCharge: 25,
        isActive: true
    }
];
