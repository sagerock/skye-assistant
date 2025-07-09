# Admin Panel Setup Guide

## Current Issue
Your admin panel endpoints exist and are working, but authentication is failing due to missing environment variables.

## Step 1: Set Up Environment Variables

1. **Create `.env` file** in the `backend/` directory:
   ```bash
   cd backend
   cp .env.template .env
   ```

2. **Get Firebase Service Account Key**:
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Select your project
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Download the JSON file
   - Copy the entire JSON content and paste it as one line in your `.env` file

3. **Add your OpenAI API Key**:
   - Get from [OpenAI Platform](https://platform.openai.com/api-keys)
   - Add to OPENAI_API_KEY in `.env`

4. **Add Zep API Key** (optional):
   - Get from [Zep Cloud](https://www.getzep.com)
   - Add to ZEP_API_KEY in `.env`

## Step 2: Configure Admin Users

Add your email to the admin users list in `backend/src/realtime-server.js`:

```javascript
// Find this section around line 42:
const ADMIN_USERS = new Set([
  'sage@sagerock.com',  // <- This is currently the only admin
  'your-email@domain.com'  // <- Add your email here
]);
```

## Step 3: Restart Server

```bash
cd backend
# Kill existing server
pkill -f "realtime-server"
# Start with new config
node src/realtime-server.js
```

## Step 4: Test Admin Access

1. Open your app: http://localhost:5173
2. Sign in with your admin email
3. The admin panel should now be accessible

## Troubleshooting

### "Admin authentication required" error
- Check that your email is in ADMIN_USERS set
- Verify you're signed in with the correct email
- Check browser console for authentication errors

### "Internal server error" 
- Check that FIREBASE_SERVICE_ACCOUNT_KEY is valid JSON
- Ensure the service account has proper permissions
- Check server logs for specific error messages

### Data not loading
- Verify Firestore has proper indexes
- Check that conversation data exists in Firestore
- Run the diagnostic: `node debug-admin.js`

## Current Admin Email
Based on the code, the current admin email is: `sage@sagerock.com`

If this is your email, you just need to set up the environment variables and restart the server.

## Firebase Data Structure

Your app uses this Firestore structure:
```
users/{userId}/conversations/{conversationId}
users/{userId}/messages/{messageId}
analytics/token_usage/events/{eventId}
analytics/token_usage/users/{userId}
analytics/token_usage/global/totals
```

Make sure your Firebase rules allow admin access to these collections. 