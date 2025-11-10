// src/server.js 
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cookieSession from 'cookie-session';
import morgan from 'morgan';
import multer from 'multer';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';

import { apiLimiter } from './middlewares/rateLimit.js';
import { config } from './config.js';
import { pool } from './db/pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();

// ====== Base settings ======
if (config.server.trust_proxy) app.set('trust proxy', 1);

// ====== Middlewares ======
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(cookieSession({
  name: 'sid',
  keys: [config.server.session_secret],
  httpOnly: true,
  sameSite: 'lax',
  secure: false, // dev/localhost = false
  maxAge: 7 * 24 * 60 * 60 * 1000
}));

// ====== Helper: render index.html + partials ======
function renderWithPartials(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');

  const headerPath = path.join(__dirname, '../public/partials/header.html');
  const footerPath = path.join(__dirname, '../public/partials/footer.html');

  const header = fs.existsSync(headerPath) ? fs.readFileSync(headerPath, 'utf8') : '';
  const footer = fs.existsSync(footerPath) ? fs.readFileSync(footerPath, 'utf8') : '';

  // ยืดหยุ่น: แทนที่แม้มีช่องว่าง/แอตทริบิวต์
  const headerRe = /<div\s+id=["']appHeader["'][^>]*>\s*<\/div>/i;
  const footerRe = /<div\s+id=["']appFooter["'][^>]*>\s*<\/div>/i;

  if (header) {
    if (headerRe.test(html)) html = html.replace(headerRe, header);
    else html = html.replace(/<section\b/i, `${header}<section`);
  }
  if (footer) {
    if (footerRe.test(html)) html = html.replace(footerRe, footer);
    else html = html.replace(/<\/body>/i, `${footer}</body>`);
  }

  return html;
}

// ====== หน้าแรก (ต้องประกาศก่อน express.static) ======
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, '../public', 'index.html');
  const html = renderWithPartials(indexPath);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ====== Static files (ปิดเสิร์ฟ index อัตโนมัติ) ======
app.use(express.static(path.join(__dirname, '../public'), { index: false }));
app.use('/public',  express.static(path.join(__dirname, '../public')));
app.use('/images',  express.static(path.join(__dirname, '../public/images')));
app.use('/partials',express.static(path.join(__dirname, '../public/partials')));
app.use('/js',      express.static(path.join(__dirname, '../public/js')));

// ====== Health Check ======
app.get('/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, db: rows[0].ok === 1 });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ====== Categories API ======
app.get('/categories', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, slug, parent_id, created_at, updated_at FROM categories ORDER BY id DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/categories', async (req, res) => {
  try {
    const { name, slug = null, parent_id = null } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });

    const [result] = await pool.query(
      'INSERT INTO categories (name, slug, parent_id) VALUES (?,?,?)',
      [name, slug, parent_id]
    );
    const [rows] = await pool.query(
      'SELECT id, name, slug, parent_id, created_at, updated_at FROM categories WHERE id=?',
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/categories/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM categories WHERE id=?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ====== Portfolio API (เพิ่มใหม่) ======

// GET: list ทั้งหมด
app.get('/portfolio', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, title, slug, summary, body, cover, created_at, updated_at FROM portfolio ORDER BY id DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET: อ่านทีละชิ้น (รับ id หรือ slug)
app.get('/portfolio/:idOrSlug', async (req, res) => {
  try {
    const v = req.params.idOrSlug;
    const isNum = /^\d+$/.test(v);
    const sql = isNum
      ? 'SELECT id, title, slug, summary, body, cover, created_at, updated_at FROM portfolio WHERE id=? LIMIT 1'
      : 'SELECT id, title, slug, summary, body, cover, created_at, updated_at FROM portfolio WHERE slug=? LIMIT 1';
    const [rows] = await pool.query(sql, [v]);
    if (!rows.length) return res.status(404).json({ ok:false, message:'not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST: สร้างใหม่ (เผื่อใช้หลังบ้าน)
app.post('/portfolio', async (req, res) => {
  try {
    const { title, slug=null, summary=null, body=null, cover=null } = req.body;
    if (!title) return res.status(400).json({ message: 'title is required' });

    const [result] = await pool.query(
      'INSERT INTO portfolio (title, slug, summary, body, cover) VALUES (?,?,?,?,?)',
      [title, slug, summary, body, cover]
    );
    const [rows] = await pool.query(
      'SELECT id, title, slug, summary, body, cover, created_at, updated_at FROM portfolio WHERE id=?',
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message });
  }
});

// PUT: แก้ไขทีละชิ้น (เลือกตาม id)
app.put('/portfolio/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, slug, summary, body, cover } = req.body;

    const [result] = await pool.query(
      'UPDATE portfolio SET title=COALESCE(?,title), slug=COALESCE(?,slug), summary=COALESCE(?,summary), body=COALESCE(?,body), cover=COALESCE(?,cover) WHERE id=?',
      [title ?? null, slug ?? null, summary ?? null, body ?? null, cover ?? null, id]
    );
    if (!result.affectedRows) return res.status(404).json({ message:'not found' });

    const [rows] = await pool.query(
      'SELECT id, title, slug, summary, body, cover, created_at, updated_at FROM portfolio WHERE id=?',
      [id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message });
  }
});

// DELETE: ลบทีละชิ้น
app.delete('/portfolio/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM portfolio WHERE id=?', [id]);
    if (!result.affectedRows) return res.status(404).json({ message:'not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message });
  }
});

// ====== API limiter (สำรอง) ======
app.use('/api', apiLimiter);

// ====== Upload ตัวอย่าง ======
const upload = multer({ dest: path.join(__dirname, '../public/uploads') });
app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ filename: req.file.filename, originalname: req.file.originalname });
});

// ====== (ตัวช่วย debug – เอาออกได้ภายหลัง) ======
app.get('/__diag', (req, res) => {
  const indexPath  = path.join(__dirname, '../public/index.html');
  const headerPath = path.join(__dirname, '../public/partials/header.html');
  const footerPath = path.join(__dirname, '../public/partials/footer.html');
  res.json({
    indexPath, headerPath, footerPath,
    exists: {
      index: fs.existsSync(indexPath),
      header: fs.existsSync(headerPath),
      footer: fs.existsSync(footerPath),
    }
  });
});

app.get('/__rendered', (req, res) => {
  const indexPath = path.join(__dirname, '../public', 'index.html');
  const html = renderWithPartials(indexPath);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ====== 404 fallback ======
app.use((req, res) => {
  const accept = req.headers.accept || '';
  if (accept.includes('text/html')) {
    const indexPath = path.join(__dirname, '../public', 'index.html');
    const html = renderWithPartials(indexPath);
    res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
  } else {
    res.status(404).json({ ok:false, error:'Not Found' });
  }
});

// ====== Start server ======
const PORT = Number(config.server.port || 3000);
app.listen(PORT, () => {
  console.log(`[OK] Server listening on http://localhost:${PORT}`);
});
