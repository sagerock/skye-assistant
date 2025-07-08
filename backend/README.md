# Skye Assistant Backend

Real-time AI voice assistant backend server using OpenAI Realtime API.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file with the following variables:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Firebase Configuration (Service Account JSON as string)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project-id",...}

# Zep Cloud Configuration (Optional - for conversation memory)
ZEP_API_KEY=your_zep_api_key_here

# Server Configuration
PORT=3001

# Node Environment
NODE_ENV=development
```

3. Start the server:
```bash
node src/realtime-server.js
```

## Features

- OpenAI Realtime API integration
- Firebase Authentication
- Zep Cloud conversation memory
- Real-time WebSocket communication
- PCM16 audio streaming

## API Endpoints

- WebSocket: `ws://localhost:3001`
- Health check: `http://localhost:3001` 