import { Router } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/categoryController.js';
import { requireAdminAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Public Category Discovery
router.get('/', getCategories);

// Protected Admin Category Operations
router.post('/', requireAdminAuth, createCategory);
router.put('/:id', requireAdminAuth, updateCategory);
router.delete('/:id', requireAdminAuth, deleteCategory);

export default router;
