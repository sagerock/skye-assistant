const http = require('http');
const { WebSocketServer } = require('ws');
const WebSocket = require('ws');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
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

// Initialize Firestore
const db = getFirestore();
console.log('🔥 Firestore initialized for permanent conversation storage');

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

// Premium users list (in production, this would be stored in database)
const PREMIUM_USERS = new Set([
  // Add premium user emails here
  'premium@example.com',
  'admin@skye.ai'
]);

// Admin users list
const ADMIN_USERS = new Set([
  'sage@sagerock.com'
]);

// Model pricing configuration (per 1K tokens)
const modelPricing = {
  'gpt-4o-realtime-preview-2025-06-03': { input: 0.005, output: 0.020 },
  'gpt-4o-mini-realtime-preview-2024-12-17': { input: 0.00015, output: 0.0006 },
  'gpt-4.1-mini-2025-04-14': { input: 0.00015, output: 0.0006 },
  'gpt-4o-mini-2024-07-18': { input: 0.00015, output: 0.0006 }
};

// In-memory user storage for admin management (in production, use proper database)
const userStore = new Map();

// TOKEN USAGE TRACKING SYSTEM
const tokenUsage = {
  byUser: new Map(), // userId -> { totalTokens, totalRequests }
  sessions: new Map(), // sessionId -> { userId, startTime, endTime, totalTokens, events: [] }
  global: {
    totalTokens: 0,
    totalRequests: 0,
    totalUsers: new Set(),
    startTime: new Date().toISOString()
  }
};

// Track token usage for a user and model
function trackTokenUsage(userId, email, sessionId, model, inputTokens = 0, outputTokens = 0, eventType = 'unknown') {
  const totalTokens = inputTokens + outputTokens;
  const timestamp = new Date().toISOString();
  
  console.log(`📊 Token usage: ${email} | In: ${inputTokens}, Out: ${outputTokens}, Total: ${totalTokens} | Event: ${eventType}`);
  
  // Track by user
  if (!tokenUsage.byUser.has(userId)) {
    tokenUsage.byUser.set(userId, {
      email,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalRequests: 0,
      firstRequest: timestamp,
      lastRequest: timestamp
    });
  }
  
  const userData = tokenUsage.byUser.get(userId);
  userData.totalTokens += totalTokens;
  userData.inputTokens += inputTokens;
  userData.outputTokens += outputTokens;
  userData.totalRequests += 1;
  userData.lastRequest = timestamp;
  
  // Track session
  if (!tokenUsage.sessions.has(sessionId)) {
    tokenUsage.sessions.set(sessionId, {
      userId,
      email,
      startTime: timestamp,
      endTime: null,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      events: []
    });
  }
  
  const sessionData = tokenUsage.sessions.get(sessionId);
  sessionData.totalTokens += totalTokens;
  sessionData.inputTokens += inputTokens;
  sessionData.outputTokens += outputTokens;
  sessionData.endTime = timestamp;
  sessionData.events.push({
    timestamp,
    eventType,
    inputTokens,
    outputTokens,
    totalTokens
  });
  
  // Update global stats
  tokenUsage.global.totalTokens += totalTokens;
  tokenUsage.global.totalRequests += 1;
  tokenUsage.global.totalUsers.add(userId);
  
  // PERSIST TO FIRESTORE FOR ADMIN ANALYTICS
  persistTokenUsageToFirestore(userId, email, sessionId, model, inputTokens, outputTokens, eventType, timestamp).catch(err => {
    console.error('Error persisting token usage:', err);
  });
}

// Sanitize model names for use as Firestore field keys
function sanitizeFirestoreKey(key) {
  if (!key) return 'unknown';
  return key.replace(/\./g, '_');
}

// Un-sanitize model names from Firestore field keys
function unsanitizeFirestoreKey(key) {
  if (!key) return 'unknown';
  return key.replace(/_/g, '.');
}

// Persist token usage to Firestore for admin analytics
async function persistTokenUsageToFirestore(userId, email, sessionId, model, inputTokens, outputTokens, eventType, timestamp) {
  try {
    const totalTokens = inputTokens + outputTokens;
    
    // Store individual token event for detailed tracking
    const tokenEventRef = db.collection('analytics').doc('token_usage').collection('events').doc();
    await tokenEventRef.set({
      userId,
      email,
      sessionId,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      eventType,
      timestamp: new Date(timestamp),
      createdAt: new Date()
    });
    
    // Update user token summary
    const userTokenRef = db.collection('analytics').doc('token_usage').collection('users').doc(userId);
    await userTokenRef.set({
      userId,
      email,
      totalTokens: require('firebase-admin/firestore').FieldValue.increment(totalTokens),
      inputTokens: require('firebase-admin/firestore').FieldValue.increment(inputTokens),
      outputTokens: require('firebase-admin/firestore').FieldValue.increment(outputTokens),
      totalRequests: require('firebase-admin/firestore').FieldValue.increment(1),
      firstRequest: timestamp,
      lastRequest: timestamp,
      updatedAt: new Date()
    }, { merge: true });
    
    // Update global analytics
    const globalRef = db.collection('analytics').doc('token_usage').collection('global').doc('totals');
    await globalRef.set({
      totalTokens: require('firebase-admin/firestore').FieldValue.increment(totalTokens),
      totalRequests: require('firebase-admin/firestore').FieldValue.increment(1),
      inputTokens: require('firebase-admin/firestore').FieldValue.increment(inputTokens),
      outputTokens: require('firebase-admin/firestore').FieldValue.increment(outputTokens),
      lastUpdate: new Date(timestamp)
    }, { merge: true });
    
  } catch (error) {
    console.error('Error persisting token usage:', error);
  }
}

// Get token analytics for admin panel
function getTokenAnalytics() {
  const users = Array.from(tokenUsage.byUser.entries()).map(([userId, data]) => ({
    userId,
    email: data.email,
    totalTokens: data.totalTokens,
    inputTokens: data.inputTokens,
    outputTokens: data.outputTokens,
    totalRequests: data.totalRequests,
    firstRequest: data.firstRequest,
    lastRequest: data.lastRequest
  })).sort((a, b) => b.totalTokens - a.totalTokens);
  
  const recentSessions = Array.from(tokenUsage.sessions.entries())
    .map(([sessionId, data]) => ({
      sessionId,
      userId: data.userId,
      email: data.email,
      startTime: data.startTime,
      endTime: data.endTime,
      duration: data.endTime ? new Date(data.endTime) - new Date(data.startTime) : null,
      totalTokens: data.totalTokens,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      events: data.events.length
    }))
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
    .slice(0, 50); // Last 50 sessions
  
  return {
    global: {
      totalTokens: tokenUsage.global.totalTokens,
      totalRequests: tokenUsage.global.totalRequests,
      uniqueUsers: tokenUsage.global.totalUsers.size,
      startTime: tokenUsage.global.startTime,
      uptime: Math.floor((Date.now() - new Date(tokenUsage.global.startTime)) / 1000)
    },
    topUsers: users.slice(0, 20),
    recentSessions,
    totalUsers: users.length
  };
}

// Clean up corrupted analytics data
async function cleanupCorruptedAnalytics() {
  try {
    console.log('🧹 Cleaning up corrupted analytics data...');
    
    // Delete all analytics data to start fresh
    const analyticsRef = db.collection('analytics').doc('token_usage');
    
    // Delete events collection
    const eventsSnapshot = await analyticsRef.collection('events').get();
    const eventsBatch = db.batch();
    eventsSnapshot.docs.forEach(doc => {
      eventsBatch.delete(doc.ref);
    });
    await eventsBatch.commit();
    
    // Delete users collection
    const usersSnapshot = await analyticsRef.collection('users').get();
    const usersBatch = db.batch();
    usersSnapshot.docs.forEach(doc => {
      usersBatch.delete(doc.ref);
    });
    await usersBatch.commit();
    
    // Delete global collection
    const globalSnapshot = await analyticsRef.collection('global').get();
    const globalBatch = db.batch();
    globalSnapshot.docs.forEach(doc => {
      globalBatch.delete(doc.ref);
    });
    await globalBatch.commit();
    
    console.log('✅ Cleaned up corrupted analytics data');
    return true;
  } catch (error) {
    console.error('Error cleaning up analytics:', error);
    return false;
  }
}

// Get token analytics from Firestore (for persistent data)
async function getTokenAnalyticsFromFirestore() {
  try {
    // Get global analytics
    const globalDoc = await db.collection('analytics').doc('token_usage').collection('global').doc('totals').get();
    const globalData = globalDoc.exists ? globalDoc.data() : { totalTokens: 0, totalRequests: 0, lastUpdate: null };

    // Get all user analytics
    const users = [];
    const usersSnapshot = await db.collection('analytics').doc('token_usage').collection('users').get();
    
    usersSnapshot.forEach(doc => {
      try {
        const userData = doc.data();
        users.push({
          userId: userData.userId,
          email: userData.email,
          totalTokens: userData.totalTokens || 0,
          inputTokens: userData.inputTokens || 0,
          outputTokens: userData.outputTokens || 0,
          totalRequests: userData.totalRequests || 0,
          firstRequest: safeTimestampToISO(userData.firstRequest, null),
          lastRequest: safeTimestampToISO(userData.lastRequest, null)
        });
      } catch (error) {
        console.error('Error processing user data:', error.message);
      }
    });

    // Get model breakdown and recent sessions from events
    const recentSessions = [];
    const sessionMap = new Map();
    const modelBreakdown = new Map();
    const userModelBreakdown = new Map(); // Track model usage per user
    const eventsSnapshot = await db.collection('analytics').doc('token_usage').collection('events').orderBy('timestamp', 'desc').limit(500).get();
    
    eventsSnapshot.forEach(doc => {
      try {
        const eventData = doc.data();
        const sessionId = eventData.sessionId;
        const model = eventData.model || 'unknown';
        const userId = eventData.userId;
        
        // Track global model usage
        if (!modelBreakdown.has(model)) {
          modelBreakdown.set(model, {
            model,
            totalTokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalRequests: 0,
            uniqueUsers: new Set()
          });
        }
        
        const modelData = modelBreakdown.get(model);
        modelData.totalTokens += eventData.totalTokens || 0;
        modelData.inputTokens += eventData.inputTokens || 0;
        modelData.outputTokens += eventData.outputTokens || 0;
        modelData.totalRequests += 1;
        if (eventData.userId) {
          modelData.uniqueUsers.add(eventData.userId);
        }
        
        // Track per-user model usage
        if (userId) {
          if (!userModelBreakdown.has(userId)) {
            userModelBreakdown.set(userId, new Map());
          }
          
          const userModels = userModelBreakdown.get(userId);
          if (!userModels.has(model)) {
            userModels.set(model, {
              model,
              totalTokens: 0,
              inputTokens: 0,
              outputTokens: 0,
              totalRequests: 0,
              totalCost: 0
            });
          }
          
          const userModelData = userModels.get(model);
          userModelData.totalTokens += eventData.totalTokens || 0;
          userModelData.inputTokens += eventData.inputTokens || 0;
          userModelData.outputTokens += eventData.outputTokens || 0;
          userModelData.totalRequests += 1;
          
          // Calculate cost using model-specific pricing
          const pricing = modelPricing[model] || { input: 0.00015, output: 0.0006 }; // Default to mini pricing
          const inputCost = ((eventData.inputTokens || 0) / 1000) * pricing.input;
          const outputCost = ((eventData.outputTokens || 0) / 1000) * pricing.output;
          userModelData.totalCost += inputCost + outputCost;
        }
        
        // Track sessions
        if (!sessionMap.has(sessionId)) {
          sessionMap.set(sessionId, {
            sessionId,
            userId: eventData.userId,
            email: eventData.email,
            startTime: eventData.timestamp ? safeTimestampToISO(eventData.timestamp) : new Date().toISOString(),
            endTime: eventData.timestamp ? safeTimestampToISO(eventData.timestamp) : new Date().toISOString(),
            totalTokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            events: 0
          });
        }
        
        const session = sessionMap.get(sessionId);
        session.totalTokens += eventData.totalTokens || 0;
        session.inputTokens += eventData.inputTokens || 0;
        session.outputTokens += eventData.outputTokens || 0;
        session.events++;
        
        if (eventData.timestamp) {
          const timestamp = safeTimestampToISO(eventData.timestamp);
          if (timestamp < session.startTime) session.startTime = timestamp;
          if (timestamp > session.endTime) session.endTime = timestamp;
        }
      } catch (error) {
        console.warn('Error processing analytics event, skipping:', error.message);
      }
    });

    // Add model breakdown to users
    const topUsers = users.map(user => {
      const userModels = userModelBreakdown.get(user.userId);
      if (userModels) {
        const modelBreakdownArray = Array.from(userModels.values()).sort((a, b) => b.totalTokens - a.totalTokens);
        return {
          ...user,
          modelBreakdown: modelBreakdownArray
        };
      }
      return user;
    }).sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 20);

    // Convert model breakdown to array and sort by token usage
    const modelStats = Array.from(modelBreakdown.values()).map(model => ({
      model: model.model,
      totalTokens: model.totalTokens,
      inputTokens: model.inputTokens,
      outputTokens: model.outputTokens,
      totalRequests: model.totalRequests,
      uniqueUsers: model.uniqueUsers.size,
      avgTokensPerRequest: model.totalRequests > 0 ? Math.round(model.totalTokens / model.totalRequests) : 0
    })).sort((a, b) => b.totalTokens - a.totalTokens);

    return {
      global: {
        totalTokens: globalData.totalTokens || 0,
        totalRequests: globalData.totalRequests || 0,
        uniqueUsers: users.length,
        lastUpdate: globalData.lastUpdate ? safeTimestampToISO(globalData.lastUpdate) : null
      },
      topUsers,
      modelBreakdown: modelStats,
      recentSessions: Array.from(sessionMap.values()).slice(0, 20),
      totalUsers: users.length
    };

  } catch (error) {
    console.error('Error getting token analytics from Firestore:', error);
    
    // If we're getting timestamp errors, clean up corrupted data
    if (error.message && error.message.includes('toISOString is not a function')) {
      console.log('🔧 Detected corrupted timestamp data, cleaning up...');
      await cleanupCorruptedAnalytics();
    }
    
    return { 
      global: { totalTokens: 0, totalRequests: 0, uniqueUsers: 0, lastUpdate: null },
      topUsers: [], 
      recentSessions: [],
      totalUsers: 0
    };
  }
}

// Safe timestamp converter with extensive error handling
function safeTimestampToISO(timestamp, fallback = null) {
  try {
    if (!timestamp) return fallback;
    
    // Handle string timestamps
    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      return date.toISOString();
    }
    
    // Handle Firestore timestamps
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toISOString();
    }
    
    // Handle Date objects
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }
    
    // Handle Firestore timestamp objects
    if (timestamp._seconds !== undefined) {
      const milliseconds = timestamp._seconds * 1000;
      const nanoseconds = (timestamp._nanoseconds || 0) / 1000000;
      return new Date(milliseconds + nanoseconds).toISOString();
    }
    
    // Handle numeric timestamps (milliseconds since epoch)
    if (typeof timestamp === 'number') {
      return new Date(timestamp).toISOString();
    }
    
    // Handle objects with seconds/nanoseconds
    if (timestamp.seconds !== undefined) {
      const milliseconds = timestamp.seconds * 1000;
      const nanoseconds = (timestamp.nanoseconds || 0) / 1000000;
      return new Date(milliseconds + nanoseconds).toISOString();
    }
    
    return fallback || new Date().toISOString();
  } catch (error) {
    console.warn('Failed to convert timestamp, using fallback:', error.message);
    return fallback || new Date().toISOString();
  }
}

// FIRESTORE CONVERSATION STORAGE SYSTEM - USER-ORGANIZED

// New Firestore schema (user-organized for privacy & performance):
// users/{userId}/conversations/{conversationId} = {
//   id: string,
//   startTime: timestamp,
//   endTime: timestamp,
//   model: string,
//   messageCount: number,
//   totalTokens: number,
//   status: 'active' | 'completed',
//   metadata: { sessionId, tier, userEmail, etc. }
// }
//
// users/{userId}/messages/{messageId} = {
//   conversationId: string,
//   role: 'user' | 'assistant',
//   content: string,
//   timestamp: timestamp,
//   tokens: { input?: number, output?: number },
//   model?: string,
//   metadata: { eventType, etc. }
// }
//
// analytics/daily_stats/{date} = {
//   totalConversations: number,
//   totalMessages: number,
//   totalUsers: number,
//   // Aggregated data for admin analytics
// }

// Store a new conversation in Firestore (user-organized)
async function createConversation(userId, userEmail, sessionId, model, tier) {
  try {
    const conversationRef = db.collection('users').doc(userId).collection('conversations').doc();
    const conversation = {
      id: conversationRef.id,
      startTime: new Date(),
      endTime: null,
      model,
      tier,
      messageCount: 0,
      totalTokens: 0,
      status: 'active',
      metadata: {
        sessionId,
        tier,
        userEmail,
        createdAt: new Date().toISOString()
      }
    };
    
    await conversationRef.set(conversation);
    console.log(`🔥 Created conversation: ${conversationRef.id} for user: ${userEmail}`);
    
    // Update daily analytics
    await updateDailyAnalytics('conversationCreated');
    
    return conversationRef.id;
  } catch (error) {
    console.error('Error creating conversation:', error);
    return null;
  }
}

// Store a message in Firestore (user-organized)
async function storeMessage(conversationId, userId, role, content, tokens = {}, model = null, eventType = 'unknown') {
  try {
    const messageRef = db.collection('users').doc(userId).collection('messages').doc();
    const message = {
      id: messageRef.id,
      conversationId,
      role,
      content: content.trim(),
      timestamp: new Date(),
      tokens,
      model,
      metadata: {
        eventType,
        createdAt: new Date().toISOString()
      }
    };
    
    await messageRef.set(message);
    
    // Update conversation stats
    await updateConversationStats(conversationId, userId, tokens);
    
    console.log(`🔥 Stored ${role} message in conversation ${conversationId} for user ${userId}`);
    
    // Update daily analytics
    await updateDailyAnalytics('messageCreated');
    
    return messageRef.id;
  } catch (error) {
    console.error('Error storing message:', error);
    return null;
  }
}

// Update conversation statistics (user-organized)
async function updateConversationStats(conversationId, userId, tokens = {}) {
  try {
    const conversationRef = db.collection('users').doc(userId).collection('conversations').doc(conversationId);
    const tokenCount = (tokens.input || 0) + (tokens.output || 0);
    
    await conversationRef.update({
      messageCount: require('firebase-admin/firestore').FieldValue.increment(1),
      totalTokens: require('firebase-admin/firestore').FieldValue.increment(tokenCount),
      endTime: new Date()
    });
  } catch (error) {
    console.error('Error updating conversation stats:', error);
  }
}

// Complete a conversation (mark as finished) - user-organized
async function completeConversation(conversationId, userId) {
  try {
    const conversationRef = db.collection('users').doc(userId).collection('conversations').doc(conversationId);
    await conversationRef.update({
      status: 'completed',
      endTime: new Date()
    });
    console.log(`🔥 Completed conversation: ${conversationId} for user: ${userId}`);
  } catch (error) {
    console.error('Error completing conversation:', error);
  }
}

// Get conversation history for a user (user-organized)
async function getUserConversations(userId, limit = 20) {
  try {
    const conversationsSnapshot = await db.collection('users').doc(userId).collection('conversations')
      .orderBy('startTime', 'desc')
      .limit(limit)
      .get();
    
    const conversations = [];
    conversationsSnapshot.forEach(doc => {
      conversations.push({ id: doc.id, ...doc.data() });
    });
    
    return conversations;
  } catch (error) {
    console.error('Error getting user conversations:', error);
    return [];
  }
}

// Get messages for a specific conversation (user-organized)
async function getConversationMessages(conversationId, userId, limit = 100) {
  try {
    const messagesSnapshot = await db.collection('users').doc(userId).collection('messages')
      .where('conversationId', '==', conversationId)
      .orderBy('timestamp', 'asc')
      .limit(limit)
      .get();
    
    const messages = [];
    messagesSnapshot.forEach(doc => {
      messages.push({ id: doc.id, ...doc.data() });
    });
    
    return messages;
  } catch (error) {
    console.error('Error getting conversation messages:', error);
    return [];
  }
}

// Get conversation analytics for admin (user-organized)
async function getConversationAnalytics() {
  try {
    let totalConversations = 0;
    let totalMessages = 0;
    let recentConversations = 0;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const usersSnapshot = await db.collection('users').get();

    for (const userDoc of usersSnapshot.docs) {
      const conversationsSnapshot = await userDoc.ref.collection('conversations').get();
      totalConversations += conversationsSnapshot.size;
      
      for (const convoDoc of conversationsSnapshot.docs) {
        const convoData = convoDoc.data();
        if (convoData.startTime) {
          // Handle both Firestore timestamps and regular Date objects
          const startTime = convoData.startTime.toDate ? convoData.startTime.toDate() : new Date(convoData.startTime);
          if (startTime > sevenDaysAgo) {
            recentConversations++;
          }
        }
        if (convoData.messageCount) {
          totalMessages += convoData.messageCount;
        }
      }
    }

    return {
      totalConversations,
      totalMessages,
      recent: recentConversations,
      active: 0, // This is harder to calculate, leaving for now
      avgMessagesPerSession: totalConversations > 0 ? (totalMessages / totalConversations) : 0
    };
  } catch (error) {
    console.error('Error fetching conversation analytics:', error);
    return {
      totalConversations: 0,
      totalMessages: 0,
      recent: 0,
      active: 0,
      avgMessagesPerSession: 0
    };
  }
}

// Update daily analytics (for better performance than real-time aggregation)
async function updateDailyAnalytics(eventType) {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const analyticsRef = db.collection('analytics').doc('daily_stats').collection('dates').doc(today);
    
    const increment = require('firebase-admin/firestore').FieldValue.increment(1);
    const updateData = {
      date: today,
      lastUpdated: new Date()
    };
    
    if (eventType === 'conversationCreated') {
      updateData.totalConversations = increment;
    } else if (eventType === 'messageCreated') {
      updateData.totalMessages = increment;
    } else if (eventType === 'userCreated') {
      updateData.totalUsers = increment;
    }
    
    await analyticsRef.set(updateData, { merge: true });
  } catch (error) {
    console.error('Error updating daily analytics:', error);
  }
}

// Model routing logic based on user tier and task type
function getModelForTask(userTier, taskType = 'realtime', isPremium = false) {
  switch (taskType) {
    case 'realtime':
      if (isPremium || userTier === 'premium') {
        return 'gpt-4o-realtime-preview-2025-06-03'; // Premium users get GPT-4o Realtime
      } else {
        return 'gpt-4o-mini-realtime-preview-2024-12-17'; // Free users get GPT-4o Mini Realtime
      }
    case 'deep_synthesis':
      return 'gpt-4.1-mini-2025-04-14'; // For deep spiritual reflections, long-form summaries
    case 'lightweight_async':
      return 'gpt-4o-mini-2024-07-18'; // For journaling prompts, tagging, short replies
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

// Create HTTP server with admin endpoints
const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // Admin endpoints
  if (url.pathname.startsWith('/admin')) {
    await handleAdminRequest(req, res, url);
    return;
  }
  
  // Default health check
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    message: '🔥 Skye Realtime AI Assistant Server',
    features: ['gpt-4o-mini-realtime', 'direct-audio-streaming', 'real-time-conversation', 'firebase-auth', 'zep-memory', 'admin-panel'],
    status: 'active'
  }));
});

async function handleAdminRequest(req, res, url) {
  try {
    // Verify admin authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Admin authentication required' }));
      return;
    }

    const token = authHeader.split(' ')[1];
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    
    if (!ADMIN_USERS.has(decodedToken.email)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Admin access denied' }));
      return;
    }

    // Handle different admin endpoints
    if (url.pathname === '/admin/users' && req.method === 'GET') {
      await getUsers(req, res);
    } else if (url.pathname === '/admin/users' && req.method === 'POST') {
      await createUser(req, res);
    } else if (url.pathname.startsWith('/admin/users/') && req.method === 'PUT') {
      const userId = url.pathname.split('/')[3];
      await updateUser(req, res, userId);
    } else if (url.pathname.startsWith('/admin/users/') && req.method === 'DELETE') {
      const userId = url.pathname.split('/')[3];
      await deleteUser(req, res, userId);
    } else if (url.pathname === '/admin/stats' && req.method === 'GET') {
      await getStats(req, res);
    } else if (url.pathname === '/admin/health' && req.method === 'GET') {
      await getSystemHealth(req, res);
    } else if (url.pathname === '/admin/tokens' && req.method === 'GET') {
      await getTokenStats(req, res);
    } else if (url.pathname === '/admin/usage' && req.method === 'GET') {
      await getUsageAnalytics(req, res);
    } else if (url.pathname === '/admin/conversations' && req.method === 'GET') {
      await getConversationStats(req, res);
    } else if (url.pathname.startsWith('/admin/conversations/') && req.method === 'GET') {
      const conversationId = url.pathname.split('/')[3];
      await getConversationDetails(req, res, conversationId);
    } else if (url.pathname.startsWith('/admin/users/') && url.pathname.endsWith('/conversations') && req.method === 'GET') {
      const userId = url.pathname.split('/')[3];
      await getUserConversationHistory(req, res, userId);
    } else if (url.pathname === '/admin/cleanup-analytics' && req.method === 'POST') {
      await cleanupAnalyticsEndpoint(req, res);
    } else if (url.pathname === '/admin/pricing' && req.method === 'GET') {
      await getPricing(req, res);
    } else if (url.pathname === '/admin/pricing' && req.method === 'PUT') {
      await updatePricing(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Admin endpoint not found' }));
    }
  } catch (error) {
    console.error('Admin request error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

async function getUsers(req, res) {
  try {
    const auth = getAuth();
    const listUsers = await auth.listUsers();
    
    const users = listUsers.users.map(user => ({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      creationTime: user.metadata.creationTime,
      lastSignInTime: user.metadata.lastSignInTime,
      disabled: user.disabled,
      tier: getUserTier(user.email),
      isAdmin: ADMIN_USERS.has(user.email),
      isPremium: PREMIUM_USERS.has(user.email)
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ users }));
  } catch (error) {
    console.error('Error getting users:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to get users' }));
  }
}

async function createUser(req, res) {
  try {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      const { email, password, displayName, tier } = JSON.parse(body);
      
      const auth = getAuth();
      const userRecord = await auth.createUser({
        email,
        password,
        displayName
      });

      // Update tier if premium
      if (tier === 'premium') {
        PREMIUM_USERS.add(email);
      }

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        tier: getUserTier(userRecord.email)
      }));
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to create user' }));
  }
}

async function updateUser(req, res, userId) {
  try {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      const { email, displayName, tier, disabled } = JSON.parse(body);
      
      const auth = getAuth();
      const updateData = {};
      
      if (email) updateData.email = email;
      if (displayName) updateData.displayName = displayName;
      if (typeof disabled === 'boolean') updateData.disabled = disabled;
      
      const userRecord = await auth.updateUser(userId, updateData);
      
      // Update tier
      const userEmail = userRecord.email;
      if (tier === 'premium') {
        PREMIUM_USERS.add(userEmail);
      } else {
        PREMIUM_USERS.delete(userEmail);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        tier: getUserTier(userRecord.email),
        disabled: userRecord.disabled
      }));
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to update user' }));
  }
}

async function deleteUser(req, res, userId) {
  try {
    const auth = getAuth();
    await auth.deleteUser(userId);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'User deleted successfully' }));
  } catch (error) {
    console.error('Error deleting user:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to delete user' }));
  }
}

async function getStats(req, res) {
  try {
    const auth = getAuth();
    const listUsers = await auth.listUsers();
    
    const users = listUsers.users;
    const totalUsers = users.length;
    const premiumUsers = users.filter(user => PREMIUM_USERS.has(user.email)).length;
    const freeUsers = totalUsers - premiumUsers;
    const adminUsers = users.filter(user => ADMIN_USERS.has(user.email)).length;
    const activeUsers = users.filter(user => {
      const lastSignIn = new Date(user.metadata.lastSignInTime);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return lastSignIn > thirtyDaysAgo;
    }).length;

    // Get conversation analytics
    const conversationAnalytics = await getConversationAnalytics();
    
    // Get token analytics summary
    const tokenAnalytics = await getTokenAnalyticsFromFirestore();

    const stats = {
      users: {
        totalUsers,
        premiumUsers,
        freeUsers,
        adminUsers,
        activeUsers,
        recentSignups: users.filter(user => {
          const createdAt = new Date(user.metadata.creationTime);
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return createdAt > sevenDaysAgo;
        }).length
      },
      conversations: {
        totalConversations: conversationAnalytics.totalConversations,
        totalMessages: conversationAnalytics.totalMessages,
        recentConversations: conversationAnalytics.recent,
        activeConversations: conversationAnalytics.active,
        avgMessagesPerConversation: conversationAnalytics.avgMessagesPerSession
      },
      tokens: {
        totalTokens: tokenAnalytics.global.totalTokens,
        totalRequests: tokenAnalytics.global.totalRequests,
        uniqueUsers: tokenAnalytics.global.uniqueUsers
      }
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ stats }));
  } catch (error) {
    console.error('Error getting stats:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to get stats' }));
  }
}

async function getSystemHealth(req, res) {
  try {
    const health = {
      server: 'healthy',
      firebase: 'healthy',
      openai: process.env.OPENAI_API_KEY ? 'healthy' : 'not configured',
      zep: zepClient ? 'healthy' : 'not configured',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ health }));
  } catch (error) {
    console.error('Error getting system health:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to get system health' }));
  }
}

async function getTokenStats(req, res) {
  try {
    const analytics = await getTokenAnalyticsFromFirestore();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tokens: analytics }));
  } catch (error) {
    console.error('Error getting token stats:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to get token stats' }));
  }
}

async function getUsageAnalytics(req, res) {
  try {
    const analytics = await getTokenAnalyticsFromFirestore();
    
    // Handle empty analytics gracefully
    if (!analytics || !analytics.global) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        usage: {
          global: { totalTokens: 0, totalRequests: 0, uniqueUsers: 0, lastUpdate: null },
          topUsers: [],
          recentSessions: [],
          totalUsers: 0,
          costs: {
            totalCost: 0,
            costByModel: [],
            costByUser: [],
            avgCostPerToken: 0,
            avgCostPerRequest: 0,
            avgCostPerUser: 0
          }
        }
      }));
      return;
    }
    
    // Calculate costs using global modelPricing configuration
    
    let totalCost = 0;
    const costByUser = (analytics.topUsers || []).map(user => {
      let userTotalCost = 0;
      
      // Use model-specific costs if available, otherwise fallback to simplified calculation
      if (user.modelBreakdown && user.modelBreakdown.length > 0) {
        userTotalCost = user.modelBreakdown.reduce((sum, model) => sum + (model.totalCost || 0), 0);
      } else {
        // Fallback to simplified calculation for users without model breakdown
        const inputCost = ((user.inputTokens || 0) / 1000) * 0.00015; // Use mini pricing as default
        const outputCost = ((user.outputTokens || 0) / 1000) * 0.0006;
        userTotalCost = inputCost + outputCost;
      }
      
      totalCost += userTotalCost;
      
      return {
        ...user,
        totalCost: userTotalCost,
        avgCostPerRequest: userTotalCost / Math.max(user.totalRequests || 1, 1)
      };
    }).sort((a, b) => b.totalCost - a.totalCost);
    
    // Calculate cost breakdown by model
    const costByModel = (analytics.modelBreakdown || []).map(model => {
      const pricing = modelPricing[model.model] || { input: 0.00015, output: 0.0006 };
      const inputCost = (model.inputTokens / 1000) * pricing.input;
      const outputCost = (model.outputTokens / 1000) * pricing.output;
      const totalModelCost = inputCost + outputCost;
      
      return {
        model: model.model,
        totalCost: totalModelCost,
        inputCost,
        outputCost,
        avgCostPerRequest: totalModelCost / Math.max(model.totalRequests, 1)
      };
    }).sort((a, b) => b.totalCost - a.totalCost);

    const usage = {
      ...analytics,
      costs: {
        totalCost,
        costByModel,
        costByUser,
        avgCostPerToken: totalCost / Math.max(analytics.global.totalTokens || 1, 1),
        avgCostPerRequest: totalCost / Math.max(analytics.global.totalRequests || 1, 1),
        avgCostPerUser: totalCost / Math.max(analytics.global.uniqueUsers || 1, 1)
      }
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ usage }));
  } catch (error) {
    console.error('Error getting usage analytics:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to get usage analytics' }));
  }
}

async function getConversationStats(req, res) {
  try {
    const conversationAnalytics = await getConversationAnalytics();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ conversations: conversationAnalytics }));
  } catch (error) {
    console.error('Error getting conversation stats:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to get conversation stats' }));
  }
}

async function getConversationDetails(req, res, conversationId) {
  try {
    // With user-organized structure, we need to search across all users for admin access
    // Get all users first
    const usersSnapshot = await db.collection('users').get();
    let conversation = null;
    let userId = null;
    
    // Search for the conversation across all users
    for (const userDoc of usersSnapshot.docs) {
      const currentUserId = userDoc.id;
      const conversationDoc = await db.collection('users').doc(currentUserId).collection('conversations').doc(conversationId).get();
      
      if (conversationDoc.exists) {
        conversation = { id: conversationDoc.id, ...conversationDoc.data() };
        userId = currentUserId;
        break;
      }
    }
    
    if (!conversation) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Conversation not found' }));
      return;
    }
    
    // Get messages for this conversation from the user's collection
    const messages = await getConversationMessages(conversationId, userId);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      conversation,
      messages,
      messageCount: messages.length,
      userId // Include userId for admin reference
    }));
  } catch (error) {
    console.error('Error getting conversation details:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to get conversation details' }));
  }
}

async function getUserConversationHistory(req, res, userId) {
  try {
    const conversations = await getUserConversations(userId, 50);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      userId,
      conversations,
      totalConversations: conversations.length
    }));
  } catch (error) {
    console.error('Error getting user conversation history:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to get user conversation history' }));
  }
}

async function cleanupAnalyticsEndpoint(req, res) {
  try {
    await cleanupCorruptedAnalytics();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Analytics data cleaned successfully' }));
  } catch (error) {
    console.error('Error cleaning up analytics:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to clean up analytics' }));
  }
}

async function getPricing(req, res) {
  try {
    // Return current model pricing configuration
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ pricing: modelPricing }));
  } catch (error) {
    console.error('Error getting pricing:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to get pricing configuration' }));
  }
}

async function updatePricing(req, res) {
  try {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        const { pricing } = JSON.parse(body);
        
        // Validate pricing data
        if (!pricing || typeof pricing !== 'object') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid pricing data' }));
          return;
        }
        
        // Validate each model's pricing
        for (const [modelId, modelPricing] of Object.entries(pricing)) {
          if (!modelPricing.input || !modelPricing.output || 
              typeof modelPricing.input !== 'number' || 
              typeof modelPricing.output !== 'number' ||
              modelPricing.input < 0 || modelPricing.output < 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Invalid pricing for model: ${modelId}` }));
            return;
          }
        }
        
        // Update the global modelPricing object
        Object.keys(modelPricing).forEach(key => delete modelPricing[key]);
        Object.assign(modelPricing, pricing);
        
        console.log('📊 Updated model pricing configuration:', modelPricing);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          message: 'Pricing updated successfully',
          pricing: modelPricing 
        }));
      } catch (parseError) {
        console.error('Error parsing pricing update:', parseError);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON data' }));
      }
    });
  } catch (error) {
    console.error('Error updating pricing:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to update pricing configuration' }));
  }
}

const wss = new WebSocketServer({ server });

// User creation lock to prevent race conditions
const userCreationLocks = new Set();

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
    tier: 'free', // Default to free tier
    conversationId: null,
    model: null,
    lastUserMessage: null
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
          
          // Complete the Firestore conversation when manually stopped
          if (userSession.conversationId) {
            try {
              await completeConversation(userSession.conversationId, userSession.uid);
              console.log(`🔥 Manually completed Firestore conversation: ${userSession.conversationId}`);
              userSession.conversationId = null;
            } catch (error) {
              console.warn('Could not complete Firestore conversation:', error.message);
            }
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
      
      // Get full user record to access displayName
      let userRecord = null;
      try {
        userRecord = await auth.getUser(decodedToken.uid);
      } catch (userError) {
        console.warn('Could not get user record:', userError.message);
      }
      
      // Store user info in session
      userSession.uid = decodedToken.uid;
      userSession.email = decodedToken.email;
      userSession.displayName = userRecord?.displayName || null;
      userSession.authenticated = true;
      userSession.sessionId = `session_${decodedToken.uid}_${Date.now()}`;
      userSession.tier = getUserTier(decodedToken.email);
      
      console.log(`🔐 User authenticated: ${decodedToken.email} (${decodedToken.uid}) - Name: ${userSession.displayName || 'Not set'} - Tier: ${userSession.tier}`);
      
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
        displayName: userSession.displayName,
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
      console.log(`🔍 Retrieving memories for user: ${userId}`);
      
      // First, try to get memories from the user (cross-session)
      try {
        const userMemory = await zepClient.memory.get(userId, {
          lastn: 10  // Get last 10 messages across all sessions
        });
        
        if (userMemory && userMemory.messages && userMemory.messages.length > 0) {
          console.log(`📚 Found ${userMemory.messages.length} memories from user history`);
          return userMemory.messages.map(msg => ({
            content: msg.content,
            role: msg.role_type || msg.role,
            timestamp: msg.created_at
          }));
        }
      } catch (userError) {
        console.log(`⚠️ Could not get user memories: ${userError.message}`);
      }
      
      // Fallback: If no user memories, try current session
      try {
        const sessionMemory = await zepClient.memory.get(sessionId, {
          lastn: 5  // Get last 5 messages from current session
        });
        
        if (sessionMemory && sessionMemory.messages && sessionMemory.messages.length > 0) {
          console.log(`📚 Found ${sessionMemory.messages.length} memories from current session`);
          return sessionMemory.messages.map(msg => ({
            content: msg.content,
            role: msg.role_type || msg.role,
            timestamp: msg.created_at
          }));
        }
      } catch (sessionError) {
        console.log(`⚠️ Could not get session memories: ${sessionError.message}`);
      }
      
      console.log(`📚 No memories found for user ${userId}`);
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
          
          // Store memory under USER ID for cross-session persistence
          // This allows the AI to remember across different sessions
          const memoryResult = await zepClient.memory.add(userId, {
            messages: messages,
            metadata: {
              sessionId: sessionId,
              timestamp: new Date().toISOString(),
              firebase_uid: userId,
              user_email: userSession?.email || 'unknown'
            }
          });
          
          console.log(`✅ Memory stored under user ID: ${userId}`);
          
          // Verify the storage worked correctly
          console.log(`🔍 Verifying memory was stored correctly...`);
          try {
            const verification = await zepClient.memory.get(userId, { lastn: 1 });
            if (verification && verification.messages && verification.messages.length > 0) {
              console.log(`✅ SUCCESS: Memory verified for user ${userId}`);
              console.log(`📊 Latest message: "${verification.messages[0].content}"`);
              console.log(`🔗 Session context: ${sessionId}`);
            } else {
              console.log(`❌ WARNING: No memories found for user ${userId} after storage`);
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
        // Create a more structured memory context that's more useful for the AI
        const memorySummary = recentMemories.slice(-6); // Last 6 exchanges (12 messages)
        
        // Extract key themes and topics from recent conversations
        const userMessages = memorySummary.filter(m => m.role === 'user').map(m => m.content);
        const assistantMessages = memorySummary.filter(m => m.role === 'assistant').map(m => m.content);
        
        // Create a more contextual memory format
        memoryContext = `\n\nCONVERSATION CONTEXT (Last ${memorySummary.length} exchanges):
${memorySummary.map((m, i) => `${i + 1}. ${m.role.toUpperCase()}: ${m.content}`).join('\n')}

KEY INSIGHTS:
- User's communication style: ${userMessages.length > 0 ? 'Direct and conversational' : 'Still getting to know'}
- Recent topics: ${userMessages.slice(-3).map(msg => `"${msg.substring(0, 50)}..."`).join(', ')}
- Your approach: ${assistantMessages.length > 0 ? 'Warm, grounded, and spiritually aware' : 'Building rapport'}

Remember to reference previous conversations naturally and build on established rapport.`;
        
        console.log(`🧠 Injecting ${recentMemories.length} memories into AI context for ${userSession.email}`);
        console.log(`📝 Memory preview: "${recentMemories[recentMemories.length - 1].content.substring(0, 100)}..."`);
        console.log(`🔍 Key themes detected: ${userMessages.slice(-3).map(msg => msg.substring(0, 30)).join(', ')}`);
      } else {
        console.log(`🧠 No previous memories found for ${userSession.email} - starting fresh conversation`);
      }
      
      // Determine which model to use based on user tier
      const selectedModel = getModelForTask(userSession.tier, 'realtime');
      console.log(`🤖 Using model: ${selectedModel} for ${userSession.tier} user: ${userSession.email}`);
      
      // Store model in user session
      userSession.model = selectedModel;
      
      // Create Firestore conversation for this session
      try {
        const conversationId = await createConversation(
          userSession.uid,
          userSession.email,
          userSession.sessionId,
          selectedModel,
          userSession.tier
        );
        userSession.conversationId = conversationId;
        console.log(`🔥 Created Firestore conversation: ${conversationId}`);
      } catch (error) {
        console.warn('Could not create Firestore conversation:', error.message);
      }
      
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
        
        // Build personalized greeting based on user's name
        let nameContext = '';
        let initialGreeting = '';
        if (userSession.displayName) {
          nameContext = `User's name: ${userSession.displayName}`;
          initialGreeting = `Start the conversation by greeting ${userSession.displayName} warmly by name.`;
        } else {
          nameContext = `User's name: Unknown (ask for their name in a natural way during the conversation)`;
          initialGreeting = `Start the conversation with a warm greeting and naturally ask for their name during your introduction.`;
        }

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
            
            MEMORY & CONTINUITY:
            - Use the conversation context to build on previous discussions naturally
            - Reference past topics when relevant, but don't force connections
            - Remember what the user has shared about their life, interests, and concerns
            - Build genuine rapport by showing you remember and care about their journey
            - If they mention ongoing situations or challenges, follow up appropriately
            
            You're here for genuine connection and exploration of what matters, not to coddle or treat anyone as fragile.
            
            ${initialGreeting}
            
            User: ${userSession.email}
            User ID: ${userSession.uid}
            ${nameContext}
            ${memoryContext}`,
            voice: config.voice || 'shimmer', // Shimmer voice for warmth and clarity
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

            openaiWs.on('message', async (data) => {
        try {
          const event = JSON.parse(data);
          console.log('📡 OpenAI event:', event.type);
          
          // TRACK TOKEN USAGE FROM OPENAI EVENTS
          if (event.type === 'response.done' && event.response && event.response.usage) {
            const usage = event.response.usage;
            trackTokenUsage(
              userSession.uid,
              userSession.email,
              userSession.sessionId,
              selectedModel,
              usage.input_tokens || 0,
              usage.output_tokens || 0,
              'response.done'
            );
            
            // Store usage for Firestore
            userSession.lastResponseTokens = {
              input: usage.input_tokens || 0,
              output: usage.output_tokens || 0
            };
          }
          
          // Also track token usage from input audio transcription events
          if (event.type === 'conversation.item.input_audio_transcription.completed' && event.usage) {
            trackTokenUsage(
              userSession.uid,
              userSession.email,
              userSession.sessionId,
              'whisper-1', // Whisper model for transcription
              event.usage.input_tokens || 0,
              event.usage.output_tokens || 0,
              'audio_transcription'
            );
            
            // Store transcription usage for Firestore
            userSession.lastTranscriptionTokens = {
              input: event.usage.input_tokens || 0,
              output: event.usage.output_tokens || 0
            };
          }
          
          // Track usage from response generation events
          if (event.type === 'response.output_item.done' && event.usage) {
            trackTokenUsage(
              userSession.uid,
              userSession.email,
              userSession.sessionId,
              selectedModel,
              event.usage.input_tokens || 0,
              event.usage.output_tokens || 0,
              'response.output_item.done'
            );
          }
          
          // Store conversation data when we get complete transcripts (but don't save to Firestore yet)
          if (event.type === 'conversation.item.input_audio_transcription.completed') {
            userSession.pendingUserMessage = {
              transcript: event.transcript,
              timestamp: new Date().toISOString()
            };
            console.log(`📝 Captured user transcript: "${event.transcript}"`);
          }
          
          if (event.type === 'response.audio_transcript.done') {
            userSession.pendingAssistantMessage = {
              transcript: event.transcript,
              timestamp: new Date().toISOString()
            };
            console.log(`📝 Captured assistant transcript: "${event.transcript}"`);
          }
          
          // When response is done, we have complete usage data - now store everything to Firestore
          if (event.type === 'response.done' && userSession.lastResponseTokens) {
            const userMessage = userSession.pendingUserMessage;
            const assistantMessage = userSession.pendingAssistantMessage;
            
            if (userMessage && assistantMessage) {
              // Store in Zep memory asynchronously
              storeMemory(userSession.uid, userSession.sessionId, userMessage.transcript, assistantMessage.transcript, userSession);
              
              // Store in Firestore with complete token usage data
              if (userSession.conversationId) {
                try {
                  // Calculate token distribution (OpenAI Realtime API provides total usage in response.done)
                  const totalTokens = userSession.lastResponseTokens;
                  
                  // Estimate token distribution between user and assistant
                  // For Whisper transcription, typically small input token count
                  const estimatedUserTokens = {
                    input: Math.min(totalTokens.input, Math.ceil(userMessage.transcript.length / 4)), // Rough estimate
                    output: 0 // Transcription doesn't generate output tokens
                  };
                  
                  const estimatedAssistantTokens = {
                    input: totalTokens.input - estimatedUserTokens.input,
                    output: totalTokens.output
                  };
                  
                  // Store user message
                  await storeMessage(
                    userSession.conversationId,
                    userSession.uid,
                    'user',
                    userMessage.transcript,
                    estimatedUserTokens,
                    'whisper-1',
                    'audio_transcription'
                  );
                  
                  // Store assistant message
                  await storeMessage(
                    userSession.conversationId,
                    userSession.uid,
                    'assistant',
                    assistantMessage.transcript,
                    estimatedAssistantTokens,
                    userSession.model,
                    'response.audio_transcript.done'
                  );
                  
                  console.log(`🔥 Stored conversation exchange in Firestore with token distribution`);
                  console.log(`📊 User message tokens:`, estimatedUserTokens);
                  console.log(`📊 Assistant message tokens:`, estimatedAssistantTokens);
                  console.log(`📊 Total tokens from OpenAI:`, totalTokens);
                  
                } catch (error) {
                  console.warn('Could not store messages in Firestore:', error.message);
                }
              }
              
              // Clear pending messages and tokens
              userSession.pendingUserMessage = null;
              userSession.pendingAssistantMessage = null;
              userSession.lastResponseTokens = null;
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

      openaiWs.on('close', async () => {
        console.log('OpenAI WebSocket connection closed');
        isConnected = false;
        
        // Complete the Firestore conversation
        if (userSession.conversationId) {
          try {
            await completeConversation(userSession.conversationId, userSession.uid);
            console.log(`🔥 Completed Firestore conversation: ${userSession.conversationId}`);
          } catch (error) {
            console.warn('Could not complete Firestore conversation:', error.message);
          }
        }
        
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

server.listen(3001, async () => {
  console.log('🚀 Initializing GPT-4o Mini Realtime Server...');
  
  // Clean up any corrupted analytics data on startup
  try {
    const testAnalytics = await getTokenAnalyticsFromFirestore();
    console.log('✅ Analytics system verified');
  } catch (error) {
    if (error.message && error.message.includes('toISOString is not a function')) {
      console.log('🔧 Detected corrupted analytics data on startup, cleaning up...');
      await cleanupCorruptedAnalytics();
    }
  }
  
  console.log('⚡ WebSocket realtime server running on port 3001');
  console.log('📊 Admin analytics available at http://localhost:3001/admin/stats');
  console.log('🔒 Admin panel available at http://localhost:3001/admin/*');
});

server.on('error', (err) => {
  console.error('Server error:', err);
});