const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const express = require('express');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Backend configuration
const SPEECH_FILE = path.join(__dirname, '..', 'backend', 'speech.json');
const PRESENTER_PASSWORD = process.env.PRESENTER_PASSWORD;
if (!PRESENTER_PASSWORD) {
  console.error('ERROR: PRESENTER_PASSWORD environment variable is required');
  console.error('Please set PRESENTER_PASSWORD before starting the server');
  process.exit(1);
}

// Load speech content
async function loadSpeech() {
  try {
    const data = await fs.readFile(SPEECH_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Create default speech file if it doesn't exist
    const defaultSpeech = {
      en: [
        "Welcome everyone! Today I'm excited to share with you some important insights.",
        "First, let's discuss the current state of technology and how it's evolving.",
        "Technology has transformed the way we work, communicate, and live our daily lives.",
        "As we move forward, it's crucial to understand the implications of these changes.",
        "Thank you for your attention. I'm happy to answer any questions you may have."
      ],
      fr: [
        "Bienvenue à tous ! Aujourd'hui, je suis ravi de partager avec vous des informations importantes.",
        "Tout d'abord, discutons de l'état actuel de la technologie et de son évolution.",
        "La technologie a transformé notre façon de travailler, de communiquer et de vivre.",
        "Alors que nous avançons, il est crucial de comprendre les implications de ces changements.",
        "Merci pour votre attention. Je suis heureux de répondre à toutes vos questions."
      ],
      de: [
        "Willkommen alle! Heute freue ich mich, Ihnen einige wichtige Erkenntnisse zu präsentieren.",
        "Zunächst wollen wir den aktuellen Stand der Technologie und ihre Entwicklung diskutieren.",
        "Die Technologie hat unsere Art zu arbeiten, zu kommunizieren und zu leben verändert.",
        "Während wir voranschreiten, ist es entscheidend, die Auswirkungen dieser Veränderungen zu verstehen.",
        "Vielen Dank für Ihre Aufmerksamkeit. Ich beantworte gerne alle Ihre Fragen."
      ]
    };
    await fs.writeFile(SPEECH_FILE, JSON.stringify(defaultSpeech, null, 2));
    return defaultSpeech;
  }
}

// Current state
let currentState = {
  currentSectionIndex: -1,
  isRendering: false,
  renderedText: ''
};

app.prepare().then(() => {
  const expressApp = express();
  const server = createServer(expressApp);
  
  // CORS configuration - restrict in production
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];
  
  const io = socketIo(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? allowedOrigins : "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    path: '/speech/socket.io/'
  });

  expressApp.use(cors({
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : "*",
    credentials: true
  }));
  expressApp.use(express.json());

  // Simple rate limiting for auth endpoint
  const authAttempts = new Map();
  const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  const MAX_ATTEMPTS = 5;

  // API Routes - mounted under /speech/api
  expressApp.post('/speech/api/auth', (req, res) => {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    // Clean old entries
    if (authAttempts.has(clientIp)) {
      const attempts = authAttempts.get(clientIp);
      if (now - attempts.firstAttempt > RATE_LIMIT_WINDOW) {
        authAttempts.delete(clientIp);
      }
    }
    
    // Check rate limit
    if (authAttempts.has(clientIp)) {
      const attempts = authAttempts.get(clientIp);
      if (attempts.count >= MAX_ATTEMPTS) {
        return res.status(429).json({ 
          success: false, 
          error: 'Too many attempts. Please try again later.' 
        });
      }
      attempts.count++;
    } else {
      authAttempts.set(clientIp, { count: 1, firstAttempt: now });
    }
    
    const { password } = req.body;
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, error: 'Password required' });
    }
    
    if (password === PRESENTER_PASSWORD) {
      authAttempts.delete(clientIp); // Reset on success
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: 'Invalid password' });
    }
  });

  expressApp.get('/speech/api/speech', async (req, res) => {
    try {
      const speech = await loadSpeech();
      // Validate language code - whitelist approach
      const allowedLangs = ['en', 'fr', 'de'];
      const lang = allowedLangs.includes(req.query.lang) ? req.query.lang : 'en';
      const sections = speech[lang] || speech.en || [];
      
      res.json({
        sections: sections,
        currentSectionIndex: currentState.currentSectionIndex,
        isRendering: currentState.isRendering,
        renderedText: currentState.renderedText,
        languages: allowedLangs.filter(l => speech[l]) // Return available languages
      });
    } catch (error) {
      console.error('Error loading speech:', error);
      res.status(500).json({ error: 'Failed to load speech content' });
    }
  });

  expressApp.post('/speech/api/next', async (req, res) => {
    const { password } = req.body;
    if (!password || typeof password !== 'string' || password !== PRESENTER_PASSWORD) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const speech = await loadSpeech();
      const englishSections = speech.en || [];
      
      if (currentState.currentSectionIndex >= englishSections.length - 1) {
        return res.json({ success: false, error: 'No more sections' });
      }

      currentState.currentSectionIndex++;
      currentState.isRendering = true;
      currentState.renderedText = '';

      // Broadcast to all clients with all language versions
      io.emit('nextSection', {
        sectionIndex: currentState.currentSectionIndex,
        sectionText: {
          en: englishSections[currentState.currentSectionIndex],
          fr: speech.fr?.[currentState.currentSectionIndex] || '',
          de: speech.de?.[currentState.currentSectionIndex] || ''
        },
        isRendering: true
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error advancing section:', error);
      res.status(500).json({ error: 'Failed to advance section' });
    }
  });

  expressApp.post('/speech/api/reset', async (req, res) => {
    const { password } = req.body;
    if (!password || typeof password !== 'string' || password !== PRESENTER_PASSWORD) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    currentState.currentSectionIndex = -1;
    currentState.isRendering = false;
    currentState.renderedText = '';

    io.emit('reset');

    res.json({ success: true });
  });

  // Socket.io connection handling
  io.on('connection', async (socket) => {
    console.log('Client connected:', socket.id);

    // Send current state to newly connected client
    const speech = await loadSpeech();
    const englishSections = speech.en || [];
    const stateToSend = {
      ...currentState,
      sectionText: currentState.currentSectionIndex >= 0 
        ? {
            en: englishSections[currentState.currentSectionIndex] || '',
            fr: speech.fr?.[currentState.currentSectionIndex] || '',
            de: speech.de?.[currentState.currentSectionIndex] || ''
          }
        : { en: '', fr: '', de: '' }
    };
    socket.emit('currentState', stateToSend);

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Handle all other routes with Next.js
  expressApp.all('*', (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  server.listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname === '0.0.0.0' ? 'localhost' : hostname}:${port}`);
    console.log(`> Backend API available at http://${hostname === '0.0.0.0' ? 'localhost' : hostname}:${port}/speech/api`);
  });
});
