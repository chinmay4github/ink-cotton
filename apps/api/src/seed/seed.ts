/* Demo data for the storefront. Safe to re-run: wipes transactional/catalogue data, keeps lookups. */
import * as bcrypt from 'bcryptjs';
import PHOTOS from './photos.json';

/** Model photography (Unsplash, free licence) served from Unsplash's CDN, cropped to the 3:4 product frame. */
export const unsplash = (id: string, w = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${Math.round((w * 4) / 3)}&q=80`;

import { PrismaClient } from '../generated/prisma/client';

let prisma: PrismaClient;


// deterministic RNG so every seed produces the same catalogue
let s = 42;
const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
const between = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));
const slugify = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

type Kind = 'tshirt' | 'polo' | 'shirt' | 'jacket' | 'hoodie' | 'jeans' | 'chinos' | 'shorts' | 'kurta' | 'dress' | 'top' | 'saree' | 'frock' | 'romper' | 'sneaker';

interface Spec {
  name: string;
  kind: Kind;
  cat: string; // category slug
  dept: 'men' | 'women' | 'kids';
  brand: string;
  vendor: number; // index
  price: [number, number];
  colors: string[];
  material: string;
  fit?: string;
  pattern?: string;
  sleeve?: string;
  occasion?: string;
  group: 'adult_alpha' | 'adult_numeric' | 'kids_age' | 'footwear' | 'free_size';
  featured?: boolean;
}

const V = { IC: 0, LOOM: 1, LITTLE: 2 };

const SPECS: Spec[] = [
  // ---------------- MEN
  { name: 'Essential Crew Neck T-Shirt', kind: 'tshirt', cat: 'men-tshirts', dept: 'men', brand: 'Ink & Cotton Basics', vendor: V.IC, price: [499, 799], colors: ['Black', 'White', 'Navy Blue', 'Olive', 'Maroon'], material: '100% Combed Cotton, 180 GSM', fit: 'Regular', pattern: 'Solid', sleeve: 'Half Sleeve', occasion: 'Casual', group: 'adult_alpha', featured: true },
  { name: 'Oversized Drop-Shoulder Tee', kind: 'tshirt', cat: 'men-tshirts', dept: 'men', brand: 'Northline', vendor: V.IC, price: [699, 1199], colors: ['Beige', 'Black', 'Sky Blue'], material: 'Cotton French Terry, 220 GSM', fit: 'Oversized', pattern: 'Solid', sleeve: 'Half Sleeve', occasion: 'Streetwear', group: 'adult_alpha', featured: true },
  { name: 'Pique Polo T-Shirt', kind: 'polo', cat: 'men-tshirts', dept: 'men', brand: 'Ink & Cotton Basics', vendor: V.IC, price: [899, 1399], colors: ['Navy Blue', 'White', 'Green', 'Red'], material: 'Cotton Pique', fit: 'Slim', pattern: 'Solid', sleeve: 'Half Sleeve', occasion: 'Smart Casual', group: 'adult_alpha' },
  { name: 'Pocket Henley Tee', kind: 'tshirt', cat: 'men-tshirts', dept: 'men', brand: 'Northline', vendor: V.IC, price: [649, 999], colors: ['Grey', 'Olive', 'Brown'], material: 'Cotton Slub', fit: 'Regular', pattern: 'Solid', sleeve: 'Half Sleeve', occasion: 'Casual', group: 'adult_alpha' },
  { name: 'Performance Dry-Fit Tee', kind: 'tshirt', cat: 'men-tshirts', dept: 'men', brand: 'Northline', vendor: V.IC, price: [599, 999], colors: ['Black', 'Sky Blue', 'Orange'], material: 'Recycled Polyester', fit: 'Athletic', pattern: 'Solid', sleeve: 'Half Sleeve', occasion: 'Sports', group: 'adult_alpha' },
  { name: 'Oxford Button-Down Shirt', kind: 'shirt', cat: 'men-shirts', dept: 'men', brand: 'Ink & Cotton Basics', vendor: V.IC, price: [1299, 1999], colors: ['White', 'Sky Blue', 'Pink'], material: '100% Cotton Oxford', fit: 'Slim', pattern: 'Solid', sleeve: 'Full Sleeve', occasion: 'Office', group: 'adult_alpha', featured: true },
  { name: 'Linen Resort Shirt', kind: 'shirt', cat: 'men-shirts', dept: 'men', brand: 'Indigo Loom', vendor: V.LOOM, price: [1499, 2299], colors: ['Beige', 'White', 'Olive'], material: '100% Linen', fit: 'Relaxed', pattern: 'Solid', sleeve: 'Full Sleeve', occasion: 'Vacation', group: 'adult_alpha' },
  { name: 'Indigo Chambray Shirt', kind: 'shirt', cat: 'men-shirts', dept: 'men', brand: 'Indigo Loom', vendor: V.LOOM, price: [1399, 2199], colors: ['Navy Blue', 'Sky Blue'], material: 'Cotton Chambray', fit: 'Regular', pattern: 'Solid', sleeve: 'Full Sleeve', occasion: 'Casual', group: 'adult_alpha' },
  { name: 'Flannel Check Overshirt', kind: 'shirt', cat: 'men-shirts', dept: 'men', brand: 'Northline', vendor: V.IC, price: [1599, 2499], colors: ['Red', 'Green', 'Grey'], material: 'Brushed Cotton Flannel', fit: 'Relaxed', pattern: 'Checked', sleeve: 'Full Sleeve', occasion: 'Casual', group: 'adult_alpha' },
  { name: 'Classic Denim Trucker Jacket', kind: 'jacket', cat: 'men-jackets', dept: 'men', brand: 'Indigo Loom', vendor: V.LOOM, price: [2999, 4499], colors: ['Navy Blue', 'Black'], material: '12 oz Cotton Denim', fit: 'Regular', pattern: 'Solid', sleeve: 'Full Sleeve', occasion: 'Casual', group: 'adult_alpha', featured: true },
  { name: 'Quilted Bomber Jacket', kind: 'jacket', cat: 'men-jackets', dept: 'men', brand: 'Northline', vendor: V.IC, price: [3499, 5499], colors: ['Olive', 'Black', 'Navy Blue'], material: 'Nylon shell, polyfill', fit: 'Regular', pattern: 'Quilted', sleeve: 'Full Sleeve', occasion: 'Winter', group: 'adult_alpha' },
  { name: 'Fleece Pullover Hoodie', kind: 'hoodie', cat: 'men-jackets', dept: 'men', brand: 'Ink & Cotton Basics', vendor: V.IC, price: [1499, 2299], colors: ['Grey', 'Black', 'Maroon', 'Navy Blue'], material: 'Cotton-rich Fleece, 320 GSM', fit: 'Regular', pattern: 'Solid', sleeve: 'Full Sleeve', occasion: 'Winter', group: 'adult_alpha', featured: true },
  { name: 'Slim Tapered Stretch Jeans', kind: 'jeans', cat: 'men-bottomwear', dept: 'men', brand: 'Indigo Loom', vendor: V.LOOM, price: [1799, 2799], colors: ['Navy Blue', 'Black', 'Sky Blue'], material: '98% Cotton, 2% Elastane', fit: 'Slim Tapered', pattern: 'Solid', occasion: 'Casual', group: 'adult_numeric', featured: true },
  { name: 'Straight Fit Selvedge Jeans', kind: 'jeans', cat: 'men-bottomwear', dept: 'men', brand: 'Indigo Loom', vendor: V.LOOM, price: [2499, 3999], colors: ['Navy Blue'], material: '13.5 oz Selvedge Denim', fit: 'Straight', pattern: 'Solid', occasion: 'Casual', group: 'adult_numeric' },
  { name: 'Everyday Stretch Chinos', kind: 'chinos', cat: 'men-bottomwear', dept: 'men', brand: 'Ink & Cotton Basics', vendor: V.IC, price: [1399, 2199], colors: ['Beige', 'Olive', 'Navy Blue', 'Black'], material: 'Cotton Twill with Stretch', fit: 'Slim', pattern: 'Solid', occasion: 'Office', group: 'adult_numeric' },
  { name: 'Drawstring Cotton Shorts', kind: 'shorts', cat: 'men-bottomwear', dept: 'men', brand: 'Northline', vendor: V.IC, price: [699, 1099], colors: ['Grey', 'Navy Blue', 'Olive'], material: 'Cotton Terry', fit: 'Regular', pattern: 'Solid', occasion: 'Lounge', group: 'adult_alpha' },
  { name: 'Mandarin Collar Cotton Kurta', kind: 'kurta', cat: 'men-ethnic', dept: 'men', brand: 'Saffron Thread', vendor: V.LOOM, price: [1199, 1899], colors: ['White', 'Yellow', 'Navy Blue', 'Maroon'], material: 'Cotton Slub', fit: 'Regular', pattern: 'Solid', sleeve: 'Full Sleeve', occasion: 'Festive', group: 'adult_alpha', featured: true },
  { name: 'Silk Blend Festive Kurta', kind: 'kurta', cat: 'men-ethnic', dept: 'men', brand: 'Saffron Thread', vendor: V.LOOM, price: [2199, 3499], colors: ['Beige', 'Maroon', 'Green'], material: 'Silk Blend', fit: 'Regular', pattern: 'Self Design', sleeve: 'Full Sleeve', occasion: 'Wedding', group: 'adult_alpha' },
  { name: 'Leather Low-Top Sneakers', kind: 'sneaker', cat: 'men-footwear', dept: 'men', brand: 'Northline', vendor: V.IC, price: [2999, 4499], colors: ['White', 'Black'], material: 'Full-grain Leather upper, rubber sole', occasion: 'Casual', group: 'footwear' },
  { name: 'Knit Running Shoes', kind: 'sneaker', cat: 'men-footwear', dept: 'men', brand: 'Northline', vendor: V.IC, price: [2499, 3999], colors: ['Grey', 'Navy Blue', 'Black'], material: 'Engineered Knit, EVA sole', occasion: 'Sports', group: 'footwear' },

  // ---------------- WOMEN
  { name: 'Tiered Cotton Maxi Dress', kind: 'dress', cat: 'women-dresses', dept: 'women', brand: 'Saffron Thread', vendor: V.LOOM, price: [1799, 2799], colors: ['Yellow', 'Sky Blue', 'White'], material: '100% Cotton Voile', fit: 'Flared', pattern: 'Solid', sleeve: 'Sleeveless', occasion: 'Vacation', group: 'adult_alpha', featured: true },
  { name: 'Wrap Midi Dress', kind: 'dress', cat: 'women-dresses', dept: 'women', brand: 'Ink & Cotton Basics', vendor: V.IC, price: [1999, 2999], colors: ['Maroon', 'Green', 'Black'], material: 'Viscose Crepe', fit: 'Wrap', pattern: 'Solid', sleeve: 'Half Sleeve', occasion: 'Party', group: 'adult_alpha', featured: true },
  { name: 'Linen Shirt Dress', kind: 'dress', cat: 'women-dresses', dept: 'women', brand: 'Indigo Loom', vendor: V.LOOM, price: [2199, 3299], colors: ['Beige', 'Olive', 'White'], material: 'Linen Blend', fit: 'Relaxed', pattern: 'Solid', sleeve: 'Full Sleeve', occasion: 'Office', group: 'adult_alpha' },
  { name: 'Ribbed Bodycon Dress', kind: 'dress', cat: 'women-dresses', dept: 'women', brand: 'Northline', vendor: V.IC, price: [1299, 1999], colors: ['Black', 'Brown', 'Pink'], material: 'Cotton Rib Knit', fit: 'Bodycon', pattern: 'Ribbed', sleeve: 'Sleeveless', occasion: 'Party', group: 'adult_alpha' },
  { name: 'Smocked Floral Sundress', kind: 'dress', cat: 'women-dresses', dept: 'women', brand: 'Saffron Thread', vendor: V.LOOM, price: [1599, 2399], colors: ['Pink', 'Sky Blue', 'Yellow'], material: 'Rayon', fit: 'Flared', pattern: 'Floral', sleeve: 'Sleeveless', occasion: 'Casual', group: 'adult_alpha' },
  { name: 'Relaxed Boyfriend Tee', kind: 'tshirt', cat: 'women-tops', dept: 'women', brand: 'Ink & Cotton Basics', vendor: V.IC, price: [499, 799], colors: ['White', 'Black', 'Pink', 'Beige'], material: '100% Organic Cotton', fit: 'Relaxed', pattern: 'Solid', sleeve: 'Half Sleeve', occasion: 'Casual', group: 'adult_alpha', featured: true },
  { name: 'Puff Sleeve Blouse', kind: 'top', cat: 'women-tops', dept: 'women', brand: 'Saffron Thread', vendor: V.LOOM, price: [999, 1599], colors: ['White', 'Sky Blue', 'Yellow'], material: 'Cotton Poplin', fit: 'Regular', pattern: 'Solid', sleeve: 'Puff Sleeve', occasion: 'Office', group: 'adult_alpha' },
  { name: 'Satin Camisole Top', kind: 'top', cat: 'women-tops', dept: 'women', brand: 'Northline', vendor: V.IC, price: [799, 1299], colors: ['Black', 'Beige', 'Maroon'], material: 'Satin', fit: 'Regular', pattern: 'Solid', sleeve: 'Sleeveless', occasion: 'Party', group: 'adult_alpha' },
  { name: 'Cropped Knit Cardigan', kind: 'hoodie', cat: 'women-tops', dept: 'women', brand: 'Northline', vendor: V.IC, price: [1499, 2299], colors: ['Beige', 'Pink', 'Grey'], material: 'Acrylic-Wool Blend', fit: 'Cropped', pattern: 'Knitted', sleeve: 'Full Sleeve', occasion: 'Winter', group: 'adult_alpha' },
  { name: 'Oversized Linen Shirt', kind: 'shirt', cat: 'women-tops', dept: 'women', brand: 'Indigo Loom', vendor: V.LOOM, price: [1299, 1999], colors: ['White', 'Sky Blue', 'Olive'], material: '100% Linen', fit: 'Oversized', pattern: 'Solid', sleeve: 'Full Sleeve', occasion: 'Casual', group: 'adult_alpha' },
  { name: 'High-Rise Mom Jeans', kind: 'jeans', cat: 'women-jeans', dept: 'women', brand: 'Indigo Loom', vendor: V.LOOM, price: [1699, 2599], colors: ['Sky Blue', 'Navy Blue', 'Black'], material: '100% Cotton Denim', fit: 'Mom Fit', pattern: 'Solid', occasion: 'Casual', group: 'adult_numeric', featured: true },
  { name: 'Wide Leg Denim', kind: 'jeans', cat: 'women-jeans', dept: 'women', brand: 'Indigo Loom', vendor: V.LOOM, price: [1899, 2799], colors: ['Navy Blue', 'White'], material: 'Cotton Denim', fit: 'Wide Leg', pattern: 'Solid', occasion: 'Casual', group: 'adult_numeric' },
  { name: 'Skinny Stretch Jeans', kind: 'jeans', cat: 'women-jeans', dept: 'women', brand: 'Ink & Cotton Basics', vendor: V.IC, price: [1399, 2199], colors: ['Black', 'Navy Blue'], material: 'Cotton-Elastane Denim', fit: 'Skinny', pattern: 'Solid', occasion: 'Casual', group: 'adult_numeric' },
  { name: 'Wide Leg Linen Trousers', kind: 'chinos', cat: 'women-bottomwear', dept: 'women', brand: 'Indigo Loom', vendor: V.LOOM, price: [1499, 2299], colors: ['Beige', 'White', 'Black'], material: 'Linen Blend', fit: 'Wide Leg', pattern: 'Solid', occasion: 'Office', group: 'adult_numeric' },
  { name: 'Block Print A-Line Kurta', kind: 'kurta', cat: 'women-kurtas', dept: 'women', brand: 'Saffron Thread', vendor: V.LOOM, price: [999, 1699], colors: ['Sky Blue', 'Pink', 'Yellow', 'White'], material: 'Cotton Cambric', fit: 'A-Line', pattern: 'Block Print', sleeve: 'Three-Quarter Sleeve', occasion: 'Daily Wear', group: 'adult_alpha', featured: true },
  { name: 'Chikankari Straight Kurta', kind: 'kurta', cat: 'women-kurtas', dept: 'women', brand: 'Saffron Thread', vendor: V.LOOM, price: [1799, 2899], colors: ['White', 'Pink', 'Green'], material: 'Georgette with hand embroidery', fit: 'Straight', pattern: 'Embroidered', sleeve: 'Three-Quarter Sleeve', occasion: 'Festive', group: 'adult_alpha', featured: true },
  { name: 'Anarkali Flared Kurta', kind: 'dress', cat: 'women-kurtas', dept: 'women', brand: 'Saffron Thread', vendor: V.LOOM, price: [2299, 3499], colors: ['Maroon', 'Navy Blue', 'Green'], material: 'Rayon with foil print', fit: 'Flared', pattern: 'Printed', sleeve: 'Full Sleeve', occasion: 'Festive', group: 'adult_alpha' },
  { name: 'Everyday Cotton Kurta', kind: 'kurta', cat: 'women-kurtas', dept: 'women', brand: 'Ink & Cotton Basics', vendor: V.IC, price: [699, 1199], colors: ['Olive', 'Maroon', 'Sky Blue', 'Beige'], material: '100% Cotton', fit: 'Straight', pattern: 'Solid', sleeve: 'Three-Quarter Sleeve', occasion: 'Daily Wear', group: 'adult_alpha' },
  { name: 'Handloom Cotton Saree', kind: 'saree', cat: 'women-sarees', dept: 'women', brand: 'Saffron Thread', vendor: V.LOOM, price: [2499, 3999], colors: ['Maroon', 'Yellow', 'Green'], material: 'Handloom Cotton, with blouse piece', pattern: 'Woven Border', occasion: 'Festive', group: 'free_size', featured: true },
  { name: 'Banarasi Silk Saree', kind: 'saree', cat: 'women-sarees', dept: 'women', brand: 'Saffron Thread', vendor: V.LOOM, price: [5999, 9999], colors: ['Maroon', 'Pink', 'Navy Blue'], material: 'Silk blend with zari', pattern: 'Zari Woven', occasion: 'Wedding', group: 'free_size' },
  { name: 'Canvas Platform Sneakers', kind: 'sneaker', cat: 'women-footwear', dept: 'women', brand: 'Northline', vendor: V.IC, price: [1999, 2999], colors: ['White', 'Pink', 'Black'], material: 'Cotton Canvas, rubber sole', occasion: 'Casual', group: 'footwear' },

  // ---------------- KIDS
  { name: 'Dino Print Kids Tee', kind: 'tshirt', cat: 'kids-boys', dept: 'kids', brand: 'Little Ink', vendor: V.LITTLE, price: [399, 599], colors: ['Sky Blue', 'Yellow', 'Green', 'Grey'], material: '100% Cotton', fit: 'Regular', pattern: 'Printed', sleeve: 'Half Sleeve', occasion: 'Casual', group: 'kids_age', featured: true },
  { name: 'Boys Denim Shorts', kind: 'shorts', cat: 'kids-boys', dept: 'kids', brand: 'Little Ink', vendor: V.LITTLE, price: [599, 899], colors: ['Navy Blue', 'Sky Blue'], material: 'Soft Cotton Denim', fit: 'Regular', pattern: 'Solid', occasion: 'Casual', group: 'kids_age' },
  { name: 'Boys Zip Hoodie', kind: 'hoodie', cat: 'kids-boys', dept: 'kids', brand: 'Little Ink', vendor: V.LITTLE, price: [899, 1399], colors: ['Red', 'Navy Blue', 'Grey'], material: 'Cotton Fleece', fit: 'Regular', pattern: 'Solid', sleeve: 'Full Sleeve', occasion: 'Winter', group: 'kids_age' },
  { name: 'Boys Festive Kurta', kind: 'kurta', cat: 'kids-boys', dept: 'kids', brand: 'Saffron Thread', vendor: V.LOOM, price: [799, 1299], colors: ['Yellow', 'White', 'Maroon'], material: 'Cotton Silk', fit: 'Regular', pattern: 'Solid', sleeve: 'Full Sleeve', occasion: 'Festive', group: 'kids_age' },
  { name: 'Boys Polo T-Shirt', kind: 'polo', cat: 'kids-boys', dept: 'kids', brand: 'Little Ink', vendor: V.LITTLE, price: [499, 799], colors: ['White', 'Navy Blue', 'Orange'], material: 'Cotton Pique', fit: 'Regular', pattern: 'Solid', sleeve: 'Half Sleeve', occasion: 'School', group: 'kids_age' },
  { name: 'Girls Twirl Party Frock', kind: 'frock', cat: 'kids-girls', dept: 'kids', brand: 'Little Ink', vendor: V.LITTLE, price: [999, 1599], colors: ['Pink', 'Purple', 'Yellow'], material: 'Tulle with cotton lining', fit: 'Flared', pattern: 'Solid', sleeve: 'Sleeveless', occasion: 'Party', group: 'kids_age', featured: true },
  { name: 'Girls Cotton Day Dress', kind: 'frock', cat: 'kids-girls', dept: 'kids', brand: 'Little Ink', vendor: V.LITTLE, price: [699, 1099], colors: ['Sky Blue', 'White', 'Green'], material: '100% Cotton', fit: 'A-Line', pattern: 'Floral', sleeve: 'Half Sleeve', occasion: 'Casual', group: 'kids_age' },
  { name: 'Girls Graphic Tee', kind: 'tshirt', cat: 'kids-girls', dept: 'kids', brand: 'Little Ink', vendor: V.LITTLE, price: [399, 599], colors: ['Pink', 'Purple', 'White'], material: '100% Cotton', fit: 'Regular', pattern: 'Printed', sleeve: 'Half Sleeve', occasion: 'Casual', group: 'kids_age' },
  { name: 'Girls Ethnic Kurta Set', kind: 'kurta', cat: 'kids-girls', dept: 'kids', brand: 'Saffron Thread', vendor: V.LOOM, price: [999, 1599], colors: ['Pink', 'Yellow', 'Green'], material: 'Cotton with gota detail', fit: 'Straight', pattern: 'Embellished', sleeve: 'Three-Quarter Sleeve', occasion: 'Festive', group: 'kids_age' },
  { name: 'Girls Denim Jeans', kind: 'jeans', cat: 'kids-girls', dept: 'kids', brand: 'Little Ink', vendor: V.LITTLE, price: [799, 1199], colors: ['Sky Blue', 'Navy Blue'], material: 'Stretch Cotton Denim', fit: 'Slim', pattern: 'Solid', occasion: 'Casual', group: 'kids_age' },
  { name: 'Organic Cotton Romper', kind: 'romper', cat: 'kids-infants', dept: 'kids', brand: 'Little Ink', vendor: V.LITTLE, price: [499, 799], colors: ['White', 'Yellow', 'Sky Blue', 'Pink'], material: '100% Organic Cotton', fit: 'Regular', pattern: 'Solid', sleeve: 'Half Sleeve', occasion: 'Daily Wear', group: 'kids_age', featured: true },
  { name: 'Snap Button Onesie Pack', kind: 'romper', cat: 'kids-infants', dept: 'kids', brand: 'Little Ink', vendor: V.LITTLE, price: [699, 999], colors: ['Grey', 'Green', 'Beige'], material: 'Cotton Interlock', fit: 'Regular', pattern: 'Solid', sleeve: 'Full Sleeve', occasion: 'Daily Wear', group: 'kids_age' },
  { name: 'Kids Velcro Sneakers', kind: 'sneaker', cat: 'kids-footwear', dept: 'kids', brand: 'Little Ink', vendor: V.LITTLE, price: [999, 1499], colors: ['Red', 'Navy Blue', 'Pink'], material: 'Mesh upper, TPR sole', occasion: 'Casual', group: 'footwear' },
];

const DESCRIBE: Record<Kind, string> = {
  tshirt: 'A wardrobe workhorse cut from soft, breathable fabric that holds its shape wash after wash. Ribbed neckline, double-stitched hems.',
  polo: 'A clean, classic polo with a two-button placket and ribbed collar. Smart enough for work, easy enough for weekends.',
  shirt: 'Tailored with a considered fit, a clean collar and genuine buttons. Pairs as easily with denim as it does with chinos.',
  jacket: 'A layering essential with a structured silhouette, reinforced seams and functional pockets.',
  hoodie: 'Brushed on the inside for warmth, with a relaxed drape and ribbed cuffs that keep the cold out.',
  jeans: 'Cut from quality denim with just enough stretch for all-day comfort. Five-pocket styling with branded rivets.',
  chinos: 'Clean-cut trousers in a soft, durable weave. A versatile everyday essential.',
  shorts: 'Easy-going shorts with an elasticated drawstring waist and side pockets.',
  kurta: 'Crafted in breathable fabric with fine detailing at the neckline. Easy to style for festivities or everyday wear.',
  dress: 'A flattering silhouette in a fluid fabric that moves with you, finished with thoughtful details.',
  top: 'A light, feminine top with a soft drape, easy to dress up or down.',
  saree: 'A 6.3 m saree woven with care, featuring a contrast border and pallu. Comes with an unstitched blouse piece.',
  frock: 'Made for twirling: a comfortable bodice and full, flowing skirt with a soft lining that is gentle on skin.',
  romper: 'Gentle on delicate skin with nickel-free snaps for quick changes. Pre-washed for extra softness.',
  sneaker: 'A cushioned footbed, grippy outsole and a clean silhouette that goes with everything.',
};

const REVIEWS: [number, string, string][] = [
  [5, 'Love it', 'Fabric feels premium and the fit is spot on. Already ordered another colour.'],
  [5, 'Great quality', 'Colour is exactly as shown. Washed it twice, no shrinkage.'],
  [4, 'Good buy', 'Nice fabric and stitching. Slightly longer than I expected but looks good.'],
  [4, 'Comfortable', 'Very comfortable for daily wear. Delivery was quick too.'],
  [3, 'Decent', 'Quality is okay for the price. The colour is a shade lighter than the photos.'],
  [5, 'Perfect fit', 'True to size. Would recommend to friends.'],
  [4, 'Nice', 'Looks great, stitching is neat. Wish there were more colours.'],
  [2, 'Runs small', 'Had to exchange for a bigger size. Fabric is good though.'],
];

export async function runSeed(client: PrismaClient) {
  prisma = client;
  s = 42;
  console.log('Resetting demo data...');
  await prisma.$executeRawUnsafe(`
    TRUNCATE shop.notifications, shop.notification_preferences, shop.device_tokens, shop.admin_audit_log,
             shop.return_requests, shop.product_reviews, shop.delivery_agent_locations, shop.shipment_tracking_events,
             shop.shipment_items, shop.shipments, shop.refunds, shop.payments, shop.order_status_history,
             shop.order_items, shop.orders, shop.coupons, shop.wishlist_items, shop.cart_items, shop.carts,
             shop.inventory_movements, shop.product_images, shop.product_variants, shop.products, shop.brands,
             shop.vendor_payouts, shop.vendor_bank_accounts, shop.vendors, shop.delivery_agents, shop.admin_profiles,
             shop.addresses, shop.users RESTART IDENTITY CASCADE`);

  const pw = await bcrypt.hash('Password@123', 10);
  const colors = await prisma.colors.findMany();
  const colorId = (name: string) => colors.find((c) => c.name === name)!.id;
  const hex = (name: string) => colors.find((c) => c.name === name)!.hex_code.slice(1);
  const sizes = await prisma.sizes.findMany({ orderBy: { sort_order: 'asc' } });
  const cats = await prisma.categories.findMany();

  // ---------------------------------------------------------------- people
  const admin = await prisma.users.create({
    data: { role: 'admin', full_name: 'Asha Admin', email: 'admin@inkandcotton.test', password_hash: pw, email_verified: true,
      admin_profile: { create: { designation: 'Operations Head', is_super_admin: true, permissions: ['*'] } } },
  });

  const vendorDefs = [
    { name: 'Ink & Cotton Clothing Pvt Ltd', display: 'Ink & Cotton Official', city: 'Bengaluru', state: 'Karnataka', pin: '560068', email: 'vendor@inkandcotton.test', lat: 12.9121, lng: 77.6446 },
    { name: 'Indigo Loom Textiles LLP', display: 'Indigo Loom Studio', city: 'Jaipur', state: 'Rajasthan', pin: '302001', email: 'loom@inkandcotton.test', lat: 26.9124, lng: 75.7873 },
    { name: 'Little Threads Apparel', display: 'Little Ink Store', city: 'Tiruppur', state: 'Tamil Nadu', pin: '641601', email: 'little@inkandcotton.test', lat: 11.1085, lng: 77.3411 },
  ];
  const vendors = [];
  for (const [i, v] of vendorDefs.entries()) {
    const u = await prisma.users.create({ data: { role: 'vendor', full_name: `${v.display} Owner`, email: v.email, phone: `90000000${10 + i}`, password_hash: pw, email_verified: true } });
    const addr = await prisma.addresses.create({
      data: { user_id: u.id, type: 'warehouse', contact_name: v.display, contact_phone: `90000000${10 + i}`, line1: `Plot ${12 + i}, Industrial Area`, city: v.city, state: v.state, postal_code: v.pin, latitude: v.lat, longitude: v.lng },
    });
    vendors.push(
      await prisma.vendors.create({
        data: { user_id: u.id, business_name: v.name, display_name: v.display, slug: slugify(v.display), gstin: `29ABCDE${1234 + i}F1Z${i}`, support_email: v.email,
          pickup_address_id: addr.id, status: 'approved', approved_by: admin.id, approved_at: new Date(), commission_pct: 12, rating_avg: 4.3 + i / 10 },
      }),
    );
  }

  for (const [i, name] of ['Ravi Kumar', 'Imran Shaikh'].entries()) {
    await prisma.users.create({
      data: { role: 'delivery_agent', full_name: name, email: `rider${i + 1}@inkandcotton.test`, phone: `98000000${10 + i}`, password_hash: pw,
        delivery_agent: { create: { approval_status: 'approved', vehicle_type: 'bike', vehicle_number: `KA01AB${1200 + i}`, is_available: true, service_pincodes: ['560001', '560034', '560068', '560095'],
          current_latitude: 12.93 + i / 100, current_longitude: 77.62 + i / 100, rating_avg: 4.7 } } },
    });
  }

  // applications waiting for the admin team
  {
    const u = await prisma.users.create({ data: { role: 'vendor', full_name: 'Farah Khan', email: 'saffron@inkandcotton.test', phone: '9000000099', password_hash: pw } });
    const addr = await prisma.addresses.create({
      data: { user_id: u.id, type: 'warehouse', contact_name: 'Saffron Thread Co', contact_phone: '9000000099', line1: 'Chowk Bazaar, Shop 7', city: 'Lucknow', state: 'Uttar Pradesh', postal_code: '226003' },
    });
    await prisma.vendors.create({ data: { user_id: u.id, business_name: 'Saffron Thread Co', display_name: 'Saffron Thread', slug: 'saffron-thread', support_email: 'saffron@inkandcotton.test', pickup_address_id: addr.id, status: 'pending' } });
    await prisma.users.create({
      data: { role: 'delivery_agent', full_name: 'Suresh Patil', email: 'rider3@inkandcotton.test', phone: '9800000099', password_hash: pw,
        delivery_agent: { create: { approval_status: 'pending', vehicle_type: 'scooter', vehicle_number: 'KA05MN4471', service_pincodes: ['560102', '560034'] } } },
    });
  }

  const customer = await prisma.users.create({
    data: { role: 'customer', full_name: 'Priya Sharma', email: 'demo@inkandcotton.test', phone: '9876543210', password_hash: pw, email_verified: true, cart: { create: {} } },
  });
  await prisma.addresses.create({
    data: { user_id: customer.id, type: 'home', contact_name: 'Priya Sharma', contact_phone: '9876543210', line1: 'Flat 402, Lakeview Residency', line2: '17th Cross, HSR Layout Sector 2', landmark: 'Near Agara Lake', city: 'Bengaluru', state: 'Karnataka', postal_code: '560102', is_default: true, latitude: 12.9116, longitude: 77.6389 },
  });
  const reviewers = [];
  for (const nm of ['Ananya Iyer', 'Rahul Verma', 'Sneha Reddy', 'Karthik N', 'Meera Joshi', 'Arjun Singh', 'Divya Menon', 'Vikram Rao']) {
    reviewers.push(await prisma.users.create({ data: { full_name: nm, email: `${slugify(nm)}@example.test`, password_hash: pw } }));
  }

  // ---------------------------------------------------------------- catalogue
  const brandNames = [...new Set(SPECS.map((p) => p.brand))];
  const brands = new Map<string, bigint>();
  for (const b of brandNames) brands.set(b, (await prisma.brands.create({ data: { name: b, slug: slugify(b) } })).id);

  let created = 0;
  for (const [idx, p] of SPECS.entries()) {
    const cat = cats.find((c) => c.slug === p.cat);
    if (!cat) throw new Error(`missing category ${p.cat}`);
    const [lo, hi] = p.price;
    const price = Math.round(between(lo, hi) / 50) * 50 - 1;
    const mrp = Math.round((price * (1.2 + rnd() * 0.8)) / 100) * 100 - 1;
    const groupSizes = sizes.filter((z) => z.size_group === p.group);
    const useSizes = p.group === 'adult_alpha' ? groupSizes.filter((z) => z.code !== 'XS' || p.dept === 'women') : p.group === 'kids_age' && p.kind === 'romper' ? groupSizes.slice(0, 5) : p.group === 'kids_age' ? groupSizes.slice(2) : groupSizes;
    const slug = slugify(`${p.brand} ${p.name}`);

    const product = await prisma.products.create({
      data: {
        vendor_id: vendors[p.vendor].id,
        category_id: cat.id,
        brand_id: brands.get(p.brand),
        department: p.dept,
        name: p.name,
        slug,
        short_description: `${p.material}. ${p.fit ? p.fit + ' fit.' : ''}`.trim(),
        description: DESCRIBE[p.kind],
        material: p.material,
        fit: p.fit,
        pattern: p.pattern,
        sleeve: p.sleeve,
        occasion: p.occasion,
        care_instructions: p.kind === 'saree' ? 'Dry clean only.' : 'Machine wash cold with like colours. Do not bleach. Tumble dry low. Warm iron on reverse.',
        size_group: p.group,
        attributes: { 'Country of Origin': 'India', ...(p.kind === 'saree' ? { 'Saree Length': '5.5 m + 0.8 m blouse' } : {}) },
        base_price: price,
        mrp,
        tax_pct: price > 1000 ? 12 : 5,
        hsn_code: p.kind === 'sneaker' ? '6404' : '6109',
        status: 'active',
        is_featured: !!p.featured,
        approved_by: admin.id,
        approved_at: new Date(),
        created_at: new Date(Date.now() - (SPECS.length - idx) * 36 * 3600 * 1000),
      },
    });

    const shots: { id: string; alt: string; color?: string }[] = (PHOTOS.products as Record<string, any[]>)[p.name] ?? [];
    for (const [k, ph] of shots.entries()) {
      await prisma.product_images.create({
        data: {
          product_id: product.id, color_id: ph.color && p.colors.includes(ph.color) ? colorId(ph.color) : null,
          url: unsplash(ph.id), thumbnail_url: unsplash(ph.id, 400), alt_text: `${p.name} - ${ph.alt}`, sort_order: k, is_primary: k === 0,
        },
      });
    }
    let sort = 10;
    for (const color of p.colors) {
      const views = p.kind === 'saree' ? ['front', 'detail'] : ['front', 'back', 'detail'];
      for (const [vi, view] of views.entries()) {
        await prisma.product_images.create({
          data: { product_id: product.id, color_id: colorId(color), url: `/img/${p.kind}/${hex(color)}/${view}.svg`, alt_text: `${p.name} in ${color} - ${view} view`, sort_order: sort++, is_primary: vi === 0 && !shots.length },
        });
      }
      for (const z of useSizes) {
        const stockRoll = rnd();
        const stock = stockRoll < 0.08 ? 0 : stockRoll < 0.18 ? between(1, 4) : between(8, 60);
        const bump = p.group === 'adult_numeric' && Number(z.code) >= 36 ? 100 : p.group === 'adult_alpha' && ['XXL', '3XL'].includes(z.code) ? 100 : 0;
        await prisma.product_variants.create({
          data: {
            product_id: product.id, color_id: colorId(color), size_id: z.id,
            sku: `${slugify(p.brand).slice(0, 3).toUpperCase()}-${String(idx + 1).padStart(3, '0')}-${hex(color).slice(0, 3)}-${z.code}`.replace(/[^A-Z0-9-]/gi, ''),
            price: price + bump, mrp: mrp + bump, stock_qty: stock, low_stock_threshold: 5,
            weight_grams: p.kind === 'sneaker' ? 900 : p.kind === 'jacket' ? 800 : 300,
          },
        });
      }
    }
    await prisma.$executeRaw`
      INSERT INTO shop.inventory_movements (variant_id, change_qty, reason, reference_type, created_by)
      SELECT id, stock_qty, 'restock', 'opening_stock', ${admin.id} FROM shop.product_variants WHERE product_id = ${product.id} AND stock_qty > 0`;

    // reviews
    const n = between(0, 6);
    const shuffled = [...reviewers].sort(() => rnd() - 0.5).slice(0, n);
    for (const r of shuffled) {
      const [rating, title, body] = pick(REVIEWS);
      await prisma.product_reviews.create({
        data: { product_id: product.id, user_id: r.id, rating, title, body, size_fit: rating === 2 ? 'runs_small' : pick(['true_to_size', 'true_to_size', 'runs_large']) as any,
          created_at: new Date(Date.now() - between(1, 60) * 24 * 3600 * 1000) },
      });
    }
    created++;
  }

  // ---------------------------------------------------------------- coupons
  const now = new Date();
  const later = new Date(Date.now() + 365 * 24 * 3600 * 1000);
  await prisma.coupons.createMany({
    data: [
      { code: 'WELCOME10', description: '10% off your first order (up to ₹300)', discount_type: 'percentage', discount_value: 10, max_discount: 300, min_order_amount: 999, per_user_limit: 1, valid_from: now, valid_to: later, created_by: admin.id },
      { code: 'FLAT200', description: '₹200 off on orders above ₹1,999', discount_type: 'flat', discount_value: 200, min_order_amount: 1999, per_user_limit: 3, valid_from: now, valid_to: later, created_by: admin.id },
      { code: 'LITTLE15', description: '15% off Little Ink Store items (up to ₹400)', discount_type: 'percentage', discount_value: 15, max_discount: 400, min_order_amount: 799, vendor_id: vendors[2].id, per_user_limit: 2, valid_from: now, valid_to: later, created_by: admin.id },
    ],
  });

  // ---------------------------------------------------------------- notification templates
  const T: [string, 'in_app' | 'push' | 'email', any, string, string][] = [
    ['WELCOME', 'in_app', 'account', 'Welcome to Ink & Cotton, {{name}}!', 'Use code WELCOME10 for 10% off your first order.'],
    ['WELCOME', 'email', 'account', 'Welcome to Ink & Cotton', 'Hi {{name}}, thanks for joining. Use WELCOME10 for 10% off your first order.'],
    ['ORDER_PLACED', 'in_app', 'order', 'Complete your payment', 'Order {{order_number}} ({{total}}) is waiting for payment.'],
    ['ORDER_CONFIRMED', 'in_app', 'order', 'Order confirmed', 'Your order {{order_number}} for {{total}} is confirmed. We will let you know when it ships.'],
    ['ORDER_CONFIRMED', 'push', 'order', 'Order confirmed 🎉', 'Order {{order_number}} for {{total}} is confirmed.'],
    ['ORDER_CONFIRMED', 'email', 'order', 'Your Ink & Cotton order {{order_number}}', 'Thanks for shopping with us. Your order total is {{total}}.'],
    ['ORDER_CANCELLED', 'in_app', 'order', 'Order cancelled', 'Order {{order_number}} has been cancelled. Any payment made will be refunded in 5-7 days.'],
    ['ORDER_SHIPPED', 'in_app', 'shipment', 'Your order has shipped', 'Order {{order_number}} is on its way. Tracking ID {{tracking_number}}.'],
    ['OUT_FOR_DELIVERY', 'in_app', 'shipment', 'Out for delivery today', '{{agent_name}} is delivering order {{order_number}}. Share OTP {{otp}} at delivery.'],
    ['ORDER_DELIVERED', 'in_app', 'shipment', 'Package delivered', 'Your package {{tracking_number}} from order {{order_number}} was delivered. Tell us how you like it!'],
    ['DELIVERY_FAILED', 'in_app', 'shipment', 'Delivery attempt failed', 'We could not deliver order {{order_number}}. We will try again tomorrow.'],
    ['PAYMENT_FAILED', 'in_app', 'payment', 'Payment failed', 'Payment for order {{order_number}} did not go through and the order was cancelled. Items are back in stock for you.'],
    ['LOW_STOCK', 'in_app', 'vendor', 'Low stock alert', '{{sku}} has only {{qty}} units left.'],
  ];
  await prisma.notification_templates.deleteMany({});
  await prisma.notification_templates.createMany({
    data: T.map(([code, channel, type, title_template, body_template]) => ({ code, channel, type, title_template, body_template })),
  });
  // keep the push templates from schema.sql for shipment events too
  await prisma.notification_templates.createMany({
    data: [
      { code: 'ORDER_SHIPPED', channel: 'push', type: 'shipment', title_template: 'Order shipped', body_template: 'Order {{order_number}} is on its way. Track: {{tracking_number}}' },
      { code: 'OUT_FOR_DELIVERY', channel: 'push', type: 'shipment', title_template: 'Out for delivery', body_template: '{{agent_name}} will deliver your order today. OTP: {{otp}}' },
      { code: 'ORDER_DELIVERED', channel: 'push', type: 'shipment', title_template: 'Delivered', body_template: 'Your order {{order_number}} was delivered.' },
    ],
  });

  await prisma.notifications.create({
    data: { user_id: customer.id, type: 'promotion', title: 'The Festive Edit is live', body: 'Kurtas, sarees and more. Use FLAT200 on orders above ₹1,999.', deep_link: '/shop/women/women-ethnic', delivery_status: 'delivered', sent_at: new Date() },
  });

  const counts = await prisma.$queryRaw<{ products: bigint; variants: bigint; images: bigint; reviews: bigint }[]>`
    SELECT (SELECT count(*) FROM shop.products) products, (SELECT count(*) FROM shop.product_variants) variants,
           (SELECT count(*) FROM shop.product_images) images, (SELECT count(*) FROM shop.product_reviews) reviews`;
  console.log(`Seeded ${created} products`, counts[0]);
  console.log('Logins (password Password@123): demo@inkandcotton.test (customer), vendor@inkandcotton.test, admin@inkandcotton.test, rider1@inkandcotton.test');
  return { products: created };
}

