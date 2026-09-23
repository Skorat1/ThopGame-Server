import { BlogPost } from '../models/BlogPost.js';

// GET /api/blog  — public: only published posts
export async function getAllPosts(req, res) {
  try {
    await BlogPost.ensureTable();
    const { category, search, featured, limit } = req.query;
    const filter = { published: true };
    if (category && category !== 'all') filter.category = category;
    if (search) filter.search = search;
    if (featured === 'true') filter.featured = true;
    if (limit) filter.limit = limit;
    const posts = await BlogPost.find(filter);
    res.json(posts);
  } catch (err) {
    console.error('getAllPosts error:', err);
    res.status(500).json({ error: 'Failed to fetch blog posts' });
  }
}

// GET /api/blog/admin  — admin: all posts (including drafts)
export async function getAllPostsAdmin(req, res) {
  try {
    await BlogPost.ensureTable();
    const { category, search } = req.query;
    const filter = {};
    if (category && category !== 'all') filter.category = category;
    if (search) filter.search = search;
    const posts = await BlogPost.find(filter);
    res.json(posts);
  } catch (err) {
    console.error('getAllPostsAdmin error:', err);
    res.status(500).json({ error: 'Failed to fetch blog posts' });
  }
}

// GET /api/blog/:id  — public
export async function getPostById(req, res) {
  try {
    const post = await BlogPost.findOne({ id: req.params.id });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    // increment views async
    BlogPost.incrementViews(req.params.id).catch(() => {});
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch post' });
  }
}

// POST /api/blog  — admin only
export async function createPost(req, res) {
  try {
    const data = req.body;
    if (!data.title || !data.title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const post = await BlogPost.create(data);
    res.status(201).json(post);
  } catch (err) {
    console.error('createPost error:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
}

// PUT /api/blog/:id  — admin only
export async function updatePost(req, res) {
  try {
    const post = await BlogPost.findOne({ id: req.params.id });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const updated = await BlogPost.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    console.error('updatePost error:', err);
    res.status(500).json({ error: 'Failed to update post' });
  }
}

// DELETE /api/blog/:id  — admin only
export async function deletePost(req, res) {
  try {
    const post = await BlogPost.findOne({ id: req.params.id });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    await BlogPost.delete(req.params.id);
    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
}

// PATCH /api/blog/:id/publish  — admin: toggle published
export async function togglePublish(req, res) {
  try {
    const post = await BlogPost.findOne({ id: req.params.id });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const updated = await BlogPost.update(req.params.id, { published: !post.published });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle publish status' });
  }
}

// PATCH /api/blog/:id/featured  — admin: toggle featured
export async function toggleFeatured(req, res) {
  try {
    const post = await BlogPost.findOne({ id: req.params.id });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const updated = await BlogPost.update(req.params.id, { featured: !post.featured });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle featured status' });
  }
}
