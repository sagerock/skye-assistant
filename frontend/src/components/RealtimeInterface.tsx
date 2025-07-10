import { useEffect, useRef, useState } from 'react';
import { auth } from '../firebase'; // Corrected import path

// Define a type for the message objects
type Message = {
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
};

const RealtimeInterface = () => {
  const [status, setStatus] = useState('Connecting to server...');
  const [statusClass, setStatusClass] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { type: 'system', content: 'Ready to talk? Press "Begin" when you want to start.', timestamp: new Date().toLocaleTimeString() }
  ]);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [userTier, setUserTier] = useState<string>('free');
  const [tierLimits, setTierLimits] = useState<any>(null);
  
  // New audio management states
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [conversationMode, setConversationMode] = useState<'continuous' | 'push-to-talk'>('continuous');
  
  const ws = useRef<WebSocket | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const connectionInitialized = useRef<boolean>(false);
  const analyser = useRef<AnalyserNode | null>(null);
  const vadThreshold = useRef<number>(0.01); // Voice activity detection threshold
  const silenceTimeout = useRef<NodeJS.Timeout | null>(null);
  let nextStartTime = 0;

  const addMessage = (type: Message['type'], content: string) => {
    setMessages(prev => [...prev, { type, content, timestamp: new Date().toLocaleTimeString() }]);
  };

  const playAudio = (audioData: string) => {
    if (!audioContext.current) {
      audioContext.current = new AudioContext({ sampleRate: 24000 });
      nextStartTime = audioContext.current.currentTime;
    }

    const binaryString = atob(audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const samples = bytes.length / 2;
    const audioBuffer = audioContext.current.createBuffer(1, samples, 24000);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < samples; i++) {
      const byte1 = bytes[i * 2];
      const byte2 = bytes[i * 2 + 1];
      const sample = (byte2 << 8) | byte1;
      const signed = sample > 32767 ? sample - 65536 : sample;
      channelData[i] = signed / 32768;
    }
    
    const source = audioContext.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.current.destination);
    
    const playTime = Math.max(audioContext.current.currentTime, nextStartTime);
    source.start(playTime);
    nextStartTime = playTime + audioBuffer.duration;
    
    // Track AI speaking state
    setIsAISpeaking(true);
    setStatus('🤖 Skye is speaking...');
    
    // Clear any existing timeout and set new one
    const timeoutDuration = audioBuffer.duration * 1000 + 100; // Add small buffer
    setTimeout(() => {
      setIsAISpeaking(false);
      setStatus('💬 Your turn to speak');
    }, timeoutDuration);
  };

  // Voice Activity Detection function
  const analyzeAudioLevel = (inputBuffer: Float32Array) => {
    // Calculate RMS (Root Mean Square) for audio level
    let sum = 0;
    for (let i = 0; i < inputBuffer.length; i++) {
      sum += inputBuffer[i] * inputBuffer[i];
    }
    const rms = Math.sqrt(sum / inputBuffer.length);
    
    setAudioLevel(rms);
    
    const isCurrentlySpeaking = rms > vadThreshold.current;
    
    if (isCurrentlySpeaking !== isUserSpeaking) {
      setIsUserSpeaking(isCurrentlySpeaking);
      
      if (isCurrentlySpeaking) {
        // User started speaking
        setStatus('🎤 You are speaking...');
        
        // If AI is speaking and user interrupts, stop AI
        if (isAISpeaking) {
          console.log('User interrupted AI');
          // Could send interrupt signal to backend here
        }
        
        // Clear silence timeout
        if (silenceTimeout.current) {
          clearTimeout(silenceTimeout.current);
          silenceTimeout.current = null;
        }
      } else {
        // User stopped speaking - start silence timer
        silenceTimeout.current = setTimeout(() => {
          setStatus('💭 Listening for your voice...');
        }, 1000); // 1 second of silence before showing "listening"
      }
    }
    
    // For now, let's always send audio to ensure OpenAI gets continuous stream
    // We'll improve this later once we confirm OpenAI is working
    return true; // Always return true for now to send all audio
  };

  useEffect(() => {
    // Prevent duplicate connections (React.StrictMode can cause double mounting)
    if (connectionInitialized.current) {
      console.log('Connection already initialized, skipping duplicate setup');
      return;
    }
    
    // This effect runs once to set up the WebSocket connection and enumerate media devices.
    const user = auth.currentUser;
            if (!user) {
      setStatus('Please sign in to start.');
      return;
    }

    console.log('Setting up WebSocket connection for user:', user.email);
    connectionInitialized.current = true; // Mark as initialized

    // Get media devices
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
      setAudioInputDevices(audioInputs);
      setAudioOutputDevices(audioOutputs);
    });
    
    // WebSocket setup
    const connect = () => {
      user.getIdToken().then(idToken => {
        const socket = new WebSocket(`ws://localhost:3001`);
        ws.current = socket;

        socket.onopen = () => {
          // Send authentication message immediately after connection
          socket.send(JSON.stringify({
            type: 'auth',
            token: idToken
          }));
        };

        socket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          console.log('WS Message:', data);

          if (data.type === 'welcome') {
            setStatus('Connecting...');
          } else if (data.type === 'auth_success') {
            setStatus('Connected and ready.');
            setStatusClass('connected');
            addMessage('system', data.message);
            if (data.tier) {
              setUserTier(data.tier);
              const tierMessage = data.tier === 'premium' 
                ? `You have ${data.tier} access - enhanced conversations enabled.`
                : `You have ${data.tier} access. Upgrade to premium for longer sessions and advanced features.`;
              addMessage('system', tierMessage);
            }
            if (data.limits) {
              setTierLimits(data.limits);
            }
          } else if (data.type === 'auth_error') {
            setStatus('Connection failed. Please try again.');
            setStatusClass('error');
            addMessage('system', `Connection issue: ${data.message}`);
          } else if (data.type === 'session_started') {
            addMessage('system', data.message);
            if (data.tier && data.model) {
              const modelName = data.model.includes('gpt-4o-mini') ? 'GPT-4o Mini' : 'GPT-4o';
              addMessage('system', `Using ${modelName} for our conversation`);
            }
            setStatus('Connected. Start talking.');
            setStatusClass('active');
          } else if (data.type === 'speech_started') {
            setStatus('Listening...');
          } else if (data.type === 'speech_stopped') {
            setStatus('Processing...');
          } else if (data.type === 'transcription') {
            addMessage('user', data.text);
          } else if (data.type === 'audio_response') {
            playAudio(data.audio_data);
          } else if (data.type === 'text_response') {
            // Update the last assistant message with new text
            setMessages(prev => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.type === 'assistant') {
                return [...prev.slice(0, -1), { ...lastMsg, content: lastMsg.content + data.text }];
              }
              return [...prev, { type: 'assistant', content: data.text, timestamp: new Date().toLocaleTimeString() }];
            });
          } else if (data.type === 'response_complete') {
            setStatus('Connected. Start talking.');
          } else if (data.type === 'session_ended') {
            addMessage('system', data.message);
            setStatus('Session ended.');
            setStatusClass('');
          } else if (data.type === 'session_terminated') {
            addMessage('system', `Session terminated: ${data.message}`);
            if (data.reason === 'duration_limit') {
              addMessage('system', userTier === 'premium' 
                ? 'Consider taking a break and starting a new session.' 
                : 'Upgrade to premium for longer session durations.');
            }
            setStatus('Session ended due to limits.');
            setStatusClass('error');
            setIsSessionActive(false);
          } else if (data.type === 'error') {
            if (data.reason === 'concurrent_limit' || data.reason === 'daily_limit' || data.reason === 'hourly_limit' || data.reason === 'token_limit') {
              addMessage('system', `Limit reached: ${data.message}`);
              if (data.tier && data.limits) {
                const limits = data.limits;
                if (data.tier === 'free') {
                  addMessage('system', `Free tier limits: ${limits.sessionsPerDay} sessions/day, ${limits.sessionsPerHour} sessions/hour, ${Math.round(limits.maxSessionDuration/60000)} min/session`);
                  addMessage('system', 'Upgrade to premium for higher limits and longer sessions.');
                } else {
                  addMessage('system', `Premium limits: ${limits.sessionsPerDay} sessions/day, ${limits.sessionsPerHour} sessions/hour, ${Math.round(limits.maxSessionDuration/60000)} min/session`);
                }
              }
              setStatus('Limit reached. Try again later or upgrade.');
              setStatusClass('error');
            } else {
              addMessage('system', `Error: ${data.message}`);
            }
          } else {
            // Log unknown message types for debugging but don't show error to user
            console.log('Unknown message type from server:', data.type, data);
          }
        };

        socket.onclose = () => {
          setStatus('Connection closed. Press "Begin" to reconnect.');
          setStatusClass('error');
        };

        socket.onerror = (error) => {
          console.error('WebSocket Error:', error);
          setStatus('Connection error. Please try again.');
          setStatusClass('error');
        };
      });
    };

    connect();

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up WebSocket connection');
      connectionInitialized.current = false; // Reset connection guard
      if (ws.current) {
        ws.current.close();
      }
      if ((window as any).audioContext) {
        (window as any).audioContext.close();
      }
      if ((window as any).audioProcessor) {
        (window as any).audioProcessor.disconnect();
      }
    };
  }, []);

  const handleStartSession = async () => {
    if (ws.current?.readyState !== WebSocket.OPEN) {
      addMessage('system', 'Connection not ready. Please wait.');
      return;
    }

    // Double-check authentication
    const user = auth.currentUser;
    if (!user) {
      addMessage('system', 'Please sign in first.');
      return;
    }
    
    addMessage('system', 'Starting session...');
    setIsSessionActive(true);
    setStatus('Starting...');
    setStatusClass('active');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      // Create AudioContext for proper PCM16 conversion and analysis
      const audioContext = new AudioContext({ sampleRate: 24000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      // Create analyser for voice activity detection
      const audioAnalyser = audioContext.createAnalyser();
      audioAnalyser.fftSize = 256;
      source.connect(audioAnalyser);
      analyser.current = audioAnalyser;
      
      processor.onaudioprocess = (event) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
          const inputBuffer = event.inputBuffer.getChannelData(0);
          
          // Perform voice activity detection
          const isSpeaking = analyzeAudioLevel(inputBuffer);
          
          // Send all audio for now (we'll optimize later once OpenAI is working)
          if (conversationMode === 'continuous') {
            // Convert float32 to PCM16
            const pcm16Buffer = new Int16Array(inputBuffer.length);
            for (let i = 0; i < inputBuffer.length; i++) {
              pcm16Buffer[i] = Math.max(-32768, Math.min(32767, inputBuffer[i] * 32767));
            }
            
            // Convert to base64
            const uint8Array = new Uint8Array(pcm16Buffer.buffer);
            const base64 = btoa(String.fromCharCode(...uint8Array));
            
            ws.current?.send(JSON.stringify({ 
              type: 'audio_data', 
              audio: base64 
            }));
          }
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      // Store for cleanup
      (window as any).audioContext = audioContext;
      (window as any).audioProcessor = processor;

      // Get voice preference
      const voiceSelect = document.getElementById('voice-select') as HTMLSelectElement;
      const voice = voiceSelect?.value || 'sage';
      
      ws.current.send(JSON.stringify({ 
        type: 'start_session',
        voice: voice
      }));
    } catch (error) {
      addMessage('system', `Microphone access required. Please allow and try again.`);
      setIsSessionActive(false);
      setStatus('Microphone access needed.');
      setStatusClass('error');
    }
  };

  const handleStopSession = () => {
    // Clean up audio context and processor
    if ((window as any).audioContext) {
      (window as any).audioContext.close();
      (window as any).audioContext = null;
    }
    if ((window as any).audioProcessor) {
      (window as any).audioProcessor.disconnect();
      (window as any).audioProcessor = null;
    }
    
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'stop_session' }));
    }
    
    addMessage('system', 'Session ended.');
    setIsSessionActive(false);
    setStatus('Press "Begin" to start again.');
    setStatusClass('');
  };

  // The JSX remains largely the same, but will be wired up to the new state and handlers.
  // ... existing JSX ...
  
  return (
    <div>
      <div className={`status ${statusClass}`} id="status">
        {status}
      </div>

      {/* Voice Activity Indicators */}
      {isSessionActive && (
        <div className="voice-activity-container">
          <div className="conversation-state">
            <div className={`voice-indicator ${isUserSpeaking ? 'active' : ''}`}>
              <span className="indicator-label">You</span>
              <div className="voice-level" style={{ width: `${Math.min(audioLevel * 1000, 100)}%` }}></div>
            </div>
            <div className={`voice-indicator ${isAISpeaking ? 'active' : ''}`}>
              <span className="indicator-label">Skye</span>
              <div className="voice-level ai-level" style={{ width: `${isAISpeaking ? 100 : 0}%` }}></div>
            </div>
          </div>
          
          <div className="conversation-tips">
            {isAISpeaking && (
              <div className="tip">💡 You can interrupt Skye by speaking</div>
            )}
            {!isUserSpeaking && !isAISpeaking && conversationMode === 'continuous' && (
              <div className="tip">💬 Just start speaking naturally</div>
            )}
          </div>
        </div>
      )}

      <div className="conversation-container">
        <div className="conversation" id="conversation">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.type}`}>
              <div className="timestamp">{msg.timestamp}</div>
              {msg.content}
            </div>
          ))}
        </div>
      </div>

      {/* Tier Information Display */}
      <div className="tier-info">
        <div className={`tier-badge ${userTier}`}>
          <span className="tier-label">{userTier.toUpperCase()}</span>
          {userTier === 'free' && (
            <button className="upgrade-btn" onClick={() => window.open('mailto:contact@skye.ai?subject=Premium Upgrade', '_blank')}>
              Upgrade
            </button>
          )}
        </div>
        {tierLimits && (
          <div className="tier-limits">
            <span>{tierLimits.sessionsPerDay} sessions/day</span>
            <span>{tierLimits.sessionsPerHour} sessions/hour</span>
            <span>{Math.round(tierLimits.maxSessionDuration / 60000)} min/session</span>
            {userTier === 'premium' && <span>Advanced features enabled</span>}
          </div>
        )}
      </div>

      <div className="controls">
        <div className="realtime-controls">
          <button 
            className={`main-button start ${isSessionActive ? 'hidden' : ''}`} 
            onClick={handleStartSession}
          >
            Begin
          </button>
          <button 
            className={`main-button stop ${!isSessionActive ? 'hidden' : ''}`} 
            onClick={handleStopSession}
          >
            End Gracefully
          </button>
        </div>
        <div className="audio-device-selector">
          <label htmlFor="audio-input-select">Audio Input:</label>
          <select id="audio-input-select">
            {audioInputDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
            ))}
          </select>
          <label htmlFor="audio-output-select">Audio Output:</label>
          <select id="audio-output-select">
            {audioOutputDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
            ))}
          </select>
        </div>
        <div className="settings">
          <h3>Preferences</h3>
          
          <div className="setting-group">
            <label htmlFor="voice-select">Skye's Voice:</label>
            <select id="voice-select" defaultValue="shimmer">
              <option value="shimmer">Shimmer (Recommended)</option>
              <option value="sage">Sage</option>
              <option value="coral">Coral</option>
              <option value="alloy">Alloy</option>
              <option value="ash">Ash</option>
              <option value="ballad">Ballad</option>
              <option value="echo">Echo</option>
              <option value="verse">Verse</option>
            </select>
          </div>

          <div className="setting-group">
            <label>Conversation Mode:</label>
            <div className="mode-toggle">
              <button 
                className={`mode-btn ${conversationMode === 'continuous' ? 'active' : ''}`}
                onClick={() => setConversationMode('continuous')}
              >
                🎤 Smart Voice Detection
              </button>
              <button 
                className={`mode-btn ${conversationMode === 'push-to-talk' ? 'active' : ''}`}
                onClick={() => setConversationMode('push-to-talk')}
              >
                🔘 Push to Talk (Coming Soon)
              </button>
            </div>
            <div className="mode-description">
              {conversationMode === 'continuous' 
                ? "AI detects when you speak and manages turn-taking automatically" 
                : "Hold a button while speaking (feature coming soon)"}
            </div>
          </div>

          <div className="setting-group">
            <label htmlFor="voice-sensitivity">Voice Sensitivity:</label>
            <input 
              type="range" 
              id="voice-sensitivity"
              min="0.001" 
              max="0.1" 
              step="0.001"
              value={vadThreshold.current}
              onChange={(e) => {
                vadThreshold.current = parseFloat(e.target.value);
              }}
            />
            <div className="sensitivity-labels">
              <span>Sensitive</span>
              <span>Normal</span>
              <span>Less Sensitive</span>
            </div>
          </div>

          {isSessionActive && (
            <div className="setting-group">
              <label>Current Audio Level:</label>
              <div className="audio-level-display">
                <div className="level-bar">
                  <div 
                    className="level-fill" 
                    style={{ width: `${Math.min(audioLevel * 1000, 100)}%` }}
                  ></div>
                </div>
                <span className="level-text">{(audioLevel * 1000).toFixed(1)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>


    </div>
  );
};

export default RealtimeInterface; 