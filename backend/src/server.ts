import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

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

async function handleAuth(ws: WebSocket & { userId?: string; userEmail?: string }, data: any) {
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

async function handleAudio(ws: WebSocket & { userId?: string }, data: any) {
  // TODO: Implement audio handling with OpenAI Realtime API
  console.log('Audio message received from user:', ws.userId);
  
  // For now, just echo back
  ws.send(JSON.stringify({ 
    type: 'audio_response', 
    message: 'Audio processing not implemented yet' 
  }));
}

async function handleText(ws: WebSocket & { userId?: string }, data: any) {
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