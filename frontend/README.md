# Skye Assistant Frontend

React + TypeScript frontend for the Skye Assistant real-time voice AI.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file with Firebase configuration:

```bash
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

3. Start the development server:
```bash
npm run dev
```

## Features

- Real-time voice conversations with AI
- Firebase Authentication
- WebSocket communication with backend
- Audio recording and playback (PCM16)
- Voice selection (8 OpenAI voices)
- Responsive modern UI

## Tech Stack

- React 18
- TypeScript
- Vite
- Firebase Auth
- Web Audio API
- WebSocket communication

## Architecture

- `components/Auth.tsx` - Firebase authentication component
- `components/RealtimeInterface.tsx` - Main voice interface
- `firebase.ts` - Firebase configuration
- Real-time audio streaming to backend via WebSocket
