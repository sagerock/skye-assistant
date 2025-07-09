const http = require('http');
const { WebSocketServer } = require('ws');
const WebSocket = require('ws');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { ZepClient } = require('@getzep/zep-cloud');
require('dotenv').config();

// Initialize Firebase Admin
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  console.error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({
  credential: cert(serviceAccount),
});

// Initialize Zep Cloud client
let zepClient = null;
if (process.env.ZEP_API_KEY) {
  try {
    zepClient = new ZepClient({ apiKey: process.env.ZEP_API_KEY });
    console.log('✅ Zep Cloud initialized for persistent memory');
    console.log(`🔑 Zep API Key: ${process.env.ZEP_API_KEY.substring(0, 10)}...`);
  } catch (error) {
    console.error('❌ Failed to initialize Zep Cloud client:', error.message);
    zepClient = null;
  }
} else {
  console.warn('⚠️  ZEP_API_KEY not found. Memory features will be disabled.');
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    message: '🔥 Skye Realtime AI Assistant Server',
    features: ['gpt-4o-mini-realtime', 'direct-audio-streaming', 'real-time-conversation', 'firebase-auth', 'zep-memory'],
    status: 'active'
  }));
});

const wss = new WebSocketServer({ server });

// User creation lock to prevent race conditions
const userCreationLocks = new Set();

// Premium users list (in production, this would be stored in database or external service)
const PREMIUM_USERS = new Set([
  // Add premium user emails here
  'premium@example.com',
  'admin@skye.ai'
]);

// Model routing logic based on user tier and task type
function getModelForTask(userTier, taskType = 'realtime', isPremium = false) {
  switch (taskType) {
    case 'realtime':
      if (isPremium || userTier === 'premium') {
        return 'gpt-4o-realtime-preview-2024-12-17'; // Premium users get GPT-4o Realtime
      } else {
        return 'gpt-4o-mini-realtime-preview-2024-12-17'; // Free users get GPT-4o Mini Realtime
      }
    case 'deep_synthesis':
      return 'gpt-4.1-mini'; // For deep spiritual reflections, long-form summaries
    case 'lightweight_async':
      return 'gpt-4o-mini'; // For journaling prompts, tagging, short replies
    default:
      return 'gpt-4o-mini-realtime-preview-2024-12-17'; // Default to free tier model
  }
}

// Determine user tier based on email or other criteria
function getUserTier(email) {
  if (PREMIUM_USERS.has(email)) {
    return 'premium';
  }
  
  // In production, this would check payment status from RevenueCat or similar
  // For now, we'll have a simple rule: users with 'premium' in their email get premium access
  if (email && email.includes('premium')) {
    return 'premium';
  }
  
  return 'free';
}

console.log('🚀 Initializing GPT-4o Mini Realtime Server...');

wss.on('connection', (clientWs) => {
  console.log('🎯 New client connected');
  
  let openaiWs = null;
  let isConnected = false;
  let userSession = {
    uid: null,
    email: null,
    authenticated: false,
    sessionId: null,
    tier: 'free' // Default to free tier
  };
  
  // Send welcome message
  clientWs.send(JSON.stringify({
    type: 'welcome',
    message: '🧠 Connected to Skye Realtime AI! Please authenticate first.'
  }));

  clientWs.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('📨 Client message:', data.type);

      switch (data.type) {
        case 'auth':
          await handleAuth(clientWs, data, userSession);
          break;
        case 'start_session':
          if (!userSession.authenticated) {
            clientWs.send(JSON.stringify({
              type: 'error',
              message: 'Please authenticate first before starting a session'
            }));
            return;
          }
          await startRealtimeSession(clientWs, data, userSession);
          break;
        case 'audio_data':
          if (openaiWs && isConnected && userSession.authenticated) {
            forwardAudioToOpenAI(openaiWs, data);
          }
          break;
        case 'text_message':
          if (openaiWs && isConnected && userSession.authenticated) {
            await sendTextToOpenAI(openaiWs, data.text, userSession);
          }
          break;
        case 'stop_session':
          if (openaiWs) {
            openaiWs.close();
            openaiWs = null;
            isConnected = false;
          }
          break;
        default:
          console.log('Unknown message type:', data.type, 'Data:', JSON.stringify(data));
          clientWs.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${data.type}`
          }));
      }
    } catch (error) {
      console.error('Error processing client message:', error);
      clientWs.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }));
    }
  });

  async function handleAuth(clientWs, data, userSession) {
    try {
      const auth = getAuth();
      const decodedToken = await auth.verifyIdToken(data.token);
      
      // Store user info in session
      userSession.uid = decodedToken.uid;
      userSession.email = decodedToken.email;
      userSession.authenticated = true;
      userSession.sessionId = `session_${decodedToken.uid}_${Date.now()}`;
      userSession.tier = getUserTier(decodedToken.email);
      
      console.log(`🔐 User authenticated: ${decodedToken.email} (${decodedToken.uid}) - Tier: ${userSession.tier}`);
      
      // Initialize or get user's conversation session in Zep
      if (zepClient) {
        try {
          await ensureUserSession(userSession.uid, userSession.sessionId, userSession);
        } catch (error) {
          console.warn('Warning: Could not initialize Zep session:', error.message);
        }
      }
      
      clientWs.send(JSON.stringify({ 
        type: 'auth_success', 
        userId: decodedToken.uid,
        email: decodedToken.email,
        tier: userSession.tier,
        message: `✅ Authentication successful! You have ${userSession.tier} access. You can now start a voice session.`
      }));
    } catch (error) {
      console.error('Auth error:', error);
      clientWs.send(JSON.stringify({ type: 'auth_error', message: 'Invalid authentication token' }));
    }
  }

  async function ensureUserSession(userId, sessionId, userSession = {}) {
    if (!zepClient) return;
    
    // Check if user creation is already in progress for this user
    if (userCreationLocks.has(userId)) {
      console.log(`⏳ User creation already in progress for ${userId}, waiting...`);
      // Wait a bit and try again
      await new Promise(resolve => setTimeout(resolve, 100));
      if (userCreationLocks.has(userId)) {
        console.log(`⏳ Still waiting for user creation for ${userId}, skipping...`);
        return;
      }
    }
    
    try {
      // Try to get existing user by Firebase UID
      console.log(`🔍 Checking if Zep user exists: ${userId}`);
      const existingUser = await zepClient.user.get(userId);
      console.log(`👤 Existing Zep user found: ${userId}`);
      console.log(`📋 User details:`, JSON.stringify(existingUser, null, 2));
      
      // Update user with email if not already set
      if (userSession.email && (!existingUser.email || existingUser.email !== userSession.email)) {
        try {
          console.log(`📧 Updating user email: ${userSession.email}`);
          await zepClient.user.update(userId, {
            email: userSession.email,
            metadata: {
              ...existingUser.metadata,
              firebase_email: userSession.email,
              last_updated: new Date().toISOString()
            }
          });
          console.log(`✅ User email updated successfully`);
        } catch (updateError) {
          console.warn(`⚠️ Could not update user email: ${updateError.message}`);
        }
      }
    } catch (error) {
      // User doesn't exist, create them with Firebase UID
      if (error.message.includes('404') || error.message.includes('not found')) {
        // Use lock to prevent duplicate creation
        if (userCreationLocks.has(userId)) {
          console.log(`🚫 User creation already in progress for ${userId}, aborting duplicate attempt`);
          return;
        }
        
        userCreationLocks.add(userId);
        try {
          console.log(`➕ Creating new Zep user with Firebase UID: ${userId}`);
          console.log(`📧 Adding Firebase email: ${userSession.email || 'No email provided'}`);
          const newUser = await zepClient.user.add({
            userId: userId,
            email: userSession.email || null,
            metadata: {
              firebase_uid: userId,
              firebase_email: userSession.email,
              created_at: new Date().toISOString(),
              first_session: sessionId
            }
          });
          console.log(`👤 Created new Zep user with Firebase UID: ${userId}`);
          console.log(`📋 New user details:`, JSON.stringify(newUser, null, 2));
        } catch (createError) {
          console.warn(`Could not create user: ${createError.message}`);
        } finally {
          userCreationLocks.delete(userId);
        }
      } else {
        console.warn(`Could not get user: ${error.message}`);
      }
    }
    
    // CRITICAL: Explicitly add session to the user to ensure proper linking
    try {
      console.log(`🔗 Adding session ${sessionId} to user ${userId}...`);
      await zepClient.memory.addSession({
        userId: userId,
        sessionId: sessionId,
        metadata: {
          firebase_uid: userId,
          user_email: userSession.email || 'unknown',
          created_at: new Date().toISOString()
        }
      });
      console.log(`✅ Session ${sessionId} successfully linked to user ${userId}`);
    } catch (sessionError) {
      if (sessionError.message.includes('already exists') || sessionError.message.includes('duplicate')) {
        console.log(`ℹ️ Session ${sessionId} already exists for user ${userId}`);
      } else {
        console.error(`❌ Failed to add session: ${sessionError.message}`);
        // Don't throw - we can still proceed with memory storage
      }
    }
    
    // Memory will be stored under the consistent Firebase UID
    console.log(`💭 Using Firebase UID for persistent memory: ${userId}`);
    console.log(`🆔 Session ID for this conversation: ${sessionId}`);
    
    // Debug: Try to get user details to see what's in Zep
    try {
      console.log(`🔍 Checking user details in Zep...`);
      const userDetails = await zepClient.user.get(userId);
      console.log(`📋 User details from Zep:`, JSON.stringify(userDetails, null, 2));
    } catch (userError) {
      console.warn(`Could not get user details: ${userError.message}`);
    }
  }

  async function getRecentMemories(userId, sessionId) {
    if (!zepClient || !userId) return [];
    
    try {
      // Get recent memories from the user using Firebase UID as consistent identifier
      console.log(`🔍 Retrieving memories for user: ${userId}`);
      const memory = await zepClient.memory.get(userId, {
        lastn: 10  // Get last 10 messages
      });
      
      console.log(`📋 Memory retrieval response:`, memory ? `Found ${memory.messages?.length || 0} messages` : 'No memory found');
      
      // Return the memories in a format compatible with memory context
      if (memory && memory.messages) {
        console.log(`📚 Found ${memory.messages.length} recent memories for user ${userId}`);
        return memory.messages.map(msg => ({
          content: msg.content,
          role: msg.role_type || msg.role,
          timestamp: msg.created_at
        }));
      }
      
      console.log(`📚 No recent memories found for user ${userId}`);
      return [];
    } catch (error) {
      console.warn(`Could not retrieve memories for ${userId}: ${error.message}`);
      return [];
    }
  }

  async function storeMemory(userId, sessionId, userMessage, assistantMessage, userSession = {}) {
    if (!zepClient || !userId) return;
    
    try {
      // Build messages array according to Zep Cloud API documentation
      const messages = [];
      
      if (userMessage && userMessage.trim()) {
        messages.push({
          role: 'user',
          roleType: 'user',
          content: userMessage.trim()
        });
      }
      
      if (assistantMessage && assistantMessage.trim()) {
        messages.push({
          role: 'assistant',
          roleType: 'assistant', 
          content: assistantMessage.trim()
        });
      }
      
      if (messages.length > 0) {
        console.log(`💾 Storing memory using explicit User + Session pattern`);
        console.log(`👤 Firebase UID as User ID: ${userId}`);
        console.log(`🔗 Session ID: ${sessionId}`);
        console.log(`📧 User email: ${userSession?.email || 'unknown'}`);
        console.log(`📝 Messages to store:`, JSON.stringify(messages, null, 2));
        
        try {
          // First ensure the user exists (we already did this in ensureUserSession)
          try {
            const userCheck = await zepClient.user.get(userId);
            console.log(`✅ Confirmed user exists: ${userId} (${userCheck.email || 'no email'})`);
          } catch (userError) {
            console.log(`❌ User not found, this should not happen: ${userId}`);
            return;
          }
          
          // Use the NEW explicit user + session pattern from Zep docs
          // This should store under the Firebase UID user, not create session users
          const memoryResult = await zepClient.memory.add(sessionId, {
            messages: messages,
            metadata: {
              sessionId: sessionId,
              timestamp: new Date().toISOString(),
              firebase_uid: userId,
              user_email: userSession?.email || 'unknown'
            }
          });
          
          console.log(`✅ Memory stored using session ID: ${sessionId}`);
          
          // Verify the storage worked correctly
          console.log(`🔍 Verifying memory was stored correctly...`);
          try {
            const verification = await zepClient.memory.get(sessionId, { lastn: 1 });
            if (verification && verification.messages && verification.messages.length > 0) {
              console.log(`✅ SUCCESS: Memory verified for session ${sessionId}`);
              console.log(`📊 Latest message: "${verification.messages[0].content}"`);
              
              // The key question: which user does this session belong to?
              console.log(`🔍 Checking which user owns this session...`);
              console.log(`📋 Session verification response keys: ${Object.keys(verification)}`);
              if (verification.user_id) {
                console.log(`👤 Session belongs to user: ${verification.user_id}`);
                if (verification.user_id === userId) {
                  console.log(`✅ CORRECT: Session linked to Firebase UID ${userId}`);
                } else {
                  console.log(`🚨 PROBLEM: Session linked to ${verification.user_id} instead of ${userId}`);
                }
              }
            } else {
              console.log(`❌ WARNING: No memories found for session ${sessionId} after storage`);
            }
          } catch (verifyError) {
            console.log(`❌ Could not verify memory storage: ${verifyError.message}`);
          }
          
        } catch (error) {
          console.error(`❌ Memory storage failed: ${error.message}`);
          console.error(`📋 Error details:`, JSON.stringify(error, null, 2));
        }
      }
    } catch (error) {
      console.warn(`Could not store memory: ${error.message}`);
    }
  }

  async function startRealtimeSession(clientWs, config = {}, userSession) {
    if (!process.env.OPENAI_API_KEY) {
      clientWs.send(JSON.stringify({
        type: 'error',
        message: 'OpenAI API key not configured. Please set OPENAI_API_KEY in .env file.'
      }));
      return;
    }

    try {
      console.log(`🔗 Connecting to OpenAI Realtime API for user: ${userSession.email}...`);
      
      // Get recent memories for context
      const recentMemories = await getRecentMemories(userSession.uid, userSession.sessionId);
      let memoryContext = '';
      if (recentMemories.length > 0) {
        memoryContext = '\n\nRecent conversation context:\n' + 
          recentMemories.map(m => `- ${m.role}: ${m.content}`).join('\n');
      }
      
      // Determine which model to use based on user tier
      const selectedModel = getModelForTask(userSession.tier, 'realtime');
      console.log(`🤖 Using model: ${selectedModel} for ${userSession.tier} user: ${userSession.email}`);
      
      // Connect to OpenAI Realtime API with the selected model
      openaiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=${selectedModel}`, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      openaiWs.on('open', () => {
        console.log(`✅ Connected to OpenAI Realtime API for ${userSession.email}`);
        isConnected = true;
        
        // Configure the session with user context
        const sessionConfig = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: `You are Skye, a spiritual AI companion. You're grounded, authentic, and spiritually aware without being preachy or overly precious about it.

            Your approach:
            - Be real and honest, not sugar-coated or overly gentle
            - You're spiritually sensitive but you don't treat people like they're fragile
            - Ask good questions and listen well, but don't constantly probe emotions
            - Be curious about life's deeper currents, but stay practical and relatable
            - You understand that spiritual growth includes challenge, not just comfort
            - You're warm but not clingy, supportive but not patronizing

            Communication style:
            - Talk like a wise, grounded friend - not a therapist or guru
            - Be direct when helpful, gentle when needed, but always authentic
            - You can discuss both profound and everyday topics naturally
            - Don't assume the user needs special emotional handling
            - Keep responses conversational and substantive (1-3 sentences)
            
            You're here for genuine connection and exploration of what matters, not to coddle or treat anyone as fragile.
            
            User: ${userSession.email}
            User ID: ${userSession.uid}
            ${memoryContext}`,
            voice: config.voice || 'sage', // Sage voice for wisdom and grounding
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300, // Allow more pause for reflection
              silence_duration_ms: 500  // Give more space for contemplative silence
            },
            tools: [],
            tool_choice: 'auto',
            temperature: 0.7, // More consistent and grounded responses
            max_response_output_tokens: 1500 // Encourage more concise, thoughtful responses
          }
        };

        openaiWs.send(JSON.stringify(sessionConfig));
        
        clientWs.send(JSON.stringify({
          type: 'session_started',
          message: `🎤 Realtime session active with ${selectedModel.includes('gpt-4o-mini') ? 'GPT-4o Mini' : 'GPT-4o'} for ${userSession.email}! Start talking...`,
          userId: userSession.uid,
          model: selectedModel,
          tier: userSession.tier
        }));
      });

      openaiWs.on('message', (data) => {
        try {
          const event = JSON.parse(data);
          console.log('📡 OpenAI event:', event.type);
          
          // Store conversation for memory when we get complete transcripts
          if (event.type === 'conversation.item.input_audio_transcription.completed') {
            userSession.lastUserMessage = event.transcript;
          }
          
          if (event.type === 'response.audio_transcript.done') {
            const assistantMessage = event.transcript;
            if (userSession.lastUserMessage && assistantMessage) {
              // Store in Zep asynchronously
                              storeMemory(userSession.uid, userSession.sessionId, userSession.lastUserMessage, assistantMessage, userSession);
              userSession.lastUserMessage = null;
            }
          }
          
          // Forward relevant events to client
          switch (event.type) {
            case 'session.created':
              console.log('Session created successfully');
              break;
              
            case 'session.updated':
              console.log('Session updated successfully');
              break;
              
            case 'input_audio_buffer.speech_started':
              clientWs.send(JSON.stringify({
                type: 'speech_started',
                message: '🎤 Listening...'
              }));
              break;
              
            case 'input_audio_buffer.speech_stopped':
              clientWs.send(JSON.stringify({
                type: 'speech_stopped',
                message: '🤔 Processing...'
              }));
              break;
              
            case 'conversation.item.input_audio_transcription.completed':
              clientWs.send(JSON.stringify({
                type: 'transcription',
                text: event.transcript,
                message: `🗣️ You said: "${event.transcript}"`
              }));
              break;
              
            case 'response.audio.delta':
              // Forward audio chunks to client
              clientWs.send(JSON.stringify({
                type: 'audio_response',
                audio_data: event.delta
              }));
              break;
              
            case 'response.text.delta':
              // Forward text chunks to client
              clientWs.send(JSON.stringify({
                type: 'text_response',
                text: event.delta
              }));
              break;
              
            case 'response.done':
              clientWs.send(JSON.stringify({
                type: 'response_complete',
                message: '✅ Response complete'
              }));
              break;
              
            case 'error':
              console.error('OpenAI error:', event);
              clientWs.send(JSON.stringify({
                type: 'error',
                message: `OpenAI error: ${event.error?.message || 'Unknown error'}`
              }));
              break;
              
            default:
              // Log other events for debugging
              if (event.type.includes('error')) {
                console.error('OpenAI error event:', event);
              }
          }
        } catch (error) {
          console.error('Error parsing OpenAI message:', error);
        }
      });

      openaiWs.on('error', (error) => {
        console.error('OpenAI WebSocket error:', error);
        clientWs.send(JSON.stringify({
          type: 'error',
          message: 'OpenAI connection error'
        }));
        isConnected = false;
      });

      openaiWs.on('close', () => {
        console.log('OpenAI WebSocket connection closed');
        isConnected = false;
        clientWs.send(JSON.stringify({
          type: 'session_ended',
          message: 'Realtime session ended'
        }));
      });

    } catch (error) {
      console.error('Failed to start realtime session:', error);
      clientWs.send(JSON.stringify({
        type: 'error',
        message: 'Failed to start realtime session'
      }));
    }
  }

  function forwardAudioToOpenAI(openaiWs, audioData) {
    const audioEvent = {
      type: 'input_audio_buffer.append',
      audio: audioData.audio
    };
    openaiWs.send(JSON.stringify(audioEvent));
  }

  async function sendTextToOpenAI(openaiWs, text, userSession) {
    const textEvent = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: text
          }
        ]
      }
    };
    openaiWs.send(JSON.stringify(textEvent));
    
    // Trigger response generation
    const responseEvent = {
      type: 'response.create',
      response: {
        modalities: ['text', 'audio']
      }
    };
    openaiWs.send(JSON.stringify(responseEvent));

    // Store the user text message in Zep
    if (text && userSession.uid && userSession.sessionId) {
      try {
        await storeMemory(userSession.uid, userSession.sessionId, text, 'Processing...', userSession);
      } catch (error) {
        console.warn('Could not store text message:', error.message);
      }
    }
  }

  clientWs.on('close', () => {
    console.log('Client disconnected');
    if (openaiWs) {
      openaiWs.close();
      openaiWs = null;
      isConnected = false;
    }
  });

  clientWs.on('error', (error) => {
    console.error('Client WebSocket error:', error);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, (err) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  
  console.log(`🔥 Skye Realtime AI Server running on http://localhost:${PORT}`);
  console.log(`🎯 WebSocket endpoint: ws://localhost:${PORT}`);
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  OpenAI API key not found. Set OPENAI_API_KEY in .env file.');
  } else {
    console.log('✅ OpenAI Realtime API key configured');
    console.log('🚀 Ready for real-time voice conversations!');
  }
});

server.on('error', (err) => {
  console.error('Server error:', err);
});