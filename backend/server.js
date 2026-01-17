const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const server = http.createServer(app);
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

app.use(cors());
app.use(express.json());

const SPEECH_FILE = path.join(__dirname, 'speech.json');
const PRESENTER_PASSWORD = process.env.PRESENTER_PASSWORD;
if (!PRESENTER_PASSWORD) {
  console.error('ERROR: PRESENTER_PASSWORD environment variable is required');
  console.error('Please set PRESENTER_PASSWORD before starting the server');
  process.exit(1);
}
const HOST = process.env.HOST || '0.0.0.0'; // 0.0.0.0 listens on all interfaces
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Load speech content
async function loadSpeech() {
  try {
    const data = await fs.readFile(SPEECH_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Create default speech file if it doesn't exist
    const defaultSpeech = {
      sections: [
        "Welcome everyone! Today I'm excited to share with you some important insights.",
        "First, let's discuss the current state of technology and how it's evolving.",
        "Technology has transformed the way we work, communicate, and live our daily lives.",
        "As we move forward, it's crucial to understand the implications of these changes.",
        "Thank you for your attention. I'm happy to answer any questions you may have."
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

// Initialize state
loadSpeech().then(() => {
  console.log('Speech content loaded');
});

// API Routes - mounted under /speech
app.get('/speech/api/speech', async (req, res) => {
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
      languages: allowedLangs.filter(l => speech[l])
    });
  } catch (error) {
    console.error('Error loading speech:', error);
    res.status(500).json({ error: 'Failed to load speech content' });
  }
});

// Simple rate limiting for auth endpoint
const authAttempts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

app.post('/speech/api/auth', (req, res) => {
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

app.post('/speech/api/next', async (req, res) => {
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

app.post('/speech/api/reset', async (req, res) => {
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
  try {
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
  } catch (error) {
    console.error('Error sending initial state:', error);
  }

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, HOST, () => {
  console.log(`Backend server running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});
