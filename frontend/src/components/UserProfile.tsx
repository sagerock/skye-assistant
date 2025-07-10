import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';

interface Conversation {
  id: string;
  title?: string;
  startTime: any;
  endTime?: any;
  messageCount: number;
  totalTokens?: number;
  model: string;
  tier: string;
  status?: string;
}

interface UserStats {
  totalConversations: number;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  avgTokensPerRequest: number;
  avgCostPerToken: number;
  firstRequest: string;
  lastRequest: string;
}

interface UserProfileProps {
  user: User;
  onBack: () => void;
}

const UserProfile = ({ user, onBack }: UserProfileProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'conversations' | 'analytics' | 'settings'>('overview');
  const [userTier, setUserTier] = useState<'free' | 'premium'>('free');

  useEffect(() => {
    loadUserProfile();
  }, [user]);

  const loadUserProfile = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      console.log('🔍 Loading user profile for:', user.email);
      
      // Get user profile data using new user-specific endpoint
      const profileResponse = await fetch(`http://localhost:3001/user/profile`, {
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`
        }
      });
      
      console.log('📊 Profile response status:', profileResponse.status);
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        console.log('📊 Profile data received:', profileData);
        
        if (profileData.profile) {
          const profile = profileData.profile;
          
          console.log('📊 Raw conversations data:', profile.conversations);
          console.log('📊 First conversation sample:', JSON.stringify(profile.conversations?.[0], null, 2));
          
          setUserTier(profile.user.tier);
          setUserStats({
            ...profile.analytics,
            totalConversations: profile.conversations?.length || 0,
            totalMessages: profile.conversations?.reduce((sum: number, conv: any) => sum + (conv.messageCount || 0), 0) || 0
          });
          setConversations(profile.conversations || []);
          
          console.log('✅ Profile data loaded:', {
            tier: profile.user.tier,
            conversations: profile.conversations?.length || 0,
            totalMessages: profile.conversations?.reduce((sum: number, conv: any) => sum + (conv.messageCount || 0), 0) || 0,
            analytics: profile.analytics,
            conversationsArray: profile.conversations
          });
        } else {
          console.warn('⚠️ No profile data in response');
        }
      } else {
        const errorText = await profileResponse.text();
        console.error('❌ Profile request failed:', profileResponse.status, errorText);
      }
      
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    if (!user) return;
    
    try {
      const response = await fetch(`http://localhost:3001/user/conversations/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConversationMessages(data.messages || []);
        setSelectedConversation(conversationId);
      } else {
        console.error(`Failed to load messages: ${response.status}`);
      }
    } catch (error) {
      console.error('Error loading conversation messages:', error);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    
    let date;
    try {
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        // Firestore Timestamp object
        date = timestamp.toDate();
      } else if (timestamp._seconds) {
        // Firestore Timestamp-like object
        date = new Date(timestamp._seconds * 1000);
      } else if (timestamp.seconds) {
        // Alternative Firestore timestamp format
        date = new Date(timestamp.seconds * 1000);
      } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
        // Regular date string or number
        date = new Date(timestamp);
      } else {
        // Unknown format, try to convert
        date = new Date(timestamp);
      }
      
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Error formatting date:', error, timestamp);
      return 'Date Error';
    }
  };

  const formatDuration = (startTime: any, endTime: any) => {
    if (!startTime || !endTime) return 'Unknown';
    
    let start, end;
    try {
      if (startTime.toDate && typeof startTime.toDate === 'function') {
        start = startTime.toDate();
        end = endTime.toDate();
      } else if (startTime._seconds) {
        start = new Date(startTime._seconds * 1000);
        end = new Date(endTime._seconds * 1000);
      } else if (startTime.seconds) {
        start = new Date(startTime.seconds * 1000);
        end = new Date(endTime.seconds * 1000);
      } else {
        start = new Date(startTime);
        end = new Date(endTime);
      }
      
      const duration = Math.round((end.getTime() - start.getTime()) / 60000); // minutes
      return duration > 0 ? `${duration} min` : '< 1 min';
    } catch (error) {
      console.error('Error formatting duration:', error, startTime, endTime);
      return 'Duration Error';
    }
  };

  const getTierBadgeClass = (tier: string) => {
    return tier === 'premium' ? 'tier-badge premium' : 'tier-badge free';
  };

  if (loading) {
    return (
      <div className="user-profile">
        <div className="profile-header">
          <button className="back-button" onClick={onBack}>← Back</button>
          <h2>Loading Profile...</h2>
        </div>
        <div className="loading">Loading your profile data...</div>
      </div>
    );
  }

  return (
    <div className="user-profile">
      {/* Profile Header */}
      <div className="profile-header">
        <button className="back-button" onClick={onBack}>← Back</button>
        <div className="profile-info">
          <div className="user-avatar">
            {(user.displayName || user.email || 'U')[0].toUpperCase()}
          </div>
          <div className="user-details">
            <h2>{user.displayName || 'User'}</h2>
            <p className="user-email">{user.email}</p>
            <div className={getTierBadgeClass(userTier)}>
              <span className="tier-label">{userTier.toUpperCase()}</span>
              {userTier === 'free' && (
                <button className="upgrade-btn" onClick={() => window.open('mailto:contact@skye.ai?subject=Premium Upgrade', '_blank')}>
                  Upgrade
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="profile-tabs">
        <button 
          className={activeTab === 'overview' ? 'tab active' : 'tab'} 
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={activeTab === 'conversations' ? 'tab active' : 'tab'} 
          onClick={() => setActiveTab('conversations')}
        >
          Conversations
        </button>
        <button 
          className={activeTab === 'analytics' ? 'tab active' : 'tab'} 
          onClick={() => setActiveTab('analytics')}
        >
          Analytics
        </button>
        <button 
          className={activeTab === 'settings' ? 'tab active' : 'tab'} 
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      {/* Tab Content */}
      <div className="profile-content">
        
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Conversations</h3>
                <div className="stat-value">{userStats?.totalConversations || 0}</div>
                <p>Total conversations</p>
              </div>
              <div className="stat-card">
                <h3>Messages</h3>
                <div className="stat-value">{userStats?.totalMessages || 0}</div>
                <p>Messages exchanged</p>
              </div>
              <div className="stat-card">
                <h3>Usage</h3>
                <div className="stat-value">{userStats?.totalTokens || 0}</div>
                <p>Total tokens used</p>
              </div>
              <div className="stat-card">
                <h3>Efficiency</h3>
                <div className="stat-value">{userStats?.avgTokensPerRequest || 0}</div>
                <p>Avg tokens per request</p>
              </div>
            </div>

          </div>
        )}

        {/* Conversations Tab */}
        {activeTab === 'conversations' && (
          <div className="conversations-tab">
            {selectedConversation ? (
              <div className="conversation-detail">
                <div className="conversation-header">
                  <button className="back-to-list" onClick={() => setSelectedConversation(null)}>
                    ← Back to Conversations
                  </button>
                  <h3>Conversation Details</h3>
                </div>
                <div className="messages-container">
                  {conversationMessages.length === 0 ? (
                    <div className="no-messages">
                      No messages found for this conversation
                    </div>
                  ) : (
                    conversationMessages.map((message, index) => (
                      <div key={index} className={`message ${message.role}`}>
                        <div className="message-header">
                          <span className="role">{message.role === 'user' ? 'You' : 'Skye'}</span>
                          <span className="timestamp">{formatDate(message.timestamp)}</span>
                        </div>
                        <div className="message-content">{message.content}</div>
                        {message.tokens && (
                          <div className="message-tokens">
                            Tokens: {(message.tokens.input || 0) + (message.tokens.output || 0)}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="conversations-list">
                <h3>All Conversations ({conversations.length})</h3>
                {conversations.length === 0 ? (
                  <p>No conversations found. Start a conversation to see it here!</p>
                ) : (
                  <div className="conversations-grid">
                    {conversations.map((conv, index) => (
                      <div key={conv.id} className="conversation-card" onClick={() => loadConversationMessages(conv.id)}>
                        <div className="conversation-info">
                          <h4>{conv.title || conv.metadata?.title || `Conversation ${index + 1}`}</h4>
                          <p className="conversation-date">{formatDate(conv.startTime)}</p>
                          <div className="conversation-stats">
                            <span>{conv.messageCount || 0} messages</span>
                            {conv.totalTokens && <span>• {conv.totalTokens} tokens</span>}
                            {conv.startTime && conv.endTime && (
                              <span>• {formatDuration(conv.startTime, conv.endTime)}</span>
                            )}
                          </div>
                        </div>
                        <div className="conversation-meta">
                          <span className={`model-badge ${conv.model?.includes('gpt-4o-mini') ? 'mini' : 'standard'}`}>
                            {conv.model?.includes('gpt-4o-mini') ? 'Mini' : 'GPT-4o'}
                          </span>
                          <span className={`status-badge ${conv.status || 'completed'}`}>
                            {conv.status || 'completed'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="analytics-tab">
            <div className="analytics-section">
              <h3>Usage Analytics</h3>
              {userStats ? (
                <div className="analytics-grid">
                  <div className="analytics-card">
                    <h4>Total Usage</h4>
                    <div className="usage-breakdown">
                      <div className="usage-item">
                        <span>Conversations:</span>
                        <span>{userStats.totalConversations}</span>
                      </div>
                      <div className="usage-item">
                        <span>Messages:</span>
                        <span>{userStats.totalMessages}</span>
                      </div>
                      <div className="usage-item">
                        <span>Tokens:</span>
                        <span>{userStats.totalTokens.toLocaleString()}</span>
                      </div>
                      <div className="usage-item">
                        <span>Estimated Cost:</span>
                        <span>${userStats.totalCost?.toFixed(4) || '0.0000'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="analytics-card">
                    <h4>Efficiency Metrics</h4>
                    <div className="efficiency-metrics">
                      <div className="metric">
                        <span>Avg Tokens/Request:</span>
                        <span>{Math.round(userStats.avgTokensPerRequest || 0)}</span>
                      </div>
                      <div className="metric">
                        <span>Avg Cost/Token:</span>
                        <span>${(userStats.avgCostPerToken || 0).toFixed(6)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="analytics-card">
                    <h4>Timeline</h4>
                    <div className="timeline-info">
                      <div className="timeline-item">
                        <span>First Activity:</span>
                        <span>{userStats.firstRequest ? new Date(userStats.firstRequest).toLocaleDateString() : 'Unknown'}</span>
                      </div>
                      <div className="timeline-item">
                        <span>Last Activity:</span>
                        <span>{userStats.lastRequest ? new Date(userStats.lastRequest).toLocaleDateString() : 'Unknown'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p>No analytics data available yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="settings-tab">
            <div className="settings-section">
              <h3>Account Settings</h3>
              <div className="setting-item">
                <label>Display Name</label>
                <input type="text" value={user.displayName || ''} disabled />
                <p className="setting-note">Contact support to change your display name</p>
              </div>
              <div className="setting-item">
                <label>Email</label>
                <input type="email" value={user.email || ''} disabled />
                <p className="setting-note">Email changes require verification</p>
              </div>
              <div className="setting-item">
                <label>Account Tier</label>
                <div className="tier-display">
                  <span className={getTierBadgeClass(userTier)}>
                    <span className="tier-label">{userTier.toUpperCase()}</span>
                  </span>
                  {userTier === 'free' && (
                    <button className="upgrade-btn" onClick={() => window.open('mailto:contact@skye.ai?subject=Premium Upgrade', '_blank')}>
                      Upgrade to Premium
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h3>Privacy & Data</h3>
              <div className="setting-item">
                <label>Data Retention</label>
                <p>Your conversations are stored securely and used to improve your experience.</p>
                <button className="danger-button" onClick={() => window.open('mailto:contact@skye.ai?subject=Data Deletion Request', '_blank')}>
                  Request Data Deletion
                </button>
              </div>
            </div>

            <div className="settings-section">
              <h3>Danger Zone</h3>
              <div className="setting-item danger">
                <label>Delete Account</label>
                <p>Permanently delete your account and all associated data.</p>
                <button className="danger-button" onClick={() => window.open('mailto:contact@skye.ai?subject=Account Deletion Request', '_blank')}>
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default UserProfile;