import { Category } from '../models/Category.js';
import { getIO } from '../services/socketService.js';

export async function getCategories(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  try {
    const categories = await Category.find();
    res.json(categories || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function createCategory(req, res) {
  try {
    const cat = { ...req.body };
    if (!cat.id) {
      cat.id = (cat.name || 'cat')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }

    const created = await Category.findOneAndUpdate(
      { id: cat.id },
      { $set: cat },
      { upsert: true, new: true }
    );

    const io = getIO();
    if (io) io.emit('category:new', created || cat);
    res.status(201).json(created || cat);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function updateCategory(req, res) {
  try {
    const rawId = String(req.params.id || '');
    const updates = { ...req.body };

    const updated = await Category.findOneAndUpdate(
      { id: rawId },
      { $set: updates },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const io = getIO();
    if (io) io.emit('category:update', updated);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteCategory(req, res) {
  try {
    const rawId = String(req.params.id || '');
    if (!rawId) {
      return res.status(400).json({ error: 'Category ID required' });
    }

    await Category.deleteMany({ id: rawId });

    const io = getIO();
    if (io) io.emit('category:delete', rawId);
    res.json({ success: true, message: 'Category deleted', id: rawId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
