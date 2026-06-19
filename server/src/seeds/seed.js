require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const Hotel    = require('../models/Hotel');
const User     = require('../models/User');
const Table    = require('../models/Table');
const MenuItem = require('../models/MenuItem');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[Seed] Connected to MongoDB');

  // Wipe existing seed data
  await Promise.all([
    Hotel.deleteMany({}),
    User.deleteMany({}),
    Table.deleteMany({}),
    MenuItem.deleteMany({}),
  ]);
  console.log('[Seed] Cleared existing data');

  // ── Hotel ──────────────────────────────────────────────────
  const hotel = await Hotel.create({
    name: 'The Grand Spice',
    address: '12, MG Road, Bengaluru, Karnataka 560001',
    phone: '+91 98765 43210',
    gstin: '29AAPFU0939F1ZV',
    gstEnabled: true,
    cgstPercent: 9,
    sgstPercent: 9,
    upiId: 'grandspice@okaxis',
    settings: {
      tableVisibilityPublic: true,
      kdsEnabled: true,
      kitchenOpen: true,
      kitchenOpenTime: '10:00',
      kitchenCloseTime: '23:00',
      receiptFlow: 'both',
      autoWaiterAssign: true,
      orderModificationWindow: 5,
    },
    fcmTopics: {
      admin: 'hotel_admin',
      kitchen: 'hotel_kitchen',
    },
  });
  console.log('[Seed] Hotel created:', hotel.name);

  // ── Admin ──────────────────────────────────────────────────
  const admin = await User.create({
    hotelId: hotel._id,
    name: 'Rajesh Mehta',
    email: process.env.ADMIN_SEED_EMAIL || 'admin@hotel.com',
    passwordHash: process.env.ADMIN_SEED_PASSWORD || 'Admin@123',
    role: 'admin',
  });
  console.log('[Seed] Admin created:', admin.email);

  // ── Waiters ────────────────────────────────────────────────
  const waiterData = [
    { name: 'Ram Kumar',    phone: '9876543210', pin: '1111', stats: { totalServed: 1234, avgRating: 4.8, ratingCount: 234 } },
    { name: 'Suresh Yadav', phone: '9876543211', pin: '2222', stats: { totalServed: 987,  avgRating: 4.6, ratingCount: 198 } },
    { name: 'Priya Singh',  phone: '9876543212', pin: '3333', stats: { totalServed: 1456, avgRating: 4.9, ratingCount: 289 } },
  ];

  const waiters = await Promise.all(
    waiterData.map(w => User.create({ hotelId: hotel._id, role: 'waiter', ...w }))
  );
  console.log('[Seed] Waiters created:', waiters.map(w => w.name).join(', '));

  // ── Kitchen user ───────────────────────────────────────────
  const kitchen = await User.create({
    hotelId: hotel._id,
    name: 'Kitchen Station 1',
    phone: '9876543213',
    pin: '4444',
    role: 'kitchen',
  });
  console.log('[Seed] Kitchen user created:', kitchen.name);

  // ── Tables (12) ────────────────────────────────────────────
  const tableData = [
    { tableNumber: 1,  capacity: 2 },
    { tableNumber: 2,  capacity: 4 },
    { tableNumber: 3,  capacity: 2 },
    { tableNumber: 4,  capacity: 6 },
    { tableNumber: 5,  capacity: 4 },
    { tableNumber: 6,  capacity: 2 },
    { tableNumber: 7,  capacity: 4 },
    { tableNumber: 8,  capacity: 2 },
    { tableNumber: 9,  capacity: 6 },
    { tableNumber: 10, capacity: 4 },
    { tableNumber: 11, capacity: 2 },
    { tableNumber: 12, capacity: 4 },
  ];

  const tables = await Promise.all(
    tableData.map(t => Table.create({
      hotelId: hotel._id,
      qrToken: uuidv4(),
      ...t,
    }))
  );
  console.log('[Seed] Tables created:', tables.length);

  // ── Menu Items (10) ────────────────────────────────────────
  const menuData = [
    {
      name: 'Paneer Butter Masala', category: 'Mains', price: 320, isVeg: true, sortOrder: 1,
      description: 'Rich tomato-butter gravy with soft paneer cubes',
      customizationOptions: [
        { groupName: 'Spice Level', type: 'single', required: false, choices: ['Mild', 'Medium', 'Spicy'] },
        { groupName: 'Portion',     type: 'single', required: false, choices: ['Half', 'Full'] },
      ],
      tags: ['bestseller'],
      stats: { totalOrders: 234, avgRating: 4.8 },
    },
    {
      name: 'Dal Makhani', category: 'Mains', price: 280, isVeg: true, sortOrder: 2,
      description: 'Slow-cooked black lentils in creamy butter sauce',
      customizationOptions: [
        { groupName: 'Spice Level', type: 'single', required: false, choices: ['Mild', 'Medium'] },
        { groupName: 'Portion',     type: 'single', required: false, choices: ['Half', 'Full'] },
      ],
      tags: ['bestseller'],
      stats: { totalOrders: 189, avgRating: 4.7 },
    },
    {
      name: 'Chicken Tikka', category: 'Starters', price: 380, isVeg: false, sortOrder: 1,
      description: 'Tandoor-grilled chicken with mint chutney',
      customizationOptions: [
        { groupName: 'Spice Level', type: 'single', required: false, choices: ['Medium', 'Spicy', 'Extra Spicy'] },
      ],
      tags: ['bestseller', 'chef special'],
      stats: { totalOrders: 312, avgRating: 4.9 },
    },
    {
      name: 'Veg Spring Roll', category: 'Starters', price: 220, isVeg: true, sortOrder: 2,
      description: 'Crispy rolls with mixed vegetables and sauces',
      stats: { totalOrders: 145, avgRating: 4.5 },
    },
    {
      name: 'Butter Naan', category: 'Breads', price: 60, isVeg: true, sortOrder: 1,
      description: 'Soft leavened bread baked in tandoor',
      stats: { totalOrders: 456, avgRating: 4.6 },
    },
    {
      name: 'Mango Lassi', category: 'Drinks', price: 120, isVeg: true, sortOrder: 1,
      description: 'Chilled mango yogurt drink',
      customizationOptions: [
        { groupName: 'Sugar', type: 'single', required: false, choices: ['Normal', 'Less Sugar', 'No Sugar'] },
        { groupName: 'Ice',   type: 'single', required: false, choices: ['With Ice', 'No Ice'] },
      ],
      stats: { totalOrders: 278, avgRating: 4.8 },
    },
    {
      name: 'Masala Chai', category: 'Drinks', price: 60, isVeg: true, sortOrder: 2,
      description: 'Spiced Indian tea with milk',
      customizationOptions: [
        { groupName: 'Sugar', type: 'single', required: false, choices: ['Normal', 'Less Sugar', 'No Sugar'] },
        { groupName: 'Temp',  type: 'single', required: false, choices: ['Hot', 'Cold'] },
      ],
      stats: { totalOrders: 391, avgRating: 4.7 },
    },
    {
      name: 'Gulab Jamun', category: 'Desserts', price: 140, isVeg: true, sortOrder: 1,
      description: 'Soft milk solids dumplings in rose syrup',
      stats: { totalOrders: 167, avgRating: 4.9 },
    },
    {
      name: 'Fish Curry', category: 'Mains', price: 420, isVeg: false, available: false, sortOrder: 3,
      description: 'Coastal style fish in tangy coconut gravy',
      stats: { totalOrders: 98, avgRating: 4.6 },
    },
    {
      name: 'Veg Biryani', category: 'Mains', price: 290, isVeg: true, sortOrder: 4,
      description: 'Fragrant basmati rice with mixed vegetables and spices',
      customizationOptions: [
        { groupName: 'Spice Level', type: 'single', required: false, choices: ['Mild', 'Medium', 'Spicy'] },
        { groupName: 'Portion',     type: 'single', required: false, choices: ['Half', 'Full'] },
      ],
      tags: ['new'],
      stats: { totalOrders: 203, avgRating: 4.7 },
    },
  ];

  const menuItems = await Promise.all(
    menuData.map(item => MenuItem.create({ hotelId: hotel._id, ...item }))
  );
  console.log('[Seed] Menu items created:', menuItems.length);

  console.log('\n[Seed] ✅ Done!');
  console.log(`  Hotel ID : ${hotel._id}`);
  console.log(`  Admin    : ${admin.email} / ${process.env.ADMIN_SEED_PASSWORD || 'Admin@123'}`);
  console.log(`  Tables   : ${tables.length}`);
  console.log(`  Menu     : ${menuItems.length} items`);

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('[Seed] Fatal error:', err);
  process.exit(1);
});
