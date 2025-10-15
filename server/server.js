import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// In-memory cache
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_CACHE_SIZE = 1000; // Maximum number of cached items

// Cache utility functions
function generateCacheKey(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function getCached(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`Cache HIT for key: ${key.substring(0, 8)}...`);
    return cached.data;
  }
  if (cached) {
    cache.delete(key); // Remove expired entry
  }
  console.log(`Cache MISS for key: ${key.substring(0, 8)}...`);
  return null;
}

function setCached(key, data) {
  // Remove oldest entries if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
    console.log('Cache full, removed oldest entry');
  }
  
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
  console.log(`Cached result for key: ${key.substring(0, 8)}...`);
}

// CORS for Chrome extension
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin 
    if (!origin) return callback(null, true);
    
    // Allow Chrome extension origins
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    
    // Allow Vercel domains
    if (origin.match(/^https:\/\/.*\.vercel\.app$/)) {
      return callback(null, true);
    }
    
    // Allow localhost for development
    if (origin.includes('localhost')) {
      return callback(null, true);
    }
    
    // Default allow for now 
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));

// Handle preflight requests explicitly
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'DSA Solver Proxy Server is running!',
    version: '1.0.0'
  });
});

// Simple test endpoint that bypasses authentication
app.get('/test', (req, res) => {
  res.json({ 
    status: 'Server is working!',
    timestamp: new Date().toISOString(),
    env: {
      hasGoogleKey: !!process.env.GOOGLE_VISION_API_KEY,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY
    }
  });
});

// Google Vision API proxy with caching
app.post('/api/vision', async (req, res) => {
  try {
    console.log('Vision API request received');
    
    if (!process.env.GOOGLE_VISION_API_KEY) {
      return res.status(500).json({ error: 'Google Vision API key not configured' });
    }

    // Generate cache key from image content
    const cacheKey = generateCacheKey(req.body);
    
    // Check cache first
    const cachedResult = getCached(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vision API error:', errorText);
      return res.status(response.status).json({ error: errorText });
    }
    
    const data = await response.json();
    
    // Cache the result
    setCached(cacheKey, data);
    
    res.json(data);
  } catch (error) {
    console.error('Vision API proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// OpenAI API proxy with caching
app.post('/api/openai', async (req, res) => {
  try {
    console.log('OpenAI API request received');
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Only cache non-streaming requests
    if (!req.body.stream) {
      const cacheKey = generateCacheKey({
        messages: req.body.messages,
        model: req.body.model
      });
      
      const cachedResult = getCached(cacheKey);
      if (cachedResult) {
        return res.json(cachedResult);
      }
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(req.body)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return res.status(response.status).json({ error: errorText });
    }
    
    // Handle streaming response
    if (req.body.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      response.body.pipe(res);
    } else {
      const data = await response.json();
      
      // Cache non-streaming responses
      const cacheKey = generateCacheKey({
        messages: req.body.messages,
        model: req.body.model
      });
      setCached(cacheKey, data);
      
      res.json(data);
    }
  } catch (error) {
    console.error('OpenAI API proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Privacy policy route
app.get('/privacy', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LeetGoat Privacy Policy</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px; 
            line-height: 1.6; 
        }
        h1 { color: #333; }
        h2 { color: #666; }
    </style>
</head>
<body>
    <h1>Privacy Policy for LeetGoat</h1>
    <p>Last updated: ${new Date().toDateString()}</p>
    
    <h2>What We Collect</h2>
    <p>LeetGoat captures screenshots of coding problem pages when you click the capture button. No personal information or browsing history is collected.</p>
    
    <h2>How We Use Your Data</h2>
    <ul>
        <li>Screenshots are sent to our servers for text extraction using Google Vision API</li>
        <li>Extracted text is sent to OpenAI for problem analysis and solution generation</li>
        <li>All processing happens in real-time during your session</li>
    </ul>
    
    <h2>Data Storage</h2>
    <p>We do not permanently store screenshots, extracted text, or generated solutions. Data is processed temporarily and discarded after each session.</p>
    
    <h2>Third-Party Services</h2>
    <p>We use Google Vision API for text extraction and OpenAI API for solution generation. These services have their own privacy policies.</p>
    
    <h2>Contact</h2>
    <p>For privacy concerns, contact: tipreaditya@gmail.com</p>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`Google Vision API Key: ${process.env.GOOGLE_VISION_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`Cache: ${MAX_CACHE_SIZE} items, ${CACHE_TTL / 1000 / 60} min TTL`);
}); 