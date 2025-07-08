const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
require('dotenv').config();
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Add a simple health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'Server is running', port: PORT });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Initialize Firebase Admin
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  console.error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({
  credential: cert(serviceAccount),
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'auth':
          await handleAuth(ws, data);
          break;
        case 'audio':
          await handleAudio(ws, data);
          break;
        case 'text':
          await handleText(ws, data);
          break;
        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

async function handleAuth(ws, data) {
  try {
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(data.token);
    
    // Store user info in connection
    ws.userId = decodedToken.uid;
    ws.userEmail = decodedToken.email;
    
    ws.send(JSON.stringify({ 
      type: 'auth_success', 
      userId: decodedToken.uid,
      email: decodedToken.email 
    }));
  } catch (error) {
    console.error('Auth error:', error);
    ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }));
  }
}

async function handleAudio(ws, data) {
  // TODO: Implement audio handling with OpenAI Realtime API
  console.log('Audio message received from user:', ws.userId);
  
  // For now, just echo back
  ws.send(JSON.stringify({ 
    type: 'audio_response', 
    message: 'Audio processing not implemented yet' 
  }));
}

async function handleText(ws, data) {
  // TODO: Implement text handling with OpenAI API
  console.log('Text message received from user:', ws.userId, 'Message:', data.message);
  
  // For now, just echo back
  ws.send(JSON.stringify({ 
    type: 'text_response', 
    message: `Echo: ${data.message}` 
  }));
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});