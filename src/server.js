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
const isProd = process.env.NODE_ENV === 'production';

const app = express();

// ---- รองรับ reverse proxy ของ Plesk/Apache/Nginx ----
app.set('trust proxy', 1);

// ---- Security / Performance ----
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // ให้รูปใน /images แสดงได้
}));
app.use(compression());

// ---- CORS (ถ้าเปิด API ให้ frontend ภายนอก) ----
// ใส่โดเมนของคุณแทน example.com
app.use(cors({
  origin: [/^https?:\/\/(www\.)?example\.com$/], // หรือ [] ถ้าไม่ต้องการ CORS
  credentials: false
}));

// ---- Logs / Body ----
app.use(morgan(isProd ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ---- Session Cookie (secure ใน production) ----
app.use(cookieSession({
  name: 'sid',
  keys: [process.env.SESSION_SECRET || config.server.session_secret || 'change-me'],
  httpOnly: true,
  sameSite: 'lax',
  secure: isProd,               // สำคัญ: true เมื่ออยู่หลัง HTTPS ของ Plesk
  maxAge: 7 * 24 * 60 * 60 * 1000
}));

// ---- รวม partials ลงใน index.html ----
function renderWithPartials(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');

  const headerPath = path.join(__dirname, '../public/partials/header.html');
  const footerPath = path.join(__dirname, '../public/partials/footer.html');

  const header = fs.existsSync(headerPath) ? fs.readFileSync(headerPath, 'utf8') : '';
  const footer = fs.existsSync(footerPath) ? fs.readFileSync(footerPath, 'utf8') : '';

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

// ---- หน้าแรก (ต้องมาก่อน static) ----
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, '../public', 'index.html');
  const html = renderWithPartials(indexPath);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ---- Static ----
app.use(express.static(path.join(__dirname, '../public'), { index: false }));
app.use('/public',  express.static(path.join(__dirname, '../public')));
app.use('/images',  express.static(path.join(__dirname, '../public/images')));
app.use('/partials',express.static(path.join(__dirname, '../public/partials')));

// ---- Health ----
app.get('/health', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, db: rows[0].ok === 1 });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- Categories API (เดิม) ----
app.get('/categories', async (_req, res) => {
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

// ---- Upload (แน่ใจว่าโฟลเดอร์นี้มีสิทธิ์เขียน) ----
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });
app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ filename: req.file.filename, originalname: req.file.originalname });
});

// ---- (ปิด route debug ใน production) ----
if (!isProd) {
  app.get('/__diag', (_req, res) => {
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

  app.get('/__rendered', (_req, res) => {
    const indexPath = path.join(__dirname, '../public', 'index.html');
    const html = renderWithPartials(indexPath);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });
}

// ---- 404 fallback (HTML กลับไปที่ index) ----
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

// ---- Start ----
const PORT = Number(process.env.PORT || config.server.port || 3000);
app.listen(PORT, () => {
  console.log(`[OK] Server listening on http://localhost:${PORT}`);
});
