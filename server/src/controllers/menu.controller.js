const MenuItem = require('../models/MenuItem');
const { getPublicUrl } = require('../config/storage');

async function adminGetAll(req, res, next) {
  try {
    const items = await MenuItem.find({ hotelId: req.user.hotelId })
      .sort({ category: 1, sortOrder: 1, name: 1 });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

async function getMenu(req, res, next) {
  try {
    const filter = { hotelId: req.params.hotelId };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.available !== undefined) filter.available = req.query.available === 'true';

    const items = await MenuItem.find(filter)
      .select('-stats')
      .sort({ category: 1, sortOrder: 1, name: 1 });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

async function getItem(req, res, next) {
  try {
    const item = await MenuItem.findOne({ _id: req.params.itemId, hotelId: req.params.hotelId });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

async function createItem(req, res, next) {
  try {
    const { name, description, category, price, isVeg, available, tags } = req.body;

    let customizationOptions = [];
    if (req.body.customizationOptions) {
      try { customizationOptions = JSON.parse(req.body.customizationOptions); } catch {}
    }

    const photoUrl = req.file ? getPublicUrl('menu', req.file.filename) : '';

    const parsedTags = Array.isArray(tags)
      ? tags
      : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : []);

    const item = await MenuItem.create({
      hotelId: req.user.hotelId,
      name,
      description: description || '',
      category,
      price: parseFloat(price),
      isVeg: isVeg === 'true' || isVeg === true,
      available: available !== 'false' && available !== false,
      photoUrl,
      customizationOptions,
      tags: parsedTags,
    });

    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
}

async function updateItem(req, res, next) {
  try {
    const allowed = ['name', 'description', 'category', 'price', 'isVeg', 'available', 'photoUrl', 'customizationOptions', 'tags', 'sortOrder'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const item = await MenuItem.findByIdAndUpdate(req.params.itemId, updates, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

async function toggleAvailability(req, res, next) {
  try {
    const { available } = req.body;
    if (available === undefined) return res.status(400).json({ error: 'available field required' });

    const item = await MenuItem.findByIdAndUpdate(
      req.params.itemId,
      { available },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

async function deleteItem(req, res, next) {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { adminGetAll, getMenu, getItem, createItem, updateItem, toggleAvailability, deleteItem };
