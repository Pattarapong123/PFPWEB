// src/config.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ระบุ path ของไฟล์ config สำหรับโหมด dev
const rootDir = path.join(__dirname, '..');
const cfgPath = path.join(rootDir, '..', 'config', 'app.config.json');

let cfg = { server: {}, db: {} };

// ----- โหลดจากไฟล์ (ถ้ามี) -----
if (fs.existsSync(cfgPath)) {
  try {
    const raw = fs.readFileSync(cfgPath, 'utf8');
    cfg = JSON.parse(raw);
  } catch (err) {
    console.error('[CONFIG] Invalid JSON in app.config.json');
    throw err;
  }
} else {
  console.warn(`[CONFIG] Not found local file, using environment variables`);
}

// ----- รวมค่า ENV ถ้ามี -----
const merged = {
  server: {
    port: Number(process.env.PORT || cfg.server?.port || 3000),
    session_secret: process.env.SESSION_SECRET || cfg.server?.session_secret || 'changeme',
    trust_proxy: process.env.TRUST_PROXY === 'true' || cfg.server?.trust_proxy || true,
  },
  db: {
    host: process.env.DB_HOST || cfg.db?.host || 'localhost',
    port: Number(process.env.DB_PORT || cfg.db?.port || 3306),
    user: process.env.DB_USER || cfg.db?.user || 'root',
    password: process.env.DB_PASS || cfg.db?.password || '',
    database: process.env.DB_NAME || cfg.db?.database || 'pfpserv_nodejs',
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || cfg.db?.connectionLimit || 10),
  }
};

export const config = merged;
