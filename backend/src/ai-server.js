const http = require('http');
const { WebSocketServer } = require('ws');
const OpenAI = require('openai');
require('dotenv').config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    message: 'Skye AI Assistant Server is running!',
    features: ['text-chat', 'ai-responses']
  }));
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  // Send welcome message
  ws.send(JSON.stringify({ 
    type: 'welcome', 
    message: 'Connected to Skye AI Assistant! 🧠✨' 
  }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received:', data);
      
      switch (data.type) {
        case 'text':
          await handleTextMessage(ws, data);
          break;
        case 'audio':
          await handleAudioMessage(ws, data);
          break;
        default:
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Unknown message type' 
          }));
      }
    } catch (error) {
      console.error('Error:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid message format' 
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

async function handleTextMessage(ws, data) {
  try {
    // Send typing indicator
    ws.send(JSON.stringify({ 
      type: 'typing', 
      message: 'Skye is thinking...' 
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are Skye, a kind and attentive AI assistant. You remember your users' preferences, past conversations, and adapt over time. You can speak and listen. Keep responses conversational and helpful. Use emojis occasionally to add personality."
        },
        {
          role: "user",
          content: data.message
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const aiResponse = completion.choices[0].message.content;

    ws.send(JSON.stringify({ 
      type: 'ai_response', 
      message: aiResponse,
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    console.error('OpenAI error:', error);
    
    let errorMessage = 'Sorry, I had trouble processing that. ';
    if (error.code === 'invalid_api_key') {
      errorMessage += 'OpenAI API key is not configured properly.';
    } else if (error.code === 'insufficient_quota') {
      errorMessage += 'OpenAI API quota exceeded.';
    } else {
      errorMessage += 'Please try again.';
    }

    ws.send(JSON.stringify({ 
      type: 'error', 
      message: errorMessage
    }));
  }
}

async function handleAudioMessage(ws, data) {
  // For now, just acknowledge audio messages
  ws.send(JSON.stringify({ 
    type: 'audio_response', 
    message: 'Audio processing will be implemented next! 🎤' 
  }));
}

const PORT = 3006;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`🧠 Skye AI Assistant Server running on http://127.0.0.1:${PORT}`);
  console.log(`WebSocket endpoint: ws://127.0.0.1:${PORT}`);
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  OpenAI API key not found. Set OPENAI_API_KEY in .env file.');
  } else {
    console.log('✅ OpenAI API key configured');
  }
});

server.on('error', (err) => {
  console.error('Server error:', err);
});