
const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'components', 'cart-sheet.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const searchString = "useCollection<Product>('products')";

if (content.includes(searchString)) {
  console.log('BASELINE CONFIRMED: Found inefficient useCollection call.');
} else {
  console.log('OPTIMIZED: Inefficient useCollection call NOT found.');
}
