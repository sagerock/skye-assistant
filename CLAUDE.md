# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Skye Assistant is a real-time, browser-based voice AI assistant built on OpenAI's `gpt-4o-mini-realtime-preview` model. The project supports spoken conversations with persistent memory and Retrieval-Augmented Generation (RAG), with user authentication via Firebase.

**Current Status**: Advanced real-time voice conversation system with GPT-4o Mini Realtime API complete and functional. Comprehensive tier-based service restrictions implemented.

## Development Commands

### Frontend (React + Vite)
- `cd frontend && npm run dev` - Start development server
- `cd frontend && npm run build` - Build for production
- `cd frontend && npm run preview` - Preview production build

### Backend (Node.js + TypeScript)
- `cd backend && npm run dev` - Start development server with hot reload
- `cd backend && npm run build` - Build TypeScript to JavaScript
- `cd backend && npm run start` - Start production server

### Real-time Voice Servers
- `cd backend && node src/working-ai-server.js` - Speech-to-text + text responses (port 8080)
- `cd backend && node src/realtime-server.js` - GPT-4o Mini Realtime (port 3001)

### Setup
1. Environment files are already configured with Firebase credentials
2. Backend: `cd backend && npm install && npm run dev`
3. Frontend: `cd frontend && npm install && npx vite`
4. Add OpenAI API key to backend/.env for full functionality

### Current Status
- ✅ Backend server running on port 3001 with Firebase auth
- ✅ Frontend structure complete with React components
- ✅ WebSocket communication established
- ✅ Authentication system implemented
- ✅ OpenAI GPT-4o-mini integration with speech-to-text (working-ai-server.js)
- ✅ OpenAI GPT-4o-mini Realtime API with direct audio streaming (realtime-server.js)
- ✅ Real-time voice conversation system fully functional
- ✅ **Tier-based service restrictions implemented**
  - Free tier: 5 sessions/hour, 20/day, 10-min sessions, 50K tokens/day, 1 concurrent
  - Premium tier: 50 sessions/hour, 200/day, 1-hour sessions, 500K tokens/day, 3 concurrent
  - Real-time limit enforcement and session monitoring
  - Admin panel for user limit management
- ✅ **Comprehensive user profile system**
  - 4-tab interface: Overview, Conversations, Analytics, Settings
  - Real-time usage statistics and conversation history
  - Individual conversation message viewer
  - Personal analytics dashboard with cost tracking

### Voice Interfaces
- `frontend/skye-test.html` - Speech-to-text with intelligent text responses
- `frontend/skye-realtime.html` - Real-time voice conversation with GPT-4o Mini Realtime

## Architecture

### Frontend (React)
- Captures mic audio using WebRTC or `MediaRecorder`
- Streams audio or text to backend via WebSocket
- Plays back audio responses from GPT-4o-mini
- Handles Firebase auth and ID token exchange

### Backend (Node.js or Python)
- WebSocket server for real-time communication
- Firebase Admin SDK for authentication
- Integrates with Zep Cloud for persistent memory
- Integrates with Qdrant Cloud for RAG functionality
- Streams responses back to client
- **Tier-based service restrictions and usage tracking**
- Real-time session monitoring and enforcement

## External Services Integration

- **OpenAI GPT-4o Realtime**: Voice+text model with audio I/O
- **Firebase Auth**: User authentication system
- **Zep Cloud**: Long-term memory storage (user chat history)
- **Qdrant Cloud**: Vector database for RAG document search
- **Render/Vercel**: Hosting platforms for deployment

## Authentication Flow

1. User authentication via Firebase (email/password or OAuth)
2. Client sends Firebase ID token during WebSocket connection
3. Backend verifies token and extracts user UID
4. UID used for personalized Zep memory and Qdrant context

## Data Flow

```
User speaks → Frontend records audio → WebSocket to backend → 
Backend authenticates + queries memory/context → GPT-4o-mini → 
Streamed response → Frontend plays audio
```

## System Prompt Template

The assistant should be configured as "Skye, a kind and attentive AI assistant" that:
- Remembers user preferences and past conversations
- Adapts over time using memory and documents
- Supports voice interaction with respectful conversation flow
- Personalizes replies using available context

## Tier-Based Service System

### Service Tiers

#### **Free Tier**
- 5 sessions per hour
- 20 sessions per day
- 10-minute session duration limit
- 50,000 tokens per day
- 1 concurrent session
- GPT-4o Mini model
- Basic features

#### **Premium Tier**
- 50 sessions per hour
- 200 sessions per day  
- 1-hour session duration limit
- 500,000 tokens per day
- 3 concurrent sessions
- GPT-4o model (enhanced)
- Advanced features and priority support

### Implementation Details

#### **Backend Enforcement** (`realtime-server.js`)
- Session limits checked before connection (`canUserStartSession`)
- Token usage tracked and validated (`canUserUseTokens`, `recordTokenUsage`)
- Real-time session monitoring every 30 seconds
- Automatic session termination for duration limits
- Concurrent session tracking per user

#### **Frontend Integration** (`RealtimeInterface.tsx`)
- Tier badge display with upgrade prompts
- Real-time limit information
- Enhanced error messages for limit violations
- Graceful degradation when limits reached

#### **Admin Panel** (`AdminPanel.tsx`)
- `/admin/limits` endpoint for usage monitoring
- Real-time session tracking
- User tier management
- Usage analytics and cost tracking

#### **Database Schema**
```javascript
// User limits tracking (in-memory)
userLimits: {
  daily: { tokensUsed, sessionsStarted, resetTime },
  hourly: { sessionsStarted, resetTime },
  activeSessions: Set(),
  sessionStartTimes: Map()
}

// Firestore analytics
analytics/token_usage/events/: { userId, sessionId, model, tokens, timestamp }
analytics/token_usage/users/: { userId, totalTokens, totalRequests }
analytics/token_usage/global/: { totalTokens, totalRequests }
```

### Key Features
- **Smart Resets**: Automatic daily/hourly limit resets
- **Real-time Monitoring**: Live session tracking and termination
- **User Experience**: Clear messaging and upgrade paths
- **Admin Visibility**: Comprehensive usage analytics
- **Security**: Proper validation at all entry points

## User Profile System

### Overview
Comprehensive user profile page with personal analytics, conversation history, and account management.

### Profile Features

#### **4-Tab Navigation Interface**
- **Overview**: Statistics dashboard and recent activity
- **Conversations**: Complete conversation history with message viewer
- **Analytics**: Detailed usage metrics and cost tracking
- **Settings**: Account management and privacy controls

#### **Overview Tab** (`UserProfile.tsx`)
- **Statistics Cards**: Live metrics display
  - Total conversations count
  - Total messages exchanged
  - Token usage tracking
  - Efficiency metrics (avg tokens per request)
- **Recent Activity Feed**: Latest 5 conversations with click-to-view
- **Model Badges**: Visual indicators for GPT-4o vs GPT-4o Mini usage
- **Real-time Data**: Updates based on actual user activity

#### **Conversations Tab**
- **Grid Layout**: Card-based conversation browser
- **Conversation Details**: Individual conversation viewer with full message history
- **Message Timeline**: Chronological message display with role indicators (User/Skye)
- **Metadata Display**: Timestamps, token counts, session duration
- **Model Tracking**: Shows which AI model was used per conversation

#### **Analytics Tab**
- **Usage Breakdown**: Comprehensive statistics
  - Total conversations, messages, tokens
  - Estimated costs and pricing breakdowns
  - Efficiency metrics and averages
- **Timeline Information**: First/last activity tracking
- **Cost Analysis**: Real-time cost calculation based on model usage

#### **Settings Tab**
- **Account Information**: Display name, email, tier status
- **Tier Management**: Current tier display with upgrade options
- **Privacy Controls**: Data management and deletion requests
- **Account Actions**: Contact-based account management

### Backend Implementation

#### **User-Specific API Endpoints** (`realtime-server.js`)
```javascript
// Non-admin endpoints for user data access
GET /user/profile              // Complete user profile data
GET /user/conversations        // User's conversation history
GET /user/conversations/:id    // Specific conversation messages
```

#### **Data Sources Integration**
- **Firebase Auth**: User account information and tier determination
- **Firestore Analytics**: Token usage, cost tracking, and session data
- **Conversation Storage**: User-organized conversation and message collections
- **Real-time Limits**: Current usage limits and active session tracking

#### **Security Model**
- **Firebase ID Token Validation**: All endpoints require valid authentication
- **User-Scoped Access**: Users can only access their own data
- **Proper Error Handling**: Graceful degradation with informative messages

### Database Schema

#### **User Profile Data Structure**
```javascript
// User profile endpoint response
{
  profile: {
    user: {
      uid: string,
      email: string,
      displayName: string,
      tier: 'free' | 'premium',
      creationTime: timestamp,
      lastSignInTime: timestamp
    },
    analytics: {
      totalTokens: number,
      totalRequests: number,
      totalCost: number,
      avgTokensPerRequest: number,
      firstRequest: timestamp,
      lastRequest: timestamp
    },
    conversations: [
      {
        id: string,
        startTime: timestamp,
        endTime: timestamp,
        messageCount: number,
        totalTokens: number,
        model: string,
        tier: string,
        status: 'completed'
      }
    ],
    limits: {
      tierLimits: object,
      currentUsage: object,
      activeSessions: number
    }
  }
}
```

#### **Conversation Message Structure**
```javascript
// Individual conversation messages
{
  conversation: {
    id: string,
    startTime: timestamp,
    messageCount: number,
    model: string
  },
  messages: [
    {
      id: string,
      role: 'user' | 'assistant',
      content: string,
      timestamp: timestamp,
      tokens: { input: number, output: number }
    }
  ]
}
```

### Frontend Integration

#### **Navigation System** (`App.tsx`)
- **Profile Button**: Available in header and welcome section
- **State Management**: Clean routing between main interface and profile
- **Authentication Integration**: Profile only accessible to logged-in users

#### **Real-time Data Processing**
- **Dynamic Calculations**: Frontend calculates totals from conversation arrays
- **Live Updates**: Profile data refreshes on each visit
- **Error Handling**: Comprehensive error states and loading indicators

#### **Responsive Design** (`index.css`)
- **Card-based Layout**: Modern, clean interface design
- **Grid Systems**: Responsive layouts for different screen sizes
- **Interactive Elements**: Hover effects, smooth transitions
- **Consistent Styling**: Matches existing application design system

### Key Implementation Features

1. **Comprehensive Data Display**: Shows all aspects of user activity
2. **Real-time Analytics**: Live calculation of usage metrics
3. **Conversation Deep-dive**: Full message history with detailed metadata
4. **Tier Integration**: Seamless integration with tier-based restrictions
5. **User-Friendly Navigation**: Intuitive tab-based interface
6. **Security-First Design**: Proper authentication and data scoping
7. **Performance Optimized**: Efficient data loading and processing

## Tech Stack

- **Frontend**: React, WebRTC, Firebase Auth
- **Backend**: Node.js or Python, Firebase Admin SDK, WebSocket
- **Memory**: Zep Cloud
- **RAG**: Qdrant Cloud
- **AI Model**: GPT-4o-mini-realtime-preview
- **Usage Tracking**: Firestore analytics with real-time limits
- **User Profiles**: Comprehensive analytics and conversation management