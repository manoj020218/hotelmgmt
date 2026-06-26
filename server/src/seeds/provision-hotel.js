/**
 * provision-hotel.js — Create a new hotel + admin account
 *
 * Usage (on VPS):
 *   cd /root/projects/hotelqr/server
 *   node src/seeds/provision-hotel.js \
 *     --name "Hotel Sunrise" \
 *     --address "MG Road, Surat" \
 *     --phone "+91 9876543210" \
 *     --email "admin@hotelsunrise.com" \
 *     --password "Sunrise@2026" \
 *     --tables 12
 *
 * All flags except --name, --email, --password are optional.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')

const Hotel    = require('../models/Hotel')
const User     = require('../models/User')
const Table    = require('../models/Table')

function arg(flag, fallback = '') {
  const i = process.argv.indexOf(flag)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

async function run() {
  const hotelName   = arg('--name')
  const adminEmail  = arg('--email')
  const adminPass   = arg('--password')
  const address     = arg('--address', 'India')
  const phone       = arg('--phone', '')
  const tableCount  = parseInt(arg('--tables', '10'), 10)
  const kitchenPin  = arg('--kds-pin', '1234')
  const waiterPin   = arg('--waiter-pin', '5678')

  if (!hotelName || !adminEmail || !adminPass) {
    console.error('ERROR: --name, --email, and --password are required')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB')

  // Prevent duplicate admin email
  const existing = await User.findOne({ email: adminEmail })
  if (existing) {
    console.error(`ERROR: User with email ${adminEmail} already exists`)
    process.exit(1)
  }

  // Create hotel
  const hotel = await Hotel.create({
    name:    hotelName,
    address,
    phone,
    gstin:   '',
    gstEnabled:  false,
    cgstPercent: 9,
    sgstPercent: 9,
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

  // Create admin
  const adminHash = await bcrypt.hash(adminPass, 12)
  await User.create({
    hotelId:      hotel._id,
    name:         'Admin',
    email:        adminEmail,
    role:         'admin',
    passwordHash: adminHash,
    isActive:     true,
  })

  // Create KDS (kitchen) user with PIN
  const kdsHash = await bcrypt.hash(kitchenPin, 12)
  await User.create({
    hotelId:  hotel._id,
    name:     'KDS',
    role:     'kitchen',
    pin:      kdsHash,
    isActive: true,
  })

  // Create default waiter with PIN
  const waiterHash = await bcrypt.hash(waiterPin, 12)
  await User.create({
    hotelId:  hotel._id,
    name:     'Waiter 1',
    role:     'waiter',
    pin:      waiterHash,
    isActive: true,
  })

  // Create tables
  for (let i = 1; i <= tableCount; i++) {
    await Table.create({
      hotelId:     hotel._id,
      tableNumber: i,
      capacity:    4,
      status:      'available',
      qrToken:     uuidv4(),
    })
  }

  console.log('\n========================================')
  console.log(' Hotel provisioned successfully!')
  console.log('========================================')
  console.log(` Hotel Name : ${hotelName}`)
  console.log(` Hotel ID   : ${hotel._id}`)
  console.log(` Tables     : ${tableCount}`)
  console.log('\n --- Give these credentials to the client ---')
  console.log(` Admin URL  : https://hotelqr.admin.iotsoft.in`)
  console.log(` Admin Email: ${adminEmail}`)
  console.log(` Admin Pass : ${adminPass}`)
  console.log('\n --- KDS & Waiter (client can change from admin panel) ---')
  console.log(` Hotel ID   : ${hotel._id}  (needed for KDS/Waiter login)`)
  console.log(` KDS PIN    : ${kitchenPin}`)
  console.log(` Waiter PIN : ${waiterPin}`)
  console.log('========================================\n')

  await mongoose.disconnect()
  process.exit(0)
}

run().catch(err => { console.error(err); process.exit(1) })
