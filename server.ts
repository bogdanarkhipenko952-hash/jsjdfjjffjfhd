import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import AdmZip from 'adm-zip';
import crypto from 'crypto';

const app = express();
const PORT = 3000;

app.use(express.json());

// Databases
const DB_FILE = path.join(process.cwd(), 'cloud_saves.json');
const GAMES_DB = path.join(process.cwd(), 'games.json');

// Directories
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const GAMES_DIR = path.join(process.cwd(), 'data', 'games');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(GAMES_DIR)) fs.mkdirSync(GAMES_DIR, { recursive: true });

app.use('/games', express.static(GAMES_DIR));

const upload = multer({ dest: UPLOADS_DIR });

function readDb(file: string) {
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } 
  catch { return {}; }
}
function writeDb(file: string, data: any) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// API Routes
app.post('/api/save', (req, res) => {
  const { syncCode, progress } = req.body;
  if (!syncCode) return res.status(400).json({ error: 'Sync code is required' });
  const db = readDb(DB_FILE);
  db[syncCode] = progress;
  writeDb(DB_FILE, db);
  res.json({ success: true });
});

app.get('/api/load/:syncCode', (req, res) => {
  const { syncCode } = req.params;
  const db = readDb(DB_FILE);
  res.json({ progress: db[syncCode] || null });
});

// Games API
app.get('/api/games', (req, res) => {
  const db = readDb(GAMES_DB);
  res.json(Object.values(db));
});

app.post('/api/install', (req, res) => {
  const { id, title, type, bg } = req.body;
  const db = readDb(GAMES_DB);
  db[id] = { id, title, type, bg, source: 'store' };
  writeDb(GAMES_DB, db);
  res.json({ success: true });
});

app.post('/api/upload-game', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const id = 'custom_' + crypto.randomBytes(4).toString('hex');
    const extractPath = path.join(GAMES_DIR, id);
    
    const zip = new AdmZip(req.file.path);
    zip.extractAllTo(extractPath, true);
    
    fs.unlinkSync(req.file.path); // cleanup zip

    // Find files recursively
    const getAllFiles = (dirPath: string, arrayOfFiles: string[] = []) => {
      const files = fs.readdirSync(dirPath);
      files.forEach(file => {
        if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
          arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
        } else {
          arrayOfFiles.push(path.join(dirPath, file));
        }
      });
      return arrayOfFiles;
    };

    const allFiles = getAllFiles(extractPath);
    
    const htmlFilePath = allFiles.find(f => f.toLowerCase().endsWith('.html'));
    if (!htmlFilePath) {
      fs.rmSync(extractPath, { recursive: true, force: true });
      return res.status(400).json({ error: 'ZIP must contain an HTML file' });
    }
    
    const htmlRelativePath = path.relative(extractPath, htmlFilePath).replace(/\\/g, '/');

    const jpgFilePath = allFiles.find(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg'));
    const pngFilePath = allFiles.find(f => f.toLowerCase().endsWith('.png'));

    let bg = 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&q=80&w=2000';
    if (pngFilePath) {
      bg = `/games/${id}/${path.relative(extractPath, pngFilePath).replace(/\\/g, '/')}`;
    }

    let thumb = undefined;
    if (jpgFilePath) {
      thumb = `/games/${id}/${path.relative(extractPath, jpgFilePath).replace(/\\/g, '/')}`;
    }
    
    let title = req.body.title || path.basename(htmlFilePath, '.html');
    if (!title || title.toLowerCase() === 'index') {
       title = 'Custom Game';
    }
    
    const db = readDb(GAMES_DB);
    db[id] = { 
      id, 
      title, 
      type: 'custom', 
      bg, 
      thumb,
      url: `/games/${id}/${htmlRelativePath}` 
    };
    writeDb(GAMES_DB, db);
    
    res.json({ success: true, game: db[id] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to process game ZIP' });
  }
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PlayOS 5 Server running on port ${PORT}`);
  });
}

startServer();
