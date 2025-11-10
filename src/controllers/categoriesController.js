
import { pool } from '../db/pool.js';

export async function listCategories(req, res) {
  const [rows] = await pool.query('SELECT id, name, slug, parent_id, created_at, updated_at FROM categories ORDER BY id DESC LIMIT 100');
  res.json(rows);
}

export async function getCategory(req, res) {
  const [rows] = await pool.query('SELECT id, name, slug, parent_id, created_at, updated_at FROM categories WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Not found' });
  res.json(rows[0]);
}

export async function createCategory(req, res) {
  const { name, slug, parent_id = null } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required' });
  const [result] = await pool.query(
    'INSERT INTO categories (name, slug, parent_id) VALUES (?, ?, ?)',
    [name, slug || null, parent_id]
  );
  const [rows] = await pool.query('SELECT id, name, slug, parent_id, created_at, updated_at FROM categories WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
}

export async function updateCategory(req, res) {
  const { name, slug, parent_id = null } = req.body;
  const [result] = await pool.query(
    'UPDATE categories SET name = COALESCE(?, name), slug = COALESCE(?, slug), parent_id = ? WHERE id = ?',
    [name ?? null, slug ?? null, parent_id, req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ message: 'Not found' });
  const [rows] = await pool.query('SELECT id, name, slug, parent_id, created_at, updated_at FROM categories WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
}

export async function deleteCategory(req, res) {
  const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: 'Not found' });
  res.status(204).send();
}
