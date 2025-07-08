# Skye Assistant Troubleshooting Guide

This document outlines common issues encountered during development and their solutions to prevent future problems.

## 🚨 Critical Path Issues

### 1. **Directory Confusion - "Cannot find module" Error**

**Problem**: Running commands from wrong directory
```bash
Error: Cannot find module '/Volumes/T7/Scripts/Skye Assistant 2/src/realtime-server.js'
```

**Root Cause**: Commands run from project root instead of backend directory

**Solution**:
- ✅ **Always run backend commands from `backend/` directory**
- ✅ Use: `cd backend && node src/realtime-server.js`
- ❌ Don't use: `node src/realtime-server.js` from project root

**Prevention**:
```bash
# Correct workflow
cd "/Volumes/T7/Scripts/Skye Assistant 2/backend"
node src/realtime-server.js

# Or one-liner
cd backend && node src/realtime-server.js
```

### 2. **Port 3001 Already in Use - "EADDRINUSE" Error**

**Problem**: Multiple servers running on same port
```bash
Error: listen EADDRINUSE: address already in use :::3001
```

**Root Cause**: Old server processes not properly killed

**Solution**:
```bash
# Kill all Node.js processes
pkill -f "node.*server"
pkill -f "realtime-server"

# Or kill specific port
lsof -ti:3001 | xargs kill -9

# Wait and restart
sleep 2 && node src/realtime-server.js
```

**Prevention**:
- Always kill existing processes before starting new ones
- Use `ps aux | grep node` to check running processes
- Use `lsof -i:3001` to check port usage

### 3. **Zep Import Error - "ZepCloudClient is not a constructor"**

**Problem**: Incorrect Zep Cloud client import
```bash
TypeError: ZepCloudClient is not a constructor
```

**Root Cause**: Changed API - `ZepCloudClient` → `ZepClient`

**Solution**: Use correct import
```javascript
// ❌ Old (broken)
const { ZepCloudClient } = require('@getzep/zep-cloud');
zepClient = new ZepCloudClient({ apiKey: process.env.ZEP_API_KEY });

// ✅ New (correct)
const { ZepClient } = require('@getzep/zep-cloud');
zepClient = new ZepClient({ apiKey: process.env.ZEP_API_KEY });
```

### 4. **OpenAI Voice Error - "Invalid value: 'nova'"**

**Problem**: Using unsupported voice
```bash
Invalid value: 'nova'. Supported values are: 'alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'.
```

**Solution**: Use only supported voices
```javascript
// ✅ Supported voices
const SUPPORTED_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'];

// Default fallback
const voice = SUPPORTED_VOICES.includes(selectedVoice) ? selectedVoice : 'alloy';
```

### 5. **Zep Memory Integration - "Cannot read properties of undefined" Error**

**Problem**: Zep client initialization and conversation storage failing
```bash
TypeError: Cannot read properties of undefined (reading 'addMemory')
zepClient.memory.addMemory is not a function
```

**Root Cause**: Multiple issues with Zep Cloud SDK integration:
1. Incorrect client initialization timing (before authentication)
2. Wrong memory API method usage (`addMemory` vs `add`)
3. Improper session/user ID handling
4. Missing async/await error handling

**Solution**: Complete Zep integration overhaul
```javascript
// ✅ Correct Zep client initialization (after user auth)
if (user?.uid && !zepClient) {
  zepClient = new ZepClient({ apiKey: process.env.ZEP_API_KEY });
  console.log('✅ Zep client initialized for user:', user.uid);
}

// ✅ Correct memory storage method
try {
  await zepClient.memory.add(user.uid, {
    messages: conversationHistory,
    metadata: { timestamp: new Date().toISOString() }
  });
  console.log('💾 Stored conversation in Zep for user', user.uid);
} catch (error) {
  console.error('❌ Failed to store in Zep:', error);
}

// ✅ Proper conversation history tracking
const conversationHistory = [];
// Track both user input and AI responses
if (transcript) {
  conversationHistory.push({
    role: 'user',
    content: transcript
  });
}
if (aiResponse) {
  conversationHistory.push({
    role: 'assistant', 
    content: aiResponse
  });
}
```

**Key Fixes Applied**:
1. **Lazy initialization**: Zep client created only after user authentication
2. **Correct API usage**: `zepClient.memory.add()` instead of `addMemory()`
3. **Proper session management**: Using Firebase user UID as session identifier
4. **Conversation tracking**: Collecting both user transcripts and AI responses
5. **Error handling**: Try-catch blocks around all Zep operations
6. **Timing fixes**: Store memories after conversation completion, not during

**Prevention**:
- Always initialize Zep client after user authentication
- Use the correct Zep Cloud SDK API methods (check latest documentation)
- Implement proper error handling for all external service calls
- Test memory storage with actual conversation data

**Success Indicators**:
- ✅ `💾 Stored conversation in Zep for user [user-id]` in server logs
- ✅ No Zep-related errors during conversation
- ✅ Conversation history properly accumulated before storage

### 6. **Zep User ID Inconsistency - "New User Created Every Login"**

**Problem**: New Zep user created on each login instead of using persistent Firebase UID
```
Zep Dashboard shows multiple users like:
zep_057f84598f59f09fef06754221623876d689384ef05ebae259b2f6f28eb2b72d
zep_1c5f98144b29138d7fd495bfc57128df20577b020507b7d935a52328c5d28e91
```

**Root Cause**: Using dynamic `sessionId` instead of consistent Firebase UID as Zep user identifier
```javascript
// ❌ Wrong - creates new user each time
userSession.sessionId = `session_${decodedToken.uid}_${Date.now()}`;
await zepClient.memory.add(sessionId, { messages });  // sessionId changes!

// ❌ Also wrong - using sessionId for user lookup
const memory = await zepClient.memory.get(sessionId, { lastn: 10 });
```

**Solution**: Use Firebase UID consistently as Zep user identifier
```javascript
// ✅ Correct - use consistent Firebase UID
await zepClient.memory.add(userId, { 
  messages: messages,
  metadata: {
    sessionId: sessionId,  // sessionId as metadata only
    timestamp: new Date().toISOString()
  }
});

// ✅ Correct - get memories by Firebase UID
const memory = await zepClient.memory.get(userId, { lastn: 10 });

// ✅ Correct - proper role assignment
const messages = [{
  role: 'user',        // Standard role name
  roleType: 'user',
  content: userMessage
}, {
  role: 'assistant',   // Standard role name
  roleType: 'assistant',
  content: assistantMessage
}];
```

**Key Changes Made**:
1. **Consistent User ID**: Firebase UID used as Zep user identifier instead of changing sessionId
2. **Proper API Usage**: `zepClient.memory.add(userId, ...)` instead of `add(sessionId, ...)`
3. **Memory Retrieval**: `zepClient.memory.get(userId, ...)` for consistent history access
4. **Session Metadata**: sessionId stored as metadata for tracking, not as primary identifier
5. **Standard Roles**: Using 'user' and 'assistant' instead of custom role names

**Prevention**:
- Always use persistent user identifiers (Firebase UID) for external services
- Keep session identifiers separate from user identifiers
- Test memory persistence across multiple login sessions
- Monitor Zep dashboard to verify single user per person

**Success Indicators**:
- ✅ Same Zep user ID appears for repeated logins by same Firebase user
- ✅ `👤 Existing Zep user found: [firebase-uid]` in logs for returning users
- ✅ `👤 Created new Zep user with Firebase UID: [firebase-uid]` only on first login
- ✅ Conversation history carries over between sessions
- ✅ Zep dashboard shows single user per Firebase account

### 7. **Zep Cloud Session Auto-Generation - "Sessions Creating New Users"**

**Problem**: Zep Cloud automatically creating session-based users instead of using explicitly created Firebase UID users
```
Zep Dashboard showing:
- User ID: zep_a103c033ca3002a93a20325e9e51bd331d069bdd27b52bb1 (auto-generated hash)
- Session ID: uxS93DlkVCRmqf5UjSGjL4gwUED3 (our Firebase UID!)
- Email: Empty (not being set)

Memory was being stored under the hash ID user, not the Firebase UID user.
```

**Root Cause**: Zep Cloud's automatic session management behavior
- When `memory.add(sessionId, {...})` is called without explicit user-session linking
- Zep automatically creates a new user with a hash ID for that session
- The Firebase UID becomes the session ID instead of the user ID
- This bypasses our explicit user creation and email management

**Solution**: Implement explicit user-session linking pattern
```javascript
// ✅ CRITICAL: Add session to user explicitly BEFORE storing memory
async function ensureUserSession(userId, sessionId, userSession = {}) {
  // ... existing user creation/validation code ...
  
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
    if (sessionError.message.includes('already exists')) {
      console.log(`ℹ️ Session ${sessionId} already exists for user ${userId}`);
    } else {
      console.error(`❌ Failed to add session: ${sessionError.message}`);
    }
  }
}

// ✅ THEN store memory using the session (which is now linked to correct user)
await zepClient.memory.add(sessionId, {
  messages: messages,
  metadata: {
    sessionId: sessionId,
    timestamp: new Date().toISOString(),
    firebase_uid: userId,
    user_email: userSession?.email || 'unknown'
  }
});
```

**Key Technical Details**:
1. **Zep Cloud Behavior**: If a session isn't explicitly linked to a user, Zep auto-creates a user for that session
2. **Session-User Relationship**: Must use `memory.addSession()` to explicitly link sessions to existing users
3. **API Call Order**: User creation → Session linking → Memory storage
4. **Verification**: Check that `memory.get(sessionId)` returns `user_id` matching your Firebase UID

**Race Condition Prevention**:
```javascript
// Added user creation locks to prevent duplicate user creation
const userCreationLocks = new Set();

if (userCreationLocks.has(userId)) {
  console.log(`⏳ User creation already in progress for ${userId}, waiting...`);
  await new Promise(resolve => setTimeout(resolve, 100));
  return;
}
userCreationLocks.add(userId);
// ... user creation logic ...
userCreationLocks.delete(userId);
```

**Success Indicators**:
- ✅ `🔗 Adding session [session-id] to user [firebase-uid]...` in logs
- ✅ `✅ Session [session-id] successfully linked to user [firebase-uid]` in logs
- ✅ Zep dashboard shows Firebase UID as User ID (not hash)
- ✅ User email properly populated in Zep dashboard
- ✅ Multiple sessions linked to single user (not creating new users per session)
- ✅ `✅ CORRECT: Session linked to Firebase UID [uid]` in verification logs

**Before Fix**: 
- 3 users created (2 hash IDs + 1 Firebase UID)
- Hash ID users had conversations
- Firebase UID user was empty

**After Fix**:
- 1 user (Firebase UID with email)
- Multiple sessions properly linked to that user
- All conversations stored under correct user

## 🔧 Environment Issues

### 8. **Firebase Authentication - "api-key-not-valid"**

**Problem**: Accessing static HTML with wrong Firebase config

**Root Cause**: Using hardcoded credentials instead of environment variables

**Solution**:
- ✅ Use React app with proper `.env` configuration
- ✅ Never access static HTML files directly
- ❌ Don't use hardcoded Firebase credentials

**Prevention**:
```bash
# Always use React dev server
cd frontend && npm run dev
# Access: http://localhost:5173 (NOT static HTML files)
```

### 9. **Missing Environment Variables**

**Problem**: Services fail to initialize

**Solution**: Ensure all `.env` files exist:

**Backend `.env`**:
```env
OPENAI_API_KEY=your_openai_key
ZEP_API_KEY=your_zep_key
FIREBASE_PROJECT_ID=your_project_id
```

**Frontend `.env`**:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## 🔄 Startup Procedures

### Correct Startup Sequence

**1. Kill existing processes**:
```bash
pkill -f "node.*server"
pkill -f "realtime-server"
```

**2. Start backend**:
```bashs
cd backend
node src/realtime-server.js
```

**3. Start frontend** (separate terminal):
```bash
cd frontend
npm run dev
```

**4. Access application**:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### Health Check Commands

```bash
# Check running processes
ps aux | grep node | grep -v grep

# Check port usage
lsof -i:3001
lsof -i:5173

# Test backend endpoint
curl http://localhost:3001

# Test WebSocket connection
wscat -c ws://localhost:3001
```

## 🐛 Common Debugging Steps

### "Unknown message type" Error

**Problem**: Frontend receiving unhandled message types

**Solution**: Added comprehensive message type handling in `RealtimeInterface.tsx`:
```javascript
// Log unknown types instead of showing errors to users
console.log('Unknown message type:', data.type, data);
```

### Audio Issues

**Check browser permissions**:
- Microphone access granted
- HTTPS or localhost (required for WebRTC)
- Browser console for audio errors

**Check audio format**:
- 24kHz PCM16 format
- Proper Web Audio API usage
- MediaRecorder configuration

### Authentication Issues

**Check Firebase setup**:
- Correct project configuration
- Valid API keys
- Proper authentication flow

**Check server logs**:
- User authentication success
- JWT token validation
- WebSocket connection established

## 📁 File Structure Verification

Ensure proper file structure:
```
Skye Assistant 2/
├── backend/
│   ├── .env                    # Backend environment variables
│   ├── src/
│   │   └── realtime-server.js  # Main server file
│   └── package.json
├── frontend/
│   ├── .env                    # Frontend environment variables
│   ├── src/
│   │   └── components/
│   │       └── RealtimeInterface.tsx
│   └── package.json
└── README.md
```

## 🚀 Best Practices

### Development Workflow

1. **Always check current directory** before running commands
2. **Kill existing processes** before starting new ones
3. **Use environment variables** for all sensitive data
4. **Test both frontend and backend** independently
5. **Check browser console** for frontend errors
6. **Monitor server logs** for backend issues

### Error Prevention

1. **Use absolute paths** when switching directories
2. **Implement proper error handling** in both frontend and backend
3. **Validate environment variables** on startup
4. **Use TypeScript** for better error catching
5. **Keep dependencies updated** but test compatibility

### Monitoring

1. **Server logs** show real-time activity
2. **Browser DevTools** for frontend debugging
3. **Network tab** for WebSocket connection issues
4. **Console logs** for application flow

## 📞 Quick Reference

### Emergency Reset Commands
```bash
# Kill everything and restart clean
pkill -f node
cd backend && node src/realtime-server.js &
cd ../frontend && npm run dev
```

### Log Locations
- Backend: Terminal output from `node src/realtime-server.js`
- Frontend: Browser DevTools Console
- Network: Browser DevTools Network Tab

### Success Indicators
- ✅ "🔥 Skye Realtime AI Server running on http://localhost:3001"
- ✅ "🔐 User authenticated: [email]"
- ✅ "✅ Connected to OpenAI Realtime API"
- ✅ "📨 Client message: audio_data" (during conversation)
- ✅ "📡 OpenAI event: response.audio.delta" (AI responding)

This guide should prevent the majority of issues encountered during development and provide quick resolution paths when problems occur. 