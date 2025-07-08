# 🎤 Skye Assistant Voice Configuration Notes

## Available Voices (OpenAI Realtime API)

Based on OpenAI's current Realtime API, the supported voices are:

### **Female Voices:**
- **`shimmer`** - Soft, gentle female voice
- **`coral`** - (Likely female - needs testing)
- **`sage`** - (Gender unclear - needs testing)

### **Male Voices:**
- **`alloy`** - Neutral, balanced tone (could be male/neutral)
- **`echo`** - Male voice, calm and measured
- **`verse`** - (Previously used - likely male)

### **Unknown Gender (Need Testing):**
- **`ash`** - New voice, characteristics unknown
- **`ballad`** - New voice, characteristics unknown

## Current Configuration

- **Active Voice**: `shimmer` (soft female voice)
- **Audio Format**: PCM16 at 24kHz sample rate
- **Server Port**: 3001
- **Frontend URL**: `http://localhost:5173/skye-realtime.html`

## Key Technical Details

### Audio Processing
- **Input**: Microphone → 24kHz PCM16 → OpenAI
- **Output**: OpenAI 24kHz → Resampled to browser rate (44.1/48kHz)
- **Format**: PCM 16-bit signed little-endian

### Voice Switching
To change voice:
1. Edit `backend/src/realtime-server.js`
2. Change `voice: 'shimmer'` to desired voice
3. Restart server: `cd backend && pkill -f realtime-server && node src/realtime-server.js`
4. Refresh browser page

### Server Commands
```bash
# Start realtime server
cd backend && node src/realtime-server.js

# Start frontend
cd frontend && npm run dev

# Stop realtime server
pkill -f realtime-server
```

## Voice Characteristics (Based on Testing)

✅ **Tested Voices:**
- **`alloy`** - Neutral, balanced - WORKS WELL
- **`shimmer`** - Soft, gentle female - CURRENT
- **`verse`** - Previous default - WORKS WELL

❓ **Need to Test:**
- `ash`, `ballad`, `coral`, `sage`, `echo`

## Recent Fixes Applied

1. **24kHz Audio Rate**: Fixed slow/low pitch by using proper 24kHz instead of 16kHz
2. **Proper Resampling**: Added linear interpolation for smooth audio conversion
3. **Browser Compatibility**: Works with all major browsers
4. **Real-time Performance**: Optimized for minimal latency

## Notes
- Voice quality is now excellent and matches OpenAI Playground
- All audio sample rate issues have been resolved
- System supports real-time conversation with natural speech detection
- Memory and RAG capabilities available but not yet implemented

---
*Last Updated: January 8, 2025* 