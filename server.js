import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

function loadConfig() {
  return JSON.parse(readFileSync(join(__dirname, 'config.json'), 'utf8'));
}

function saveConfig(cfg) {
  writeFileSync(join(__dirname, 'config.json'), JSON.stringify(cfg, null, 2));
}

// Settings routes
app.get('/api/settings', (req, res) => {
  res.json(loadConfig());
});

app.post('/api/settings', (req, res) => {
  const cfg = loadConfig();
  Object.assign(cfg, req.body);
  saveConfig(cfg);
  res.json({ ok: true });
});

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Placeholder — routes added in Tasks 3–8
// TODO: import and mount experiment routes

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

export { app, upload, loadConfig };
