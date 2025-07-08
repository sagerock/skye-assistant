# Skye Assistant 2

🎤 Real-time AI voice assistant powered by OpenAI's GPT-4o Realtime API

A modern, real-time voice conversation application with Firebase authentication, persistent memory, and seamless audio streaming.

## ✨ Features

- **Real-time Voice Conversations**: Natural voice interactions with OpenAI's GPT-4o Mini
- **8 AI Voices**: Choose from Alloy, Ash, Ballad, Coral, Echo, Sage, Shimmer, Verse
- **Firebase Authentication**: Secure user management and authentication
- **Persistent Memory**: Conversation history with Zep Cloud integration
- **Modern UI**: Clean, responsive React interface
- **Real-time Audio**: PCM16 audio streaming with WebSocket communication
- **Voice Activity Detection**: Smart speech detection and turn management

## 🏗️ Architecture

```
Frontend (React + TypeScript)     Backend (Node.js + WebSocket)
├── Firebase Auth                 ├── OpenAI Realtime API
├── Audio Recording (Web API)     ├── Firebase Admin SDK
├── WebSocket Client              ├── Zep Cloud Memory
└── Real-time UI                  └── PCM16 Audio Processing
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- OpenAI API key with Realtime API access
- Firebase project with Authentication enabled
- (Optional) Zep Cloud API key for conversation memory

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
npm install
```

2. Create `.env` file in the `backend/` directory:
```bash
OPENAI_API_KEY=your_openai_api_key_here
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
ZEP_API_KEY=your_zep_api_key_here
PORT=3001
NODE_ENV=development
```

3. Start the backend (from `backend/` directory):
```bash
# Make sure you're in the backend directory!
cd backend
node src/realtime-server.js
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
npm install
```

2. Create `.env` file in the `frontend/` directory:
```bash
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

3. Start the frontend (from `frontend/` directory):
```bash
# Make sure you're in the frontend directory!
cd frontend
npm run dev
```

## 🚀 Quick Start Commands

**Option 1: Step by Step**
```bash
# Terminal 1 - Backend
cd "/path/to/your/project/backend"
node src/realtime-server.js

# Terminal 2 - Frontend  
cd "/path/to/your/project/frontend"
npm run dev
```

**Option 2: One-line Commands**
```bash
# Backend (from project root)
cd backend && node src/realtime-server.js

# Frontend (from project root)  
cd frontend && npm run dev
```

**⚠️ Common Issue: Directory Confusion**
- Always run `node src/realtime-server.js` from the `backend/` directory
- If you get "Cannot find module" error, you're in the wrong directory
- The correct path structure is: `backend/src/realtime-server.js`

## 🎯 Usage

1. Open the frontend application in your browser
2. Sign in with Firebase Authentication
3. Click "Start Session" to begin voice conversation
4. Grant microphone permissions when prompted
5. Start talking naturally with the AI assistant
6. The AI will respond with both text and voice

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Firebase Auth** for user authentication
- **Web Audio API** for real-time audio processing
- **WebSocket** for real-time communication

### Backend
- **Node.js** with WebSocket server
- **OpenAI Realtime API** (GPT-4o Mini)
- **Firebase Admin SDK** for authentication
- **Zep Cloud** for conversation memory
- **PCM16 Audio** processing

## 📁 Project Structure

```
Skye Assistant 2/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth.tsx
│   │   │   └── RealtimeInterface.tsx
│   │   ├── firebase.ts
│   │   └── App.tsx
│   └── package.json
├── backend/
│   ├── src/
│   │   └── realtime-server.js
│   └── package.json
└── README.md
```

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
- `OPENAI_API_KEY` - OpenAI API key with Realtime API access
- `FIREBASE_SERVICE_ACCOUNT_KEY` - Firebase service account JSON (as string)
- `ZEP_API_KEY` - (Optional) Zep Cloud API key for memory
- `PORT` - Server port (default: 3001)

**Frontend (.env)**
- `VITE_FIREBASE_API_KEY` - Firebase project API key
- `VITE_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `VITE_FIREBASE_PROJECT_ID` - Firebase project ID
- `VITE_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `VITE_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `VITE_FIREBASE_APP_ID` - Firebase app ID

## 🎵 Audio Configuration

- **Sample Rate**: 24kHz PCM16
- **Channels**: Mono (1 channel)
- **Format**: PCM16 (16-bit linear PCM)
- **Streaming**: Real-time WebSocket audio chunks

## 🔒 Security

- All `.env` files are properly gitignored
- Firebase service account credentials are protected
- User authentication required for all voice sessions
- Secure WebSocket communication

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- OpenAI for the Realtime API
- Firebase for authentication infrastructure
- Zep Cloud for conversation memory
- The React and Node.js communities
