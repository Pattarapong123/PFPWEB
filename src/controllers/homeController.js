import path from 'path';
import { fileURLToPath } from 'url';
import { healthCheck } from '../db/pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

export async function getRoot(req, res) {
  const htmlPath = path.join(__dirname, '..', '..', 'public', 'index.html');
  res.sendFile(htmlPath);
}

export async function getHealth(req, res) {
  try {
    const dbOk = await healthCheck();
    res.json({ ok: true, db: dbOk });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
