import { useState, useEffect, useRef } from "react";

// ============================================================
// DESIGN SYSTEM
// ============================================================
const theme = {
  bg: "#0A0A0F",
  bgCard: "#13131A",
  bgElevated: "#1C1C27",
  bgHover: "#22222F",
  accent: "#F5A623",
  accentSoft: "rgba(245,166,35,0.12)",
  accentBorder: "rgba(245,166,35,0.3)",
  green: "#22C55E",
  greenSoft: "rgba(34,197,94,0.12)",
  red: "#EF4444",
  redSoft: "rgba(239,68,68,0.12)",
  blue: "#3B82F6",
  blueSoft: "rgba(59,130,246,0.12)",
  yellow: "#EAB308",
  yellowSoft: "rgba(234,179,8,0.12)",
  purple: "#A855F7",
  purpleSoft: "rgba(168,85,247,0.12)",
  text: "#F0F0F8",
  textMuted: "#8888AA",
  textDim: "#55556A",
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.12)",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    background: ${theme.bg};
    color: ${theme.text};
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: ${theme.bg}; }
  ::-webkit-scrollbar-thumb { background: ${theme.bgElevated}; border-radius: 2px; }

  .syne { font-family: 'Syne', sans-serif; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse-ring {
    0% { box-shadow: 0 0 0 0 rgba(245,166,35,0.4); }
    70% { box-shadow: 0 0 0 10px rgba(245,166,35,0); }
    100% { box-shadow: 0 0 0 0 rgba(245,166,35,0); }
  }
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes blink {
    0%,100% { opacity:1; } 50% { opacity:0.3; }
  }
  @keyframes slideIn {
    from { opacity:0; transform:translateX(20px); }
    to { opacity:1; transform:translateX(0); }
  }

  .fade-up { animation: fadeUp 0.4s ease forwards; }
  .pulse-ring { animation: pulse-ring 2s infinite; }

  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 10px 20px; border-radius: 10px; border: none;
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
    cursor: pointer; transition: all 0.2s; outline: none;
    white-space: nowrap;
  }
  .btn-primary {
    background: ${theme.accent}; color: #0A0A0F;
    font-weight: 700;
  }
  .btn-primary:hover { background: #f0b83d; transform: translateY(-1px); }
  .btn-ghost {
    background: transparent; color: ${theme.textMuted};
    border: 1px solid ${theme.border};
  }
  .btn-ghost:hover { background: ${theme.bgHover}; color: ${theme.text}; }
  .btn-danger {
    background: ${theme.redSoft}; color: ${theme.red};
    border: 1px solid rgba(239,68,68,0.2);
  }
  .btn-danger:hover { background: rgba(239,68,68,0.2); }
  .btn-success {
    background: ${theme.greenSoft}; color: ${theme.green};
    border: 1px solid rgba(34,197,94,0.2);
  }
  .btn-success:hover { background: rgba(34,197,94,0.2); }
  .btn-sm { padding: 7px 14px; font-size: 13px; }
  .btn-lg { padding: 14px 28px; font-size: 16px; border-radius: 14px; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }

  .card {
    background: ${theme.bgCard};
    border: 1px solid ${theme.border};
    border-radius: 16px;
    padding: 20px;
  }
  .card-elevated {
    background: ${theme.bgElevated};
    border: 1px solid ${theme.borderStrong};
    border-radius: 16px;
  }

  .badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px; border-radius: 20px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.03em;
    text-transform: uppercase;
  }
  .badge-green { background: ${theme.greenSoft}; color: ${theme.green}; }
  .badge-red { background: ${theme.redSoft}; color: ${theme.red}; }
  .badge-yellow { background: ${theme.yellowSoft}; color: ${theme.yellow}; }
  .badge-blue { background: ${theme.blueSoft}; color: ${theme.blue}; }
  .badge-accent { background: ${theme.accentSoft}; color: ${theme.accent}; }
  .badge-purple { background: ${theme.purpleSoft}; color: ${theme.purple}; }

  .input {
    width: 100%; background: ${theme.bgElevated}; border: 1px solid ${theme.border};
    color: ${theme.text}; padding: 11px 14px; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none;
    transition: border-color 0.2s;
  }
  .input:focus { border-color: ${theme.accent}; }
  .input::placeholder { color: ${theme.textDim}; }

  .tag {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 10px; border-radius: 6px;
    font-size: 12px; font-weight: 500;
    background: ${theme.bgElevated}; color: ${theme.textMuted};
    border: 1px solid ${theme.border}; cursor: pointer;
    transition: all 0.15s;
  }
  .tag.active { background: ${theme.accentSoft}; color: ${theme.accent}; border-color: ${theme.accentBorder}; }
  .tag:hover:not(.active) { border-color: ${theme.borderStrong}; color: ${theme.text}; }

  .live-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: ${theme.green}; display: inline-block;
    animation: blink 1.5s infinite;
  }

  .tab-bar {
    display: flex; gap: 2px;
    background: ${theme.bgElevated}; padding: 4px; border-radius: 12px;
  }
  .tab-btn {
    flex: 1; padding: 8px 16px; border-radius: 9px; border: none;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all 0.2s; background: transparent;
    color: ${theme.textMuted};
  }
  .tab-btn.active { background: ${theme.bgCard}; color: ${theme.text}; }

  .progress-bar {
    height: 4px; border-radius: 2px; background: ${theme.bgElevated};
    overflow: hidden;
  }
  .progress-fill {
    height: 100%; border-radius: 2px; background: ${theme.accent};
    transition: width 0.5s ease;
  }

  .star { color: ${theme.accent}; font-size: 16px; }
  .star-empty { color: ${theme.textDim}; font-size: 16px; }

  .notification-dot {
    position: absolute; top: -2px; right: -2px;
    width: 8px; height: 8px; border-radius: 50%;
    background: ${theme.red}; border: 2px solid ${theme.bg};
  }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }

  select.input { appearance: none; }

  .toggle {
    position: relative; width: 44px; height: 24px;
    background: ${theme.bgElevated}; border-radius: 12px;
    cursor: pointer; transition: background 0.2s;
    border: 1px solid ${theme.border};
    flex-shrink: 0;
  }
  .toggle.on { background: ${theme.green}; border-color: ${theme.green}; }
  .toggle::after {
    content: ''; position: absolute; top: 2px; left: 2px;
    width: 18px; height: 18px; border-radius: 50%;
    background: white; transition: transform 0.2s;
  }
  .toggle.on::after { transform: translateX(20px); }

  .kds-card {
    background: ${theme.bgCard};
    border-radius: 14px;
    border-left: 4px solid ${theme.green};
    padding: 16px;
    animation: slideIn 0.3s ease forwards;
  }
  .kds-card.yellow { border-left-color: ${theme.yellow}; }
  .kds-card.red { border-left-color: ${theme.red}; }

  .table-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 10px;
  }
  .table-cell {
    aspect-ratio: 1; border-radius: 12px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 4px; cursor: pointer; transition: all 0.2s;
    border: 2px solid transparent; font-size: 12px; font-weight: 600;
  }
  .table-cell:hover { transform: scale(1.05); }
  .table-cell.available { background: ${theme.greenSoft}; border-color: rgba(34,197,94,0.3); color: ${theme.green}; }
  .table-cell.occupied { background: ${theme.redSoft}; border-color: rgba(239,68,68,0.3); color: ${theme.red}; }
  .table-cell.reserved { background: ${theme.yellowSoft}; border-color: rgba(234,179,8,0.3); color: ${theme.yellow}; }
  .table-cell.blocked { background: ${theme.bgElevated}; border-color: ${theme.border}; color: ${theme.textDim}; }

  .metric-card {
    background: ${theme.bgCard};
    border: 1px solid ${theme.border};
    border-radius: 16px; padding: 20px;
    position: relative; overflow: hidden;
  }
  .metric-card::before {
    content: ''; position: absolute; top: 0; right: 0;
    width: 80px; height: 80px; border-radius: 0 16px 0 80px;
    opacity: 0.06;
  }
  .metric-card.accent::before { background: ${theme.accent}; }
  .metric-card.green::before { background: ${theme.green}; }
  .metric-card.blue::before { background: ${theme.blue}; }
  .metric-card.purple::before { background: ${theme.purple}; }

  .sparkline {
    height: 40px; display: flex; align-items: flex-end; gap: 3px;
  }
  .spark-bar {
    flex: 1; border-radius: 3px 3px 0 0;
    background: ${theme.accentSoft}; transition: height 0.3s;
    min-height: 4px;
  }
  .spark-bar.highlight { background: ${theme.accent}; }

  .order-track {
    display: flex; align-items: center; gap: 0;
  }
  .track-step {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    flex: 1;
  }
  .track-dot {
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; position: relative; z-index: 1;
  }
  .track-dot.done { background: ${theme.green}; color: white; }
  .track-dot.active { background: ${theme.accent}; color: #0A0A0F; animation: pulse-ring 2s infinite; }
  .track-dot.pending { background: ${theme.bgElevated}; color: ${theme.textDim}; border: 2px solid ${theme.border}; }
  .track-line {
    flex: 1; height: 2px; margin-bottom: 22px;
  }
  .track-line.done { background: ${theme.green}; }
  .track-line.pending { background: ${theme.border}; }

  .receipt-style {
    background: white; color: #1a1a1a; border-radius: 12px;
    padding: 24px; font-family: 'Courier New', monospace;
    max-width: 320px;
  }
  .receipt-divider {
    border: none; border-top: 2px dashed #ddd; margin: 12px 0;
  }

  .chart-bar-h {
    display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
  }
  .chart-bar-fill {
    height: 28px; border-radius: 6px; background: ${theme.accentSoft};
    border: 1px solid ${theme.accentBorder};
    display: flex; align-items: center; padding: 0 10px;
    font-size: 12px; color: ${theme.accent}; font-weight: 600;
    transition: width 1s ease;
    white-space: nowrap; overflow: hidden;
  }

  .nav-pill {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: 9px; cursor: pointer;
    font-size: 13px; font-weight: 500; transition: all 0.15s;
    color: ${theme.textMuted};
  }
  .nav-pill:hover { background: ${theme.bgHover}; color: ${theme.text}; }
  .nav-pill.active { background: ${theme.accentSoft}; color: ${theme.accent}; }

  .phone-frame {
    width: 390px; min-height: 700px;
    background: ${theme.bg}; border-radius: 44px;
    border: 3px solid ${theme.borderStrong};
    overflow: hidden; position: relative;
    box-shadow: 0 40px 80px rgba(0,0,0,0.6);
  }
  .phone-notch {
    width: 120px; height: 30px; background: #000;
    border-radius: 0 0 20px 20px; margin: 0 auto;
    position: relative; z-index: 10;
  }

  .waiter-order-card {
    background: ${theme.bgCard}; border: 1px solid ${theme.border};
    border-radius: 14px; padding: 16px; cursor: pointer;
    transition: all 0.2s; animation: fadeUp 0.3s ease forwards;
  }
  .waiter-order-card:hover { border-color: ${theme.accentBorder}; background: ${theme.bgElevated}; }

  .menu-item-card {
    background: ${theme.bgCard}; border: 1px solid ${theme.border};
    border-radius: 14px; overflow: hidden; transition: all 0.2s;
    cursor: pointer;
  }
  .menu-item-card:hover { border-color: ${theme.accentBorder}; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }

  .qty-control {
    display: flex; align-items: center; gap: 8px;
  }
  .qty-btn {
    width: 28px; height: 28px; border-radius: 8px; border: 1px solid ${theme.border};
    background: ${theme.bgElevated}; color: ${theme.text}; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; transition: all 0.15s;
  }
  .qty-btn:hover { background: ${theme.accentSoft}; border-color: ${theme.accentBorder}; color: ${theme.accent}; }

  .floating-cart {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: ${theme.accent}; color: #0A0A0F;
    padding: 16px 28px; border-radius: 20px;
    display: flex; align-items: center; gap: 12px;
    font-weight: 700; font-size: 15px;
    box-shadow: 0 8px 32px rgba(245,166,35,0.4);
    cursor: pointer; transition: all 0.2s; z-index: 100;
    white-space: nowrap;
  }
  .floating-cart:hover { transform: translateX(-50%) translateY(-2px); box-shadow: 0 12px 40px rgba(245,166,35,0.5); }

  .feedback-star {
    font-size: 32px; cursor: pointer; transition: transform 0.15s;
    filter: grayscale(1); opacity: 0.4;
  }
  .feedback-star.active { filter: none; opacity: 1; transform: scale(1.15); }
  .feedback-star:hover { transform: scale(1.2); filter: none; opacity: 0.8; }

  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(4px); z-index: 200;
    display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .modal {
    background: ${theme.bgCard}; border: 1px solid ${theme.borderStrong};
    border-radius: 20px; padding: 28px; width: 100%; max-width: 480px;
    animation: fadeUp 0.3s ease;
  }

  @media (max-width: 768px) {
    .grid-2 { grid-template-columns: 1fr; }
    .grid-3 { grid-template-columns: 1fr 1fr; }
    .grid-4 { grid-template-columns: 1fr 1fr; }
  }
`;

// ============================================================
// DUMMY DATA
// ============================================================
const MENU = [
  { id: 1, name: "Paneer Butter Masala", cat: "Mains", price: 320, emoji: "🍛", available: true, veg: true, spice: ["Mild","Medium","Spicy"], portion: ["Half","Full"], desc: "Rich tomato-butter gravy with soft paneer cubes", rating: 4.8, orders: 234 },
  { id: 2, name: "Dal Makhani", cat: "Mains", price: 280, emoji: "🫕", available: true, veg: true, spice: ["Mild","Medium"], portion: ["Half","Full"], desc: "Slow-cooked black lentils in creamy butter sauce", rating: 4.7, orders: 189 },
  { id: 3, name: "Chicken Tikka", cat: "Starters", price: 380, emoji: "🍗", available: true, veg: false, spice: ["Medium","Spicy","Extra Spicy"], desc: "Tandoor-grilled chicken with mint chutney", rating: 4.9, orders: 312 },
  { id: 4, name: "Veg Spring Roll", cat: "Starters", price: 220, emoji: "🥢", available: true, veg: true, desc: "Crispy rolls with mixed vegetables and sauces", rating: 4.5, orders: 145 },
  { id: 5, name: "Butter Naan", cat: "Breads", price: 60, emoji: "🫓", available: true, veg: true, desc: "Soft leavened bread baked in tandoor", rating: 4.6, orders: 456 },
  { id: 6, name: "Mango Lassi", cat: "Drinks", price: 120, emoji: "🥭", available: true, veg: true, sugar: ["Normal","Less Sugar","No Sugar"], ice: ["With Ice","No Ice"], desc: "Chilled mango yogurt drink", rating: 4.8, orders: 278 },
  { id: 7, name: "Masala Chai", cat: "Drinks", price: 60, emoji: "☕", available: true, veg: true, sugar: ["Normal","Less Sugar","No Sugar"], temp: ["Hot","Cold"], desc: "Spiced Indian tea with milk", rating: 4.7, orders: 391 },
  { id: 8, name: "Gulab Jamun", cat: "Desserts", price: 140, emoji: "🍮", available: true, veg: true, desc: "Soft milk solids dumplings in rose syrup", rating: 4.9, orders: 167 },
  { id: 9, name: "Fish Curry", cat: "Mains", price: 420, emoji: "🐟", available: false, veg: false, desc: "Coastal style fish in tangy coconut gravy", rating: 4.6, orders: 98 },
  { id: 10, name: "Veg Biryani", cat: "Mains", price: 290, emoji: "🍚", available: true, veg: true, spice: ["Mild","Medium","Spicy"], portion: ["Half","Full"], desc: "Fragrant basmati rice with mixed vegetables and spices", rating: 4.7, orders: 203 },
];

const ORDERS = [
  { id: "ORD-001", table: 3, items: [{name:"Paneer Butter Masala",qty:1,price:320},{name:"Butter Naan",qty:2,price:120},{name:"Mango Lassi",qty:2,price:240}], status: "served", waiter: "Ram Kumar", time: "12:34 PM", total: 680, kdsStatus: "ready", payStatus: "paid", payMethod: "UPI" },
  { id: "ORD-002", table: 7, items: [{name:"Chicken Tikka",qty:1,price:380},{name:"Veg Spring Roll",qty:2,price:440},{name:"Masala Chai",qty:3,price:180}], status: "preparing", waiter: "Suresh Yadav", time: "12:41 PM", total: 1000, kdsStatus: "accepted", payStatus: "pending" },
  { id: "ORD-003", table: 2, items: [{name:"Dal Makhani",qty:1,price:280},{name:"Butter Naan",qty:3,price:180},{name:"Gulab Jamun",qty:2,price:280}], status: "placed", waiter: "Priya Singh", time: "12:48 PM", total: 740, kdsStatus: "new", payStatus: "pending" },
  { id: "ORD-004", table: 5, items: [{name:"Veg Biryani",qty:2,price:580},{name:"Mango Lassi",qty:2,price:240}], status: "assigned", waiter: "Ram Kumar", time: "12:52 PM", total: 820, kdsStatus: "ready", payStatus: "pending" },
  { id: "ORD-005", table: 1, items: [{name:"Chicken Tikka",qty:2,price:760},{name:"Masala Chai",qty:2,price:120}], status: "payment", waiter: "Suresh Yadav", time: "12:28 PM", total: 880, kdsStatus: "ready", payStatus: "pending" },
];

const WAITERS = [
  { id: 1, name: "Ram Kumar", phone: "98765-43210", available: true, activeOrders: 2, avgRating: 4.8, totalServed: 1234, emoji: "👨‍🍳" },
  { id: 2, name: "Suresh Yadav", phone: "98765-43211", available: true, activeOrders: 2, avgRating: 4.6, totalServed: 987, emoji: "👨‍🍳" },
  { id: 3, name: "Priya Singh", phone: "98765-43212", available: true, activeOrders: 1, avgRating: 4.9, totalServed: 1456, emoji: "👩‍🍳" },
  { id: 4, name: "Amit Sharma", phone: "98765-43213", available: false, activeOrders: 0, avgRating: 4.5, totalServed: 756, emoji: "👨‍🍳" },
];

const TABLES = [
  { id: 1, num: 1, cap: 2, status: "occupied" }, { id: 2, num: 2, cap: 4, status: "occupied" },
  { id: 3, num: 3, cap: 2, status: "available" }, { id: 4, num: 4, cap: 6, status: "reserved" },
  { id: 5, num: 5, cap: 4, status: "occupied" }, { id: 6, num: 6, cap: 2, status: "available" },
  { id: 7, num: 7, cap: 4, status: "occupied" }, { id: 8, num: 8, cap: 2, status: "available" },
  { id: 9, num: 9, cap: 6, status: "available" }, { id: 10, num: 10, cap: 4, status: "blocked" },
  { id: 11, num: 11, cap: 2, status: "reserved" }, { id: 12, num: 12, cap: 4, status: "available" },
];

const ANALYTICS = {
  revenue: [42000, 38000, 51000, 47000, 62000, 58000, 71000],
  days: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
  topItems: [
    { name: "Chicken Tikka", revenue: 18240, orders: 48 },
    { name: "Paneer Butter Masala", revenue: 14880, orders: 46.5 },
    { name: "Veg Biryani", revenue: 11600, orders: 40 },
    { name: "Mango Lassi", revenue: 8400, orders: 35 },
    { name: "Masala Chai", revenue: 5880, orders: 28 },
  ],
  peakHours: [
    { hour: "12 PM", pct: 95 }, { hour: "1 PM", pct: 88 }, { hour: "7 PM", pct: 100 },
    { hour: "8 PM", pct: 82 }, { hour: "2 PM", pct: 45 }, { hour: "6 PM", pct: 60 },
  ],
  payMethods: [{ label: "UPI/GPay", pct: 62, color: theme.blue }, { label: "Cash", pct: 28, color: theme.green }, { label: "Card", pct: 10, color: theme.purple }],
};

// ============================================================
// SMALL COMPONENTS
// ============================================================
const Icon = ({ name, size = 16 }) => {
  const icons = {
    menu: "☰", home: "⌂", orders: "📋", kitchen: "👨‍🍳", tables: "🪑",
    waiter: "🙋", analytics: "📊", settings: "⚙️", qr: "◫", logout: "→",
    plus: "+", minus: "−", check: "✓", x: "✕", star: "★", bell: "🔔",
    cart: "🛒", pay: "💳", upi: "📱", cash: "💵", card: "💳",
    time: "🕐", table: "🪑", feedback: "⭐", print: "🖨️", download: "⬇",
    eye: "👁", edit: "✏️", trash: "🗑", toggle: "◉", refresh: "↺",
    arrow: "→", back: "←", up: "↑", down: "↓", dot: "•",
    fire: "🔥", veg: "🟢", nonveg: "🔴", spice: "🌶️", info: "ℹ",
    phone: "📞", whatsapp: "💬", gpay: "G", phonepay: "P",
    chef: "👨‍🍳", waiter2: "🧑‍🍽️", scan: "⬚", lock: "🔒",
  };
  return <span style={{ fontSize: size }}>{icons[name] || "•"}</span>;
};

const Toggle = ({ on, onToggle }) => (
  <div className={`toggle ${on ? "on" : ""}`} onClick={onToggle} />
);

const Stars = ({ rating, size = 14 }) => (
  <span style={{ fontSize: size }}>
    {"★".repeat(Math.floor(rating))}{"☆".repeat(5 - Math.floor(rating))}
    <span style={{ color: theme.accent }}>{"★".repeat(Math.floor(rating))}</span>
  </span>
);

const StatusBadge = ({ status }) => {
  const map = {
    placed: ["blue", "Placed"],
    assigned: ["accent", "Assigned"],
    preparing: ["yellow", "Preparing"],
    served: ["green", "Served"],
    rejected: ["red", "Rejected"],
    payment: ["purple", "Awaiting Payment"],
    paid: ["green", "Paid"],
    available: ["green", "Available"],
    occupied: ["red", "Occupied"],
    reserved: ["yellow", "Reserved"],
    blocked: ["", "Blocked"],
    new: ["blue", "New"],
    accepted: ["yellow", "In Kitchen"],
    ready: ["green", "Ready"],
  };
  const [color, label] = map[status] || ["", status];
  return <span className={`badge badge-${color}`}>{label}</span>;
};

// ============================================================
// CUSTOMER PWA SCREENS
// ============================================================
function CustomerApp() {
  const [screen, setScreen] = useState("menu");
  const [cart, setCart] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [category, setCategory] = useState("All");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [waiterName] = useState("Ram Kumar");
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [ratings, setRatings] = useState({ waiter: 0, food: 0, overall: 0 });
  const [showPayModal, setShowPayModal] = useState(false);
  const [payDone, setPayDone] = useState(false);
  const [trackStep, setTrackStep] = useState(1);

  const cats = ["All", "Starters", "Mains", "Breads", "Drinks", "Desserts"];
  const filtered = category === "All" ? MENU.filter(i => i.available) : MENU.filter(i => i.cat === category && i.available);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const addToCart = (item) => {
    setCart(c => {
      const ex = c.find(i => i.id === item.id);
      if (ex) return c.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...c, { ...item, qty: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCart(c => {
      const ex = c.find(i => i.id === id);
      if (ex?.qty === 1) return c.filter(i => i.id !== id);
      return c.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i);
    });
  };

  useEffect(() => {
    if (orderPlaced && trackStep < 4) {
      const t = setTimeout(() => setTrackStep(s => s + 1), 3000);
      return () => clearTimeout(t);
    }
  }, [orderPlaced, trackStep]);

  const gst = Math.round(cartTotal * 0.09);
  const finalTotal = cartTotal + gst * 2;

  return (
    <div style={{ background: theme.bg, minHeight: "100vh", maxWidth: 430, margin: "0 auto", position: "relative", paddingBottom: cartCount > 0 && screen === "menu" ? 100 : 20 }}>
      {/* Header */}
      <div style={{ background: theme.bgCard, borderBottom: `1px solid ${theme.border}`, padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: theme.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏨</div>
        <div>
          <div className="syne" style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>The Grand Spice</div>
          <div style={{ fontSize: 11, color: theme.green, display: "flex", alignItems: "center", gap: 4 }}>
            <span className="live-dot" style={{ width: 6, height: 6 }} /> Table 7 • Kitchen Open
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {["menu","cart","status","feedback"].map(s => (
            <button key={s} onClick={() => setScreen(s)}
              style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
                background: screen === s ? theme.accentSoft : "transparent",
                color: screen === s ? theme.accent : theme.textMuted,
                fontFamily: "'DM Sans', sans-serif" }}>
              {s === "menu" ? "Menu" : s === "cart" ? `Cart${cartCount > 0 ? ` (${cartCount})` : ""}` : s === "status" ? "Order" : "Rate"}
            </button>
          ))}
        </div>
      </div>

      {/* MENU SCREEN */}
      {screen === "menu" && (
        <div style={{ padding: "16px 16px 0" }}>
          {/* Repeat order banner */}
          <div style={{ background: theme.accentSoft, border: `1px solid ${theme.accentBorder}`, borderRadius: 14, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>🔁</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: theme.accent }}>Welcome back!</div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>Last visit: Paneer Butter Masala, Naan × 2</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => { addToCart(MENU[0]); addToCart(MENU[4]); }}>Repeat</button>
          </div>

          {/* Categories */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
            {cats.map(c => (
              <button key={c} className={`tag ${category === c ? "active" : ""}`} onClick={() => setCategory(c)} style={{ flexShrink: 0 }}>{c}</button>
            ))}
          </div>

          {/* Menu items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((item, i) => {
              const inCart = cart.find(c => c.id === item.id);
              return (
                <div key={item.id} className="menu-item-card" style={{ animationDelay: `${i * 0.05}s` }}
                  onClick={() => setSelectedItem(item)}>
                  <div style={{ display: "flex", gap: 0 }}>
                    <div style={{ width: 100, height: 90, background: theme.bgElevated, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, flexShrink: 0 }}>
                      {item.emoji}
                    </div>
                    <div style={{ padding: "12px 14px", flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 10 }}>{item.veg ? "🟢" : "🔴"}</span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{item.name}</span>
                          </div>
                          <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>{item.desc}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: theme.accent }}>₹{item.price}</span>
                            <span style={{ fontSize: 11, color: theme.textDim }}>★ {item.rating}</span>
                          </div>
                        </div>
                        <div onClick={e => { e.stopPropagation(); addToCart(item); }}
                          style={{ width: 32, height: 32, borderRadius: 8, background: inCart ? theme.accent : theme.accentSoft,
                            border: `1px solid ${theme.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", fontSize: 18, fontWeight: 700, color: inCart ? "#0A0A0F" : theme.accent, flexShrink: 0 }}>
                          {inCart ? inCart.qty : "+"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CART SCREEN */}
      {screen === "cart" && (
        <div style={{ padding: 16 }}>
          <div className="syne" style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Your Order</div>
          {cart.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: theme.textMuted }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
              <div>Cart is empty</div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setScreen("menu")}>Browse Menu</button>
            </div>
          ) : (
            <>
              {/* Special request chips */}
              <div style={{ background: theme.accentSoft, border: `1px solid ${theme.accentBorder}`, borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: theme.accent }}>
                💬 Special instructions added to your items
              </div>
              {cart.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: 28 }}>{item.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted }}>₹{item.price} each</div>
                  </div>
                  <div className="qty-control">
                    <button className="qty-btn" onClick={() => removeFromCart(item.id)}>−</button>
                    <span style={{ minWidth: 20, textAlign: "center", fontWeight: 700 }}>{item.qty}</span>
                    <button className="qty-btn" onClick={() => addToCart(item)}>+</button>
                  </div>
                  <div style={{ fontWeight: 700, color: theme.accent, minWidth: 60, textAlign: "right" }}>₹{item.price * item.qty}</div>
                </div>
              ))}

              {/* Bill summary */}
              <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 16, marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14, color: theme.textMuted }}>
                  <span>Subtotal</span><span style={{ color: theme.text }}>₹{cartTotal}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14, color: theme.textMuted }}>
                  <span>CGST (9%)</span><span style={{ color: theme.text }}>₹{gst}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 14, color: theme.textMuted }}>
                  <span>SGST (9%)</span><span style={{ color: theme.text }}>₹{gst}</span>
                </div>
                <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 12, display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700 }}>
                  <span>Total</span><span style={{ color: theme.accent }}>₹{finalTotal}</span>
                </div>
              </div>

              <button className="btn btn-primary btn-lg" style={{ width: "100%", justifyContent: "center", marginTop: 16 }}
                onClick={() => { setOrderPlaced(true); setTrackStep(1); setScreen("status"); }}>
                Place Order 🛎️
              </button>
            </>
          )}
        </div>
      )}

      {/* STATUS SCREEN */}
      {screen === "status" && (
        <div style={{ padding: 16 }}>
          {!orderPlaced ? (
            <div style={{ textAlign: "center", padding: 60, color: theme.textMuted }}>
              <div style={{ fontSize: 48 }}>📋</div>
              <div style={{ marginTop: 12 }}>No active order</div>
            </div>
          ) : (
            <>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🛎️</div>
                <div className="syne" style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Order #ORD-007</div>
                <span className="badge badge-accent" style={{ fontSize: 13 }}>Table 7</span>
              </div>

              {/* Track */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="syne" style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: theme.textMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}>Order Progress</div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  {["Placed","Assigned","Preparing","Ready","Served"].map((step, i) => (
                    <>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: i < 4 ? "none" : 1 }}>
                        <div className={`track-dot ${i < trackStep ? "done" : i === trackStep ? "active" : "pending"}`}>
                          {i < trackStep ? "✓" : i + 1}
                        </div>
                        <div style={{ fontSize: 10, color: i < trackStep ? theme.green : i === trackStep ? theme.accent : theme.textDim, textAlign: "center", whiteSpace: "nowrap" }}>{step}</div>
                      </div>
                      {i < 4 && <div className={`track-line ${i < trackStep ? "done" : "pending"}`} style={{ flex: 1, height: 2, marginBottom: 22 }} />}
                    </>
                  ))}
                </div>
              </div>

              {/* Waiter assigned */}
              {trackStep >= 2 && (
                <div style={{ background: theme.greenSoft, border: `1px solid rgba(34,197,94,0.2)`, borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", gap: 12, alignItems: "center", animation: "fadeUp 0.4s ease" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: theme.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>👨‍🍳</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: theme.green }}>{waiterName} is serving you</div>
                    <div style={{ fontSize: 12, color: theme.textMuted }}>★ 4.8 rating • Assigned just now</div>
                  </div>
                </div>
              )}

              {/* Items summary */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="syne" style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: theme.textMuted, textTransform: "uppercase" }}>Your Items</div>
                {cart.map(item => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
                    <span>{item.emoji} {item.name} × {item.qty}</span>
                    <span style={{ color: theme.accent, fontWeight: 600 }}>₹{item.price * item.qty}</span>
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 10, marginTop: 4, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                  <span>Total</span><span style={{ color: theme.accent }}>₹{finalTotal}</span>
                </div>
              </div>

              {/* Add more items */}
              {trackStep < 3 && (
                <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", marginBottom: 12 }}
                  onClick={() => setScreen("menu")}>
                  + Add More Items
                </button>
              )}

              {/* Pay button */}
              {trackStep >= 3 && !payDone && (
                <button className="btn btn-primary btn-lg" style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => setShowPayModal(true)}>
                  💳 Pay ₹{finalTotal}
                </button>
              )}

              {payDone && (
                <div style={{ background: theme.greenSoft, border: `1px solid rgba(34,197,94,0.2)`, borderRadius: 14, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                  <div style={{ fontWeight: 700, color: theme.green, marginBottom: 4 }}>Payment Successful!</div>
                  <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 12 }}>₹{finalTotal} paid via GPay</div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <button className="btn btn-ghost btn-sm">⬇ Download Receipt</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setScreen("feedback")}>⭐ Rate Us</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* FEEDBACK SCREEN */}
      {screen === "feedback" && (
        <div style={{ padding: 20 }}>
          <div className="syne" style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>How was your</div>
          <div className="syne" style={{ fontSize: 22, fontWeight: 800, color: theme.accent, marginBottom: 20 }}>experience?</div>
          {!feedbackDone ? (
            <>
              {[
                { key: "waiter", label: "Service by Ram Kumar", emoji: "👨‍🍳" },
                { key: "food", label: "Food Quality", emoji: "🍽️" },
                { key: "overall", label: "Overall Experience", emoji: "🏨" },
              ].map(({ key, label, emoji }) => (
                <div key={key} className="card" style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <span style={{ fontSize: 24 }}>{emoji}</span>
                    <span style={{ fontWeight: 600 }}>{label}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <span key={n} className={`feedback-star ${ratings[key] >= n ? "active" : ""}`}
                        onClick={() => setRatings(r => ({ ...r, [key]: n }))}>⭐</span>
                    ))}
                  </div>
                </div>
              ))}
              <textarea className="input" placeholder="Any comments? (optional)" rows={3} style={{ resize: "none", marginBottom: 12 }} />
              <button className="btn btn-primary btn-lg" style={{ width: "100%", justifyContent: "center" }}
                onClick={() => setFeedbackDone(true)}>
                Submit Feedback
              </button>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>🙏</div>
              <div className="syne" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Thank you!</div>
              <div style={{ color: theme.textMuted, fontSize: 14 }}>Your feedback helps us serve you better.</div>
            </div>
          )}
        </div>
      )}

      {/* Floating Cart */}
      {cartCount > 0 && screen === "menu" && (
        <div className="floating-cart" onClick={() => setScreen("cart")}>
          <span style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: "2px 8px" }}>{cartCount}</span>
          View Cart — ₹{cartTotal}
          <span>→</span>
        </div>
      )}

      {/* Pay Modal */}
      {showPayModal && (
        <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="syne" style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Pay ₹{finalTotal}</div>
            <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 20 }}>Choose payment method</div>

            {[
              { icon: "G", label: "Google Pay", sub: "Opens GPay app", color: theme.blue },
              { icon: "P", label: "PhonePe", sub: "Opens PhonePe app", color: theme.purple },
              { icon: "⬚", label: "Scan QR Code", sub: "Waiter will show QR", color: theme.accent },
              { icon: "💵", label: "Cash / Card", sub: "Pay to waiter directly", color: theme.green },
            ].map(({ icon, label, sub, color }) => (
              <div key={label} onClick={() => { setShowPayModal(false); setPayDone(true); setScreen("status"); }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12,
                  border: `1px solid ${theme.border}`, marginBottom: 8, cursor: "pointer",
                  transition: "all 0.15s", background: theme.bgElevated }}
                onMouseEnter={e => e.currentTarget.style.borderColor = color}
                onMouseLeave={e => e.currentTarget.style.borderColor = theme.border}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color }}>
                  {icon}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted }}>{sub}</div>
                </div>
                <span style={{ marginLeft: "auto", color: theme.textDim }}>→</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// WAITER APP
// ============================================================
function WaiterApp() {
  const [tab, setTab] = useState("orders");
  const [selectedOrder, setSelectedOrder] = useState(null);

  const myOrders = ORDERS.filter(o => o.waiter === "Ram Kumar" && o.status !== "served");

  return (
    <div style={{ background: theme.bg, minHeight: "100vh", maxWidth: 430, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ background: theme.bgCard, borderBottom: `1px solid ${theme.border}`, padding: "12px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: theme.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>👨‍🍳</div>
          <div>
            <div className="syne" style={{ fontWeight: 700 }}>Ram Kumar</div>
            <div style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <span className="badge badge-green" style={{ fontSize: 10 }}>● Available</span>
              <span style={{ color: theme.textMuted }}>★ 4.8 rating</span>
            </div>
          </div>
          <div style={{ marginLeft: "auto", position: "relative" }}>
            <button className="btn-ghost btn" style={{ padding: "8px 10px" }}>🔔</button>
            <span className="notification-dot" />
          </div>
        </div>
        <div className="tab-bar">
          {["orders","completed","rating"].map(t => (
            <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "orders" ? `My Orders (${myOrders.length})` : t === "completed" ? "Completed" : "My Rating"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {tab === "orders" && (
          <>
            {myOrders.length === 0 && (
              <div style={{ textAlign: "center", padding: 60, color: theme.textMuted }}>
                <div style={{ fontSize: 40 }}>✅</div>
                <div style={{ marginTop: 8 }}>No pending orders</div>
              </div>
            )}
            {myOrders.map((order, i) => (
              <div key={order.id} className="waiter-order-card" style={{ marginBottom: 12, animationDelay: `${i * 0.1}s` }}
                onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span className="syne" style={{ fontWeight: 700, fontSize: 15 }}>Table {order.table}</span>
                      <StatusBadge status={order.kdsStatus} />
                    </div>
                    <div style={{ fontSize: 12, color: theme.textMuted }}>{order.id} • {order.time}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, color: theme.accent, fontSize: 16 }}>₹{order.total}</div>
                    <div style={{ fontSize: 11, color: theme.textDim }}>{order.items.length} items</div>
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {order.items.map(item => (
                    <span key={item.name} className="tag" style={{ fontSize: 11 }}>{item.name} ×{item.qty}</span>
                  ))}
                </div>

                {selectedOrder?.id === order.id && (
                  <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 12, animation: "fadeUp 0.2s ease" }}>
                    <div style={{ background: theme.accentSoft, borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 12, color: theme.accent }}>
                      🏷️ VIP Guest — Handle with care
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-success" style={{ flex: 1, justifyContent: "center" }}>✓ Mark Served</button>
                      <button className="btn btn-danger" style={{ flex: 1, justifyContent: "center" }}>✕ Rejected</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {tab === "completed" && (
          <div>
            {ORDERS.filter(o => o.waiter === "Ram Kumar" && o.status === "served").map(order => (
              <div key={order.id} className="waiter-order-card" style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <span className="syne" style={{ fontWeight: 700 }}>Table {order.table}</span>
                    <span style={{ marginLeft: 8, fontSize: 12, color: theme.textMuted }}>{order.time}</span>
                  </div>
                  <div>
                    <StatusBadge status="served" />
                    <span style={{ marginLeft: 8, fontWeight: 700, color: theme.accent }}>₹{order.total}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "rating" && (
          <div>
            <div className="card" style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>⭐</div>
              <div className="syne" style={{ fontSize: 32, fontWeight: 800, color: theme.accent }}>4.8</div>
              <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 16 }}>Based on 234 reviews</div>
              {[5,4,3,2,1].map(n => (
                <div key={n} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: theme.textMuted, width: 12 }}>{n}</span>
                  <div className="progress-bar" style={{ flex: 1 }}>
                    <div className="progress-fill" style={{ width: `${n === 5 ? 78 : n === 4 ? 15 : n === 3 ? 5 : 2}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="syne" style={{ fontSize: 13, fontWeight: 700, color: theme.textMuted, marginBottom: 10, textTransform: "uppercase" }}>Recent Comments</div>
            {[
              { text: "Ram was very quick and polite!", rating: 5 },
              { text: "Good service, food was hot", rating: 5 },
              { text: "Friendly and efficient", rating: 4 },
            ].map((c, i) => (
              <div key={i} className="card" style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, marginBottom: 6 }}>{c.text}</div>
                <div style={{ color: theme.accent, fontSize: 13 }}>{"★".repeat(c.rating)}{"☆".repeat(5 - c.rating)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// KDS SCREEN
// ============================================================
function KDSScreen() {
  const [orders, setOrders] = useState([
    { id: "ORD-003", table: 2, items: [{name:"Dal Makhani",qty:1},{name:"Butter Naan",qty:3},{name:"Gulab Jamun",qty:2}], time: "12:48 PM", wait: 4, status: "new", note: "Less spicy please" },
    { id: "ORD-006", table: 9, items: [{name:"Chicken Tikka",qty:2},{name:"Veg Spring Roll",qty:1}], time: "12:46 PM", wait: 6, status: "new" },
    { id: "ORD-002", table: 7, items: [{name:"Veg Biryani",qty:2},{name:"Mango Lassi",qty:2}], time: "12:41 PM", wait: 11, status: "preparing" },
    { id: "ORD-004", table: 5, items: [{name:"Paneer Butter Masala",qty:1},{name:"Naan",qty:2}], time: "12:38 PM", wait: 14, status: "ready" },
  ]);

  const updateStatus = (id, status) => setOrders(o => o.map(x => x.id === id ? { ...x, status } : x));

  return (
    <div style={{ background: "#080810", minHeight: "100vh", color: theme.text }}>
      {/* KDS Header */}
      <div style={{ background: "#0D0D18", borderBottom: `2px solid ${theme.accentBorder}`, padding: "12px 28px", display: "flex", alignItems: "center", gap: 20 }}>
        <div className="syne" style={{ fontSize: 20, fontWeight: 800, color: theme.accent }}>🍳 KITCHEN DISPLAY</div>
        <span className="badge badge-green" style={{ fontSize: 12 }}><span className="live-dot" /> LIVE</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 20, fontSize: 13, color: theme.textMuted }}>
          <span>NEW: <span style={{ color: theme.blue, fontWeight: 700 }}>2</span></span>
          <span>PREPARING: <span style={{ color: theme.yellow, fontWeight: 700 }}>1</span></span>
          <span>READY: <span style={{ color: theme.green, fontWeight: 700 }}>1</span></span>
        </div>
        <div style={{ fontSize: 13, color: theme.textMuted }}>🕐 12:52 PM</div>
      </div>

      <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {orders.map(order => (
          <div key={order.id} className={`kds-card ${order.wait > 10 ? "red" : order.wait > 5 ? "yellow" : ""}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div className="syne" style={{ fontSize: 18, fontWeight: 800 }}>TABLE {order.table}</div>
                <div style={{ fontSize: 11, color: theme.textMuted }}>{order.id}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: order.wait > 10 ? theme.red : order.wait > 5 ? theme.yellow : theme.green }}>
                  {order.wait}m
                </div>
                <StatusBadge status={order.status} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              {order.items.map(item => (
                <div key={item.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${theme.border}`, fontSize: 14 }}>
                  <span>× {item.qty} {item.name}</span>
                </div>
              ))}
            </div>

            {order.note && (
              <div style={{ background: theme.yellowSoft, border: `1px solid rgba(234,179,8,0.2)`, borderRadius: 8, padding: "6px 10px", marginBottom: 10, fontSize: 12, color: theme.yellow }}>
                📝 {order.note}
              </div>
            )}

            {order.status === "new" && (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-success" style={{ flex: 1, justifyContent: "center" }} onClick={() => updateStatus(order.id, "preparing")}>✓ Accept</button>
                <button className="btn btn-danger" style={{ flex: 1, justifyContent: "center" }} onClick={() => updateStatus(order.id, "rejected")}>✕ Reject</button>
              </div>
            )}
            {order.status === "preparing" && (
              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => updateStatus(order.id, "ready")}>
                🔔 Mark Ready — Notify Waiter
              </button>
            )}
            {order.status === "ready" && (
              <div style={{ textAlign: "center", padding: 8, background: theme.greenSoft, borderRadius: 10, fontSize: 13, color: theme.green, fontWeight: 600 }}>
                ✅ Waiter Notified — Awaiting Pickup
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// ADMIN PANEL
// ============================================================
function AdminPanel() {
  const [page, setPage] = useState("dashboard");
  const [gstEnabled, setGstEnabled] = useState(true);
  const [kdsEnabled, setKdsEnabled] = useState(true);
  const [tableVisibility, setTableVisibility] = useState(true);
  const [kitchenOpen, setKitchenOpen] = useState(true);
  const [receiptFlow, setReceiptFlow] = useState("both");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "🏠" },
    { id: "orders", label: "Live Orders", icon: "📋", badge: 4 },
    { id: "menu", label: "Menu Manager", icon: "🍽️" },
    { id: "tables", label: "Tables", icon: "🪑" },
    { id: "waiters", label: "Waiters", icon: "👨‍🍳" },
    { id: "analytics", label: "Analytics", icon: "📊" },
    { id: "payments", label: "Payments", icon: "💳" },
    { id: "feedback", label: "Feedback", icon: "⭐" },
    { id: "qr", label: "QR Codes", icon: "◫" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <div style={{ display: "flex", background: theme.bg, minHeight: "100vh" }}>
      {/* Sidebar */}
      <div style={{ width: sidebarOpen ? 220 : 64, background: theme.bgCard, borderRight: `1px solid ${theme.border}`, padding: "20px 12px", display: "flex", flexDirection: "column", transition: "width 0.3s", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, paddingLeft: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>🏨</div>
          {sidebarOpen && <div className="syne" style={{ fontWeight: 800, fontSize: 14, color: theme.text }}>Grand Spice</div>}
        </div>

        {navItems.map(item => (
          <div key={item.id} className={`nav-pill ${page === item.id ? "active" : ""}`} style={{ marginBottom: 2, justifyContent: sidebarOpen ? "flex-start" : "center" }}
            onClick={() => setPage(item.id)}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
            {sidebarOpen && (
              <>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && <span style={{ background: theme.red, color: "white", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{item.badge}</span>}
              </>
            )}
          </div>
        ))}

        <div style={{ marginTop: "auto" }}>
          <div className="nav-pill" style={{ justifyContent: sidebarOpen ? "flex-start" : "center" }} onClick={() => setSidebarOpen(!sidebarOpen)}>
            <span style={{ fontSize: 16 }}>{sidebarOpen ? "◀" : "▶"}</span>
            {sidebarOpen && <span>Collapse</span>}
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px 28px", maxHeight: "100vh", overflowY: "auto" }}>

        {/* DASHBOARD */}
        {page === "dashboard" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div>
                <div className="syne" style={{ fontSize: 24, fontWeight: 800 }}>Good afternoon, Rajesh 👋</div>
                <div style={{ color: theme.textMuted, fontSize: 14 }}>Sunday, May 31, 2026 • <span className="live-dot" style={{ display: "inline-block", width: 6, height: 6 }} /> Kitchen Open</div>
              </div>
              <button className="btn btn-primary">+ New Table</button>
            </div>

            {/* Metric cards */}
            <div className="grid-4" style={{ marginBottom: 24 }}>
              {[
                { label: "Today's Revenue", value: "₹71,240", delta: "+12%", icon: "💰", cls: "accent" },
                { label: "Active Orders", value: "4", delta: "2 urgent", icon: "📋", cls: "blue" },
                { label: "Tables Occupied", value: "8/12", delta: "67%", icon: "🪑", cls: "green" },
                { label: "Avg Order Value", value: "₹784", delta: "+8%", icon: "📊", cls: "purple" },
              ].map(m => (
                <div key={m.label} className={`metric-card ${m.cls}`}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{m.icon}</div>
                  <div className="syne" style={{ fontSize: 22, fontWeight: 800, color: m.cls === "accent" ? theme.accent : m.cls === "blue" ? theme.blue : m.cls === "green" ? theme.green : theme.purple, marginBottom: 2 }}>{m.value}</div>
                  <div style={{ fontSize: 13, color: theme.textMuted }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: theme.green, marginTop: 4 }}>↑ {m.delta}</div>
                  <div className="sparkline" style={{ marginTop: 12 }}>
                    {[40,55,35,70,60,80,95].map((h, i) => (
                      <div key={i} className={`spark-bar ${i === 6 ? "highlight" : ""}`} style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid-2">
              {/* Live orders */}
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                  <div className="syne" style={{ fontWeight: 700 }}>Live Orders</div>
                  <span className="badge badge-blue"><span className="live-dot" style={{ width: 6, height: 6 }} /> Live</span>
                </div>
                {ORDERS.filter(o => o.status !== "served").map(order => (
                  <div key={order.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${theme.border}` }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: theme.bgElevated, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: theme.accent }}>T{order.table}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{order.waiter}</div>
                      <div style={{ fontSize: 11, color: theme.textMuted }}>{order.time} • {order.items.length} items</div>
                    </div>
                    <StatusBadge status={order.status} />
                    <span style={{ fontWeight: 700, color: theme.accent, fontSize: 14 }}>₹{order.total}</span>
                  </div>
                ))}
              </div>

              {/* Table map */}
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                  <div className="syne" style={{ fontWeight: 700 }}>Table Status</div>
                  <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
                    {[["green","Free"],["red","Busy"],["yellow","Reserved"]].map(([c,l]) => (
                      <span key={c} style={{ color: theme[c] }}>● {l}</span>
                    ))}
                  </div>
                </div>
                <div className="table-grid">
                  {TABLES.map(t => (
                    <div key={t.id} className={`table-cell ${t.status}`}>
                      <span style={{ fontSize: 18 }}>🪑</span>
                      <span>{t.num}</span>
                      <span style={{ fontSize: 9 }}>{t.cap}p</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LIVE ORDERS */}
        {page === "orders" && (
          <div>
            <div className="syne" style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Live Orders</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {["All","Placed","Preparing","Ready","Payment"].map(f => (
                <button key={f} className="tag active" style={{ fontSize: 12 }}>{f}</button>
              ))}
            </div>
            {ORDERS.map(order => (
              <div key={order.id} className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span className="syne" style={{ fontWeight: 700, fontSize: 16 }}>Table {order.table}</span>
                      <StatusBadge status={order.status} />
                      <StatusBadge status={order.kdsStatus} />
                    </div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8 }}>{order.id} • {order.time} • {order.waiter}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {order.items.map(item => (
                        <span key={item.name} className="tag" style={{ fontSize: 11 }}>{item.name} ×{item.qty}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="syne" style={{ fontSize: 18, fontWeight: 800, color: theme.accent }}>₹{order.total}</div>
                    <StatusBadge status={order.payStatus === "paid" ? "paid" : "pending"} />
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button className="btn btn-ghost btn-sm">Edit</button>
                      <button className="btn btn-primary btn-sm">Reassign</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MENU MANAGER */}
        {page === "menu" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div className="syne" style={{ fontSize: 22, fontWeight: 800 }}>Menu Manager</div>
              <button className="btn btn-primary">+ Add Item</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
              {MENU.map(item => (
                <div key={item.id} className="card" style={{ display: "flex", gap: 14 }}>
                  <div style={{ width: 70, height: 70, background: theme.bgElevated, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flexShrink: 0 }}>{item.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</span>
                      <span style={{ fontSize: 10 }}>{item.veg ? "🟢" : "🔴"}</span>
                    </div>
                    <div style={{ fontSize: 13, color: theme.accent, fontWeight: 700, marginBottom: 6 }}>₹{item.price}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span className={`badge ${item.available ? "badge-green" : "badge-red"}`}>{item.available ? "Available" : "Unavailable"}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" style={{ padding: "4px 8px" }}>✏️</button>
                        <Toggle on={item.available} onToggle={() => {}} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TABLES */}
        {page === "tables" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div className="syne" style={{ fontSize: 22, fontWeight: 800 }}>Table Management</div>
              <button className="btn btn-primary">+ Add Table</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
              {TABLES.map(t => (
                <div key={t.id} className="card">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div className="syne" style={{ fontSize: 18, fontWeight: 800 }}>Table {t.num}</div>
                    <StatusBadge status={t.status} />
                  </div>
                  <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 12 }}>Capacity: {t.cap} persons</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["available","occupied","reserved","blocked"].map(s => (
                      <button key={s} className={`tag ${t.status === s ? "active" : ""}`} style={{ fontSize: 10, padding: "3px 8px" }}>{s}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WAITERS */}
        {page === "waiters" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div className="syne" style={{ fontSize: 22, fontWeight: 800 }}>Waiter Management</div>
              <button className="btn btn-primary">+ Add Waiter</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {WAITERS.map(w => (
                <div key={w.id} className="card">
                  <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: theme.bgElevated, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{w.emoji}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{w.name}</div>
                      <div style={{ fontSize: 12, color: theme.textMuted }}>{w.phone}</div>
                      <StatusBadge status={w.available ? "available" : "occupied"} />
                    </div>
                  </div>
                  <div className="grid-3" style={{ gap: 10, marginBottom: 12 }}>
                    {[
                      { label: "Rating", value: `★ ${w.avgRating}` },
                      { label: "Active", value: w.activeOrders },
                      { label: "Total", value: w.totalServed },
                    ].map(stat => (
                      <div key={stat.label} style={{ textAlign: "center", background: theme.bgElevated, borderRadius: 10, padding: "8px 4px" }}>
                        <div style={{ fontWeight: 700, color: theme.accent, fontSize: 14 }}>{stat.value}</div>
                        <div style={{ fontSize: 10, color: theme.textMuted }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center" }}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center" }}>View Orders</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ANALYTICS */}
        {page === "analytics" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div className="syne" style={{ fontSize: 22, fontWeight: 800 }}>Analytics</div>
              <div style={{ display: "flex", gap: 8 }}>
                {["Today","Week","Month"].map(p => (
                  <button key={p} className={`tag ${p === "Week" ? "active" : ""}`}>{p}</button>
                ))}
                <button className="btn btn-ghost btn-sm">⬇ Export</button>
              </div>
            </div>

            {/* Summary metrics */}
            <div className="grid-4" style={{ marginBottom: 24 }}>
              {[
                { label: "Weekly Revenue", value: "₹3,69,000", delta: "+18%", color: theme.accent },
                { label: "Total Orders", value: "482", delta: "+22%", color: theme.blue },
                { label: "Avg Order Value", value: "₹766", delta: "+5%", color: theme.green },
                { label: "Repeat Customers", value: "34%", delta: "+8%", color: theme.purple },
              ].map(m => (
                <div key={m.label} className="card">
                  <div className="syne" style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{m.value}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: theme.green, marginTop: 2 }}>↑ {m.delta} vs last week</div>
                </div>
              ))}
            </div>

            <div className="grid-2" style={{ marginBottom: 20 }}>
              {/* Revenue chart */}
              <div className="card">
                <div className="syne" style={{ fontWeight: 700, marginBottom: 16 }}>Daily Revenue (This Week)</div>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 120 }}>
                  {ANALYTICS.revenue.map((v, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ fontSize: 9, color: theme.textMuted }}>₹{(v/1000).toFixed(0)}k</div>
                      <div style={{ width: "100%", borderRadius: "4px 4px 0 0", height: `${(v / 71000) * 80}px`,
                        background: i === 6 ? theme.accent : theme.accentSoft, border: `1px solid ${theme.accentBorder}`,
                        transition: "height 0.5s" }} />
                      <div style={{ fontSize: 10, color: theme.textMuted }}>{ANALYTICS.days[i]}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top items */}
              <div className="card">
                <div className="syne" style={{ fontWeight: 700, marginBottom: 16 }}>Top Items by Revenue</div>
                {ANALYTICS.topItems.map((item, i) => (
                  <div key={item.name} className="chart-bar-h">
                    <div style={{ fontSize: 12, color: theme.textMuted, width: 28 }}>{i + 1}.</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, marginBottom: 4 }}>{item.name}</div>
                      <div className="chart-bar-fill" style={{ width: `${(item.revenue / 18240) * 100}%` }}>
                        ₹{(item.revenue / 1000).toFixed(1)}k
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid-2">
              {/* Peak hours */}
              <div className="card">
                <div className="syne" style={{ fontWeight: 700, marginBottom: 16 }}>Peak Hours</div>
                {ANALYTICS.peakHours.sort((a, b) => b.pct - a.pct).map(h => (
                  <div key={h.hour} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 40, fontSize: 12, color: theme.textMuted }}>{h.hour}</div>
                    <div className="progress-bar" style={{ flex: 1 }}>
                      <div className="progress-fill" style={{ width: `${h.pct}%`, background: h.pct > 80 ? theme.red : h.pct > 50 ? theme.accent : theme.green }} />
                    </div>
                    <div style={{ width: 30, fontSize: 12, color: theme.textMuted, textAlign: "right" }}>{h.pct}%</div>
                  </div>
                ))}
              </div>

              {/* Payment split */}
              <div className="card">
                <div className="syne" style={{ fontWeight: 700, marginBottom: 16 }}>Payment Methods</div>
                {ANALYTICS.payMethods.map(m => (
                  <div key={m.label} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                      <span>{m.label}</span><span style={{ fontWeight: 700, color: m.color }}>{m.pct}%</span>
                    </div>
                    <div className="progress-bar">
                      <div style={{ height: "100%", width: `${m.pct}%`, background: m.color, borderRadius: 2, transition: "width 1s" }} />
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 16, padding: 12, background: theme.bgElevated, borderRadius: 10, fontSize: 12, color: theme.textMuted }}>
                  Total collected: <span style={{ color: theme.accent, fontWeight: 700 }}>₹3,69,000</span> this week
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FEEDBACK */}
        {page === "feedback" && (
          <div>
            <div className="syne" style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Feedback & Ratings</div>

            <div className="grid-3" style={{ marginBottom: 24 }}>
              {[
                { label: "Overall Hotel", rating: 4.7, reviews: 312 },
                { label: "Food Quality", rating: 4.8, reviews: 312 },
                { label: "Avg Waiter", rating: 4.7, reviews: 312 },
              ].map(r => (
                <div key={r.label} className="card" style={{ textAlign: "center" }}>
                  <div className="syne" style={{ fontSize: 36, fontWeight: 800, color: theme.accent }}>{r.rating}</div>
                  <div style={{ color: theme.accent, fontSize: 20, margin: "4px 0" }}>
                    {"★".repeat(Math.floor(r.rating))}
                  </div>
                  <div style={{ fontSize: 13, color: theme.textMuted }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: theme.textDim }}>{r.reviews} reviews</div>
                </div>
              ))}
            </div>

            <div className="syne" style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Waiter Leaderboard</div>
            {WAITERS.sort((a, b) => b.avgRating - a.avgRating).map((w, i) => (
              <div key={w.id} className="card" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 20, color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : theme.textDim, width: 24 }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </div>
                <div style={{ fontSize: 24 }}>{w.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{w.name}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted }}>{w.totalServed} orders served</div>
                </div>
                <div style={{ color: theme.accent, fontWeight: 800, fontSize: 18 }}>★ {w.avgRating}</div>
              </div>
            ))}

            <div className="syne" style={{ fontSize: 15, fontWeight: 700, margin: "20px 0 12px" }}>Recent Reviews</div>
            {[
              { text: "Amazing food, very prompt service! Ram was excellent.", waiter: "Ram Kumar", overall: 5, food: 5 },
              { text: "Paneer was good but service was slightly delayed.", waiter: "Suresh Yadav", overall: 4, food: 4 },
              { text: "Great ambiance, would visit again!", waiter: "Priya Singh", overall: 5, food: 5 },
            ].map((r, i) => (
              <div key={i} className="card" style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 14, marginBottom: 8 }}>"{r.text}"</div>
                <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                  <span style={{ color: theme.textMuted }}>Waiter: <span style={{ color: theme.text }}>{r.waiter}</span></span>
                  <span style={{ color: theme.accent }}>★ {r.overall} overall</span>
                  <span style={{ color: theme.accent }}>★ {r.food} food</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PAYMENTS */}
        {page === "payments" && (
          <div>
            <div className="syne" style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Payments</div>
            <div className="grid-3" style={{ marginBottom: 24 }}>
              {[
                { label: "Collected Today", value: "₹71,240", color: theme.green },
                { label: "Pending", value: "₹3,340", color: theme.yellow },
                { label: "Disputed", value: "₹0", color: theme.red },
              ].map(m => (
                <div key={m.label} className="card">
                  <div className="syne" style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{m.value}</div>
                  <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>{m.label}</div>
                </div>
              ))}
            </div>
            {ORDERS.map(order => (
              <div key={order.id} className="card" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: theme.bgElevated, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: theme.accent }}>T{order.table}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{order.id} • Table {order.table}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted }}>{order.time} • {order.waiter}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, color: theme.accent }}>₹{order.total}</div>
                  <StatusBadge status={order.payStatus === "paid" ? "paid" : "pending"} />
                </div>
                {order.payStatus !== "paid" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-success btn-sm">Cash</button>
                    <button className="btn btn-ghost btn-sm">UPI</button>
                  </div>
                )}
                {order.payMethod && (
                  <span className="badge badge-blue">{order.payMethod}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* QR CODES */}
        {page === "qr" && (
          <div>
            <div className="syne" style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>QR Code Generator</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
              {TABLES.map(t => (
                <div key={t.id} className="card" style={{ textAlign: "center" }}>
                  <div style={{ width: 100, height: 100, margin: "0 auto 12px", background: "white", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
                    <div style={{ width: "100%", height: "100%", background: "repeating-conic-gradient(#000 0% 25%, #fff 0% 50%) 0 0 / 12px 12px", borderRadius: 4 }} />
                  </div>
                  <div className="syne" style={{ fontWeight: 700, marginBottom: 4 }}>Table {t.num}</div>
                  <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 10 }}>{t.cap} persons</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center", fontSize: 11 }}>⬇ Save</button>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center", fontSize: 11 }}>🖨️ Print</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {page === "settings" && (
          <div>
            <div className="syne" style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Settings</div>

            {/* Hotel Info */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="syne" style={{ fontWeight: 700, marginBottom: 16, color: theme.accent }}>🏨 Hotel Information</div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>Hotel Name</div>
                  <input className="input" defaultValue="The Grand Spice" />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>GSTIN</div>
                  <input className="input" defaultValue="27AAPFU0939F1ZV" />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>UPI ID</div>
                  <input className="input" defaultValue="grandspice@okaxis" />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>Phone</div>
                  <input className="input" defaultValue="+91 98765 43210" />
                </div>
              </div>
            </div>

            {/* Tax Settings */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="syne" style={{ fontWeight: 700, marginBottom: 16, color: theme.accent }}>💰 GST / Tax Settings</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>GST Registered Hotel</div>
                  <div style={{ fontSize: 12, color: theme.textMuted }}>Enable GST calculation on bills</div>
                </div>
                <Toggle on={gstEnabled} onToggle={() => setGstEnabled(!gstEnabled)} />
              </div>
              {gstEnabled && (
                <div className="grid-2" style={{ gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>CGST %</div>
                    <input className="input" defaultValue="9" type="number" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>SGST %</div>
                    <input className="input" defaultValue="9" type="number" />
                  </div>
                </div>
              )}
            </div>

            {/* Operations */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="syne" style={{ fontWeight: 700, marginBottom: 16, color: theme.accent }}>⚙️ Operations</div>
              {[
                { label: "Kitchen Display System (KDS)", sub: "Show orders on /kds kitchen screen", state: kdsEnabled, toggle: () => setKdsEnabled(!kdsEnabled) },
                { label: "Table Availability (Public)", sub: "Show table status on menu page", state: tableVisibility, toggle: () => setTableVisibility(!tableVisibility) },
                { label: "Kitchen Open", sub: "Accept new orders", state: kitchenOpen, toggle: () => setKitchenOpen(!kitchenOpen) },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${theme.border}` }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted }}>{item.sub}</div>
                  </div>
                  <Toggle on={item.state} onToggle={item.toggle} />
                </div>
              ))}
            </div>

            {/* Receipt */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="syne" style={{ fontWeight: 700, marginBottom: 16, color: theme.accent }}>🧾 Receipt Settings</div>
              <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 10 }}>Receipt Flow</div>
              {[
                { val: "customer", label: "Customer downloads after payment" },
                { val: "admin", label: "Admin prints before payment" },
                { val: "both", label: "Both options available" },
              ].map(o => (
                <div key={o.val} onClick={() => setReceiptFlow(o.val)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10,
                    background: receiptFlow === o.val ? theme.accentSoft : "transparent",
                    border: `1px solid ${receiptFlow === o.val ? theme.accentBorder : theme.border}`,
                    marginBottom: 8, cursor: "pointer" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${receiptFlow === o.val ? theme.accent : theme.border}`,
                    background: receiptFlow === o.val ? theme.accent : "transparent" }} />
                  <span style={{ fontSize: 13 }}>{o.label}</span>
                </div>
              ))}
            </div>

            {/* Kitchen Closing */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="syne" style={{ fontWeight: 700, marginBottom: 16, color: theme.accent }}>🕐 Kitchen Hours</div>
              <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>Opening Time</div>
                  <input className="input" type="time" defaultValue="10:00" />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>Closing Time</div>
                  <input className="input" type="time" defaultValue="23:00" />
                </div>
              </div>
              <button className="btn btn-danger" style={{ width: "100%", justifyContent: "center" }}>🔴 Close Kitchen Now</button>
            </div>

            <button className="btn btn-primary btn-lg" style={{ width: "100%", justifyContent: "center" }}>Save All Settings</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP — VIEW SWITCHER
// ============================================================
export default function App() {
  const [view, setView] = useState("landing");

  if (view === "customer") return (
    <div>
      <div style={{ background: theme.bgCard, borderBottom: `1px solid ${theme.border}`, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setView("landing")}>← Back</button>
        <span style={{ fontSize: 13, color: theme.textMuted }}>📱 Customer PWA — Table 7</span>
        <span className="badge badge-green" style={{ marginLeft: "auto" }}>Demo Mode</span>
      </div>
      <CustomerApp />
    </div>
  );
  if (view === "waiter") return (
    <div>
      <div style={{ background: theme.bgCard, borderBottom: `1px solid ${theme.border}`, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setView("landing")}>← Back</button>
        <span style={{ fontSize: 13, color: theme.textMuted }}>🧑‍🍽️ Waiter App — Ram Kumar</span>
        <span className="badge badge-green" style={{ marginLeft: "auto" }}>Demo Mode</span>
      </div>
      <WaiterApp />
    </div>
  );
  if (view === "kds") return (
    <div>
      <div style={{ background: theme.bgCard, borderBottom: `1px solid ${theme.border}`, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setView("landing")}>← Back</button>
        <span style={{ fontSize: 13, color: theme.textMuted }}>🍳 Kitchen Display System — /kds</span>
        <span className="badge badge-green" style={{ marginLeft: "auto" }}>Demo Mode</span>
      </div>
      <KDSScreen />
    </div>
  );
  if (view === "admin") return (
    <div>
      <div style={{ background: theme.bgCard, borderBottom: `1px solid ${theme.border}`, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setView("landing")}>← Back</button>
        <span style={{ fontSize: 13, color: theme.textMuted }}>⚙️ Admin Panel — The Grand Spice</span>
        <span className="badge badge-green" style={{ marginLeft: "auto" }}>Demo Mode</span>
      </div>
      <AdminPanel />
    </div>
  );

  // LANDING
  return (
    <div style={{ background: theme.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <style>{css}</style>
      <div style={{ textAlign: "center", marginBottom: 60, animation: "fadeUp 0.6s ease" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: theme.accentSoft, border: `1px solid ${theme.accentBorder}`, borderRadius: 20, padding: "6px 16px", marginBottom: 24, fontSize: 12, color: theme.accent, fontWeight: 600 }}>
          <span className="live-dot" /> HOTEL QR ORDERING SYSTEM — DEMO
        </div>
        <div className="syne" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.1, marginBottom: 16 }}>
          The Grand Spice<br />
          <span style={{ color: theme.accent }}>Order Management</span>
        </div>
        <div style={{ fontSize: 18, color: theme.textMuted, maxWidth: 500 }}>
          Complete contactless dining experience — from QR scan to payment. Select a role to explore the demo.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, maxWidth: 700, width: "100%" }}>
        {[
          { key: "customer", icon: "📱", title: "Customer App", sub: "PWA • Scan QR → Menu → Order → Pay", color: theme.accent, items: ["Browse menu with photos & prices", "Customize items (spice, portion)", "Live order tracking", "UPI / GPay / Cash payment", "Download receipt & leave rating"] },
          { key: "waiter", icon: "🧑‍🍽️", title: "Waiter App", sub: "Mobile PWA • Auto-assigned orders", color: theme.blue, items: ["See assigned orders instantly", "View table notes & VIP flags", "Mark served / rejected", "Own rating & performance stats", "Push notifications"] },
          { key: "kds", icon: "🍳", title: "Kitchen Display", sub: "Tablet screen at /kds", color: theme.green, items: ["Live order cards with wait timer", "Accept / Reject with reason", "Color-coded urgency (green→red)", "Notify waiter when ready", "Special instructions highlighted"] },
          { key: "admin", icon: "⚙️", title: "Admin Panel", sub: "Full control center", color: theme.purple, items: ["Live dashboard & analytics", "Menu manager with toggles", "Table & waiter management", "Payment collection & reports", "All settings: GST, KDS, hours"] },
        ].map(role => (
          <div key={role.key} className="card" style={{ cursor: "pointer", transition: "all 0.25s", borderColor: "transparent", position: "relative", overflow: "hidden" }}
            onClick={() => setView(role.key)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = role.color; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 20px 40px rgba(0,0,0,0.3)`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 100, height: 100, borderRadius: "0 16px 0 100px", background: role.color, opacity: 0.06 }} />
            <div style={{ fontSize: 36, marginBottom: 10 }}>{role.icon}</div>
            <div className="syne" style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{role.title}</div>
            <div style={{ fontSize: 12, color: role.color, marginBottom: 16, fontWeight: 500 }}>{role.sub}</div>
            {role.items.map(item => (
              <div key={item} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6, fontSize: 13, color: theme.textMuted }}>
                <span style={{ color: role.color, marginTop: 1 }}>✓</span>
                <span>{item}</span>
              </div>
            ))}
            <button className="btn btn-ghost" style={{ marginTop: 16, width: "100%", justifyContent: "center", borderColor: role.color, color: role.color }}>
              Open {role.title} →
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 40, fontSize: 13, color: theme.textDim, textAlign: "center" }}>
        All data is dummy • No backend required • Full interactive demo
      </div>
    </div>
  );
}
