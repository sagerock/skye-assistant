const http = require('http');
const { WebSocketServer } = require('ws');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    message: 'Skye AI Assistant Server is running!',
    features: ['text-chat', 'openai-gpt4o', 'voice-recording'],
    status: 'active',
    openai: process.env.OPENAI_API_KEY ? 'configured' : 'missing'
  }));
});

const wss = new WebSocketServer({ server });

console.log('Setting up WebSocket server...');

wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  
  // Send welcome message
  ws.send(JSON.stringify({ 
    type: 'welcome', 
    message: 'Connected to Skye AI Assistant! 🧠✨ Ready to chat!' 
  }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received message:', data);
      
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
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid message format' 
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

async function handleTextMessage(ws, data) {
  try {
    console.log('Processing text message:', data.message);
    
    // Send typing indicator
    ws.send(JSON.stringify({ 
      type: 'typing', 
      message: 'Skye is thinking...' 
    }));

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      ws.send(JSON.stringify({ 
        type: 'ai_response', 
        message: "I'd love to give you a smart response, but my OpenAI API key isn't configured yet! For now, I can still chat with basic responses. 😊"
      }));
      return;
    }

    // Get real AI response from OpenAI GPT-4o
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are Skye, a kind, intelligent, and helpful AI assistant. You have a warm personality and care about the user's wellbeing. Key traits:
          - Be conversational and friendly, but not overly casual
          - Use emojis occasionally to add warmth (but don't overdo it)
          - Remember you can see and hear (user might send voice messages)
          - Be curious about the user and ask follow-up questions when appropriate
          - Provide helpful, accurate information
          - If you don't know something, be honest about it
          - Keep responses concise but thoughtful (2-3 sentences usually)
          - Adapt your communication style to match the user's tone`
        },
        {
          role: "user",
          content: data.message
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    const aiResponse = completion.choices[0].message.content;

    ws.send(JSON.stringify({ 
      type: 'ai_response', 
      message: aiResponse,
      timestamp: new Date().toISOString(),
      model: 'gpt-4o-mini'
    }));

    console.log('Sent OpenAI response:', aiResponse);

  } catch (error) {
    console.error('Error in handleTextMessage:', error);
    
    let errorMessage = 'Sorry, I had trouble processing that. ';
    if (error.code === 'invalid_api_key') {
      errorMessage += 'My OpenAI API key seems to be invalid. 🔑';
    } else if (error.code === 'insufficient_quota') {
      errorMessage += 'I\'ve reached my API limit for now. 📊';
    } else if (error.message?.includes('rate limit')) {
      errorMessage += 'I\'m getting too many requests right now. Please try again in a moment! ⏰';
    } else {
      errorMessage += 'Please try again! 😊';
    }
    
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: errorMessage
    }));
  }
}

async function handleAudioMessage(ws, data) {
  try {
    console.log('Processing audio message, size:', data.size);
    
    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      ws.send(JSON.stringify({ 
        type: 'ai_response', 
        message: 'I heard your audio message! 🎤 But I need an OpenAI API key to transcribe speech. For now, try typing your message! 😊' 
      }));
      return;
    }

    // Send processing indicator
    ws.send(JSON.stringify({ 
      type: 'processing', 
      message: 'Listening to your voice... 🎧' 
    }));

    // Convert base64 audio to buffer
    if (!data.audioData) {
      throw new Error('No audio data provided');
    }

    const audioBuffer = Buffer.from(data.audioData, 'base64');
    
    // Create temporary file for Whisper API
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tempDir, `audio_${Date.now()}.webm`);
    fs.writeFileSync(tempFilePath, audioBuffer);

    try {
      // Transcribe with OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1',
        language: 'en', // You can remove this to auto-detect
        response_format: 'json'
      });

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      const transcribedText = transcription.text.trim();
      
      if (!transcribedText) {
        ws.send(JSON.stringify({ 
          type: 'ai_response', 
          message: "I couldn't quite catch what you said. Could you try speaking a bit clearer or louder? 🎤" 
        }));
        return;
      }

      console.log('Transcribed:', transcribedText);

      // Send the transcribed text back to user first
      ws.send(JSON.stringify({ 
        type: 'transcription', 
        message: transcribedText,
        original: 'voice'
      }));

      // Now process the transcribed text as a regular text message
      // Add a small delay to ensure transcription message is sent first
      setTimeout(async () => {
        await handleTextMessage(ws, { message: transcribedText });
      }, 100);

    } catch (error) {
      // Clean up temp file on error
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      throw error;
    }

  } catch (error) {
    console.error('Error processing audio:', error);
    
    let errorMessage = 'Sorry, I had trouble understanding your voice message. ';
    if (error.message?.includes('file')) {
      errorMessage += 'There was an issue with the audio file. 🎤';
    } else if (error.code === 'insufficient_quota') {
      errorMessage += 'I\'ve reached my API limit for speech processing. 📊';
    } else {
      errorMessage += 'Please try again or type your message! 😊';
    }
    
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: errorMessage
    }));
  }
}

const PORT = process.env.PORT || 3007;

server.listen(PORT, (err) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  
  console.log(`🧠 Skye AI Assistant Server running on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  OpenAI API key not found. Set OPENAI_API_KEY in .env file.');
    console.log('📝 Skye will use fallback responses until OpenAI is configured.');
  } else {
    console.log('✅ OpenAI GPT-4o-mini integration ready!');
  }
  
  console.log('Server is ready for intelligent conversations!');
});

server.on('error', (err) => {
  console.error('Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use. Trying port ${PORT + 1}...`);
    server.listen(PORT + 1, '127.0.0.1');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});