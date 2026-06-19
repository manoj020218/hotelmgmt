require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')

const Hotel    = require('../models/Hotel')
const User     = require('../models/User')
const Table    = require('../models/Table')
const MenuItem = require('../models/MenuItem')

async function run() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected to MongoDB')

  const existingHotel = await Hotel.findOne()
  if (existingHotel) {
    console.log('Hotel already exists — skipping seed. Delete the hotel document to re-seed.')
    process.exit(0)
  }

  const hotel = await Hotel.create({
    name:       process.env.HOTEL_NAME || 'My Hotel',
    address:    process.env.HOTEL_ADDRESS || '123 Main St',
    phone:      process.env.HOTEL_PHONE || '+91 9000000000',
    gstin:      '',
    gstEnabled: false,
    cgstPercent: 9,
    sgstPercent: 9,
    upiId:      process.env.HOTEL_UPI_ID || 'hotel@okaxis',
    settings: {
      tableVisibilityPublic:   false,
      kdsEnabled:              true,
      kitchenOpen:             true,
      kitchenOpenTime:         '10:00',
      kitchenCloseTime:        '23:00',
      receiptFlow:             'customer',
      autoWaiterAssign:        true,
      orderModificationWindow: 5,
    },
  })
  console.log(`Hotel created: ${hotel.name} (${hotel._id})`)

  const adminEmail    = process.env.ADMIN_SEED_EMAIL    || 'admin@hotel.com'
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'Admin@123'
  const adminHash = await bcrypt.hash(adminPassword, 12)
  const admin = await User.create({
    hotelId:      hotel._id,
    name:         'Admin',
    email:        adminEmail,
    role:         'admin',
    passwordHash: adminHash,
    isActive:     true,
  })
  console.log(`Admin created: ${adminEmail}`)

  const kitchenPin  = process.env.KITCHEN_PIN  || '2222'
  const kitchenHash = await bcrypt.hash(kitchenPin, 12)
  await User.create({
    hotelId:      hotel._id,
    name:         'Kitchen',
    role:         'kitchen',
    pin:          kitchenHash,
    isActive:     true,
  })
  console.log('Kitchen user created (pin: ' + kitchenPin + ')')

  for (let i = 1; i <= 10; i++) {
    await Table.create({
      hotelId:     hotel._id,
      tableNumber: i,
      capacity:    4,
      status:      'available',
      qrToken:     uuidv4(),
    })
  }
  console.log('10 tables created')

  const menuItems = [
    { name: 'Paneer Butter Masala', category: 'Mains',    price: 320, isVeg: true  },
    { name: 'Dal Makhani',          category: 'Mains',    price: 280, isVeg: true  },
    { name: 'Chicken Tikka',        category: 'Starters', price: 360, isVeg: false },
    { name: 'Butter Naan',          category: 'Breads',   price: 60,  isVeg: true  },
    { name: 'Masala Chai',          category: 'Drinks',   price: 40,  isVeg: true  },
    { name: 'Gulab Jamun',          category: 'Desserts', price: 120, isVeg: true  },
  ]
  for (const item of menuItems) {
    await MenuItem.create({ hotelId: hotel._id, ...item, available: true })
  }
  console.log(`${menuItems.length} menu items created`)

  console.log('\nProduction seed complete.')
  console.log(`Hotel ID: ${hotel._id}`)
  console.log(`Admin: ${adminEmail} / ${adminPassword}`)
  process.exit(0)
}

run().catch(err => { console.error(err); process.exit(1) })
