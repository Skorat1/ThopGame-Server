import { query, isMySQLConnected } from '../config/db.js';

function formatPost(row) {
  if (!row) return null;
  return {
    ...row,
    tags: (() => {
      if (!row.tags) return [];
      if (Array.isArray(row.tags)) return row.tags;
      try { return JSON.parse(row.tags); }
      catch { return String(row.tags).split(',').map(t => t.trim()).filter(Boolean); }
    })(),
    published: Boolean(row.published === 1 || row.published === true),
    featured: Boolean(row.featured === 1 || row.featured === true),
    views: Number(row.views || 0),
    readTime: row.readTime || '3 min read'
  };
}

export const BlogPost = {
  async ensureTable() {
    if (!isMySQLConnected()) return;
    await query(`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        excerpt TEXT,
        content LONGTEXT,
        category VARCHAR(100) DEFAULT 'news',
        author VARCHAR(200) DEFAULT 'ThopGames Editorial',
        tags JSON,
        gradient VARCHAR(200) DEFAULT 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        emoji VARCHAR(10) DEFAULT '📰',
        published TINYINT(1) DEFAULT 1,
        featured TINYINT(1) DEFAULT 0,
        views INT DEFAULT 0,
        readTime VARCHAR(50) DEFAULT '3 min read',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  },

  async countDocuments() {
    if (!isMySQLConnected()) return 0;
    const rows = await query('SELECT COUNT(*) AS count FROM blog_posts');
    return rows[0]?.count || 0;
  },

  async find(filter = {}) {
    if (!isMySQLConnected()) return [];
    let sql = 'SELECT * FROM blog_posts WHERE 1=1';
    const params = [];

    if (filter.published !== undefined) {
      sql += ' AND published = ?';
      params.push(filter.published ? 1 : 0);
    }
    if (filter.category && filter.category !== 'all') {
      sql += ' AND LOWER(category) = LOWER(?)';
      params.push(filter.category);
    }
    if (filter.featured === true) {
      sql += ' AND featured = 1';
    }
    if (filter.search) {
      sql += ' AND (LOWER(title) LIKE ? OR LOWER(excerpt) LIKE ? OR LOWER(tags) LIKE ?)';
      const term = `%${String(filter.search).toLowerCase()}%`;
      params.push(term, term, term);
    }
    sql += ' ORDER BY featured DESC, createdAt DESC';
    if (filter.limit) sql += ` LIMIT ${Number(filter.limit)}`;

    const rows = await query(sql, params);
    return rows.map(formatPost);
  },

  async findOne(filter = {}) {
    if (!isMySQLConnected()) return null;
    let sql = 'SELECT * FROM blog_posts WHERE 1=1';
    const params = [];
    if (filter.id) { sql += ' AND id = ?'; params.push(filter.id); }
    sql += ' LIMIT 1';
    const rows = await query(sql, params);
    return rows.length > 0 ? formatPost(rows[0]) : null;
  },

  async create(data) {
    if (!isMySQLConnected()) return data;
    await this.ensureTable();
    const post = { ...data };
    if (!post.id) {
      post.id = (post.title || 'post').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 60) + '-' + Date.now().toString().slice(-5);
    }
    const tagsJson = JSON.stringify(Array.isArray(post.tags) ? post.tags : []);
    await query(`
      INSERT INTO blog_posts (id, title, excerpt, content, category, author, tags, gradient, emoji, published, featured, views, readTime, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      post.id,
      post.title || 'Untitled Post',
      post.excerpt || '',
      post.content || '',
      post.category || 'news',
      post.author || 'ThopGames Editorial',
      tagsJson,
      post.gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      post.emoji || '📰',
      post.published !== false ? 1 : 0,
      post.featured ? 1 : 0,
      Number(post.views || 0),
      post.readTime || '3 min read'
    ]);
    return formatPost(post);
  },

  async update(id, data) {
    if (!isMySQLConnected()) return null;
    const setClauses = [];
    const params = [];
    const allowed = ['title', 'excerpt', 'content', 'category', 'author', 'gradient', 'emoji', 'published', 'featured', 'readTime', 'tags'];
    for (const key of allowed) {
      if (data[key] === undefined) continue;
      if (key === 'tags') {
        setClauses.push('`tags` = ?');
        params.push(JSON.stringify(Array.isArray(data.tags) ? data.tags : []));
      } else if (key === 'published' || key === 'featured') {
        setClauses.push(`\`${key}\` = ?`);
        params.push(data[key] ? 1 : 0);
      } else {
        setClauses.push(`\`${key}\` = ?`);
        params.push(data[key]);
      }
    }
    if (setClauses.length === 0) return this.findOne({ id });
    setClauses.push('updatedAt = NOW()');
    params.push(id);
    await query(`UPDATE blog_posts SET ${setClauses.join(', ')} WHERE id = ?`, params);
    return this.findOne({ id });
  },

  async delete(id) {
    if (!isMySQLConnected()) return;
    await query('DELETE FROM blog_posts WHERE id = ?', [id]);
  },

  async incrementViews(id) {
    if (!isMySQLConnected()) return;
    await query('UPDATE blog_posts SET views = views + 1 WHERE id = ?', [id]);
  }
};
