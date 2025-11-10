
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const cfgPath = path.join(rootDir, '..', 'config', 'app.config.json');

let raw = '{}';
try {
  raw = fs.readFileSync(cfgPath, 'utf8');
} catch (err) {
  console.error(`[CONFIG] Not found: ${cfgPath}`);
  throw new Error('Missing config/app.config.json — create it from app.config.sample.json');
}

let cfg;
try {
  cfg = JSON.parse(raw);
} catch (err) {
  console.error('[CONFIG] Invalid JSON in app.config.json');
  throw err;
}

function must(obj, keys) {
  let cur = obj;
  for (const k of keys) {
    if (cur?.[k] === undefined || cur?.[k] === null || cur?.[k] === '') {
      throw new Error(`Missing config key: ${keys.join('.')}`);
    }
    cur = cur[k];
  }
}

must(cfg, ['server', 'session_secret']);
must(cfg, ['db', 'host']);
must(cfg, ['db', 'user']);
must(cfg, ['db', 'database']);

export const config = {
  server: {
    port: Number(cfg.server?.port ?? 3000),
    session_secret: String(cfg.server.session_secret),
    trust_proxy: Boolean(cfg.server?.trust_proxy ?? true),
  },
  db: {
    host: String(cfg.db.host),
    port: Number(cfg.db?.port ?? 3306),
    user: String(cfg.db.user),
    password: String(cfg.db?.password ?? ''),
    database: String(cfg.db.database),
    connectionLimit: Number(cfg.db?.connectionLimit ?? 10),
  }
};
