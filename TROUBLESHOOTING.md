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
Invalid value: 'nova'. Supported values are: 'alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', and 'verse'.
```

**Solution**: Use only supported voices
```javascript
// ✅ Supported voices
const SUPPORTED_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'];

// Default fallback
const voice = SUPPORTED_VOICES.includes(selectedVoice) ? selectedVoice : 'alloy';
```

## 🔧 Environment Issues

### 5. **Firebase Authentication - "api-key-not-valid"**

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

### 6. **Missing Environment Variables**

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
```bash
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