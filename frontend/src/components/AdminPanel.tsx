import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { getIdToken } from 'firebase/auth';

interface AdminUser {
  uid: string;
  email: string;
  displayName?: string;
  creationTime: string;
  lastSignInTime?: string;
  disabled: boolean;
  tier: 'free' | 'premium';
  isAdmin: boolean;
  isPremium: boolean;
}

interface AdminStats {
  users: {
    totalUsers: number;
    premiumUsers: number;
    freeUsers: number;
    adminUsers: number;
    activeUsers: number;
    recentSignups: number;
  };
  tokens: {
    totalTokens: number;
    totalRequests: number;
    uniqueUsers: number;
  };
}

interface SystemHealth {
  server: string;
  firebase: string;
  openai: string;
  zep: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  timestamp: string;
}

interface AdminPanelProps {
  user: User;
  onBack: () => void;
}

interface ModelPricing {
  [model: string]: {
    input: number;
    output: number;
    displayName?: string;
  };
}

interface UserDetail {
  user: AdminUser;
  analytics: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    totalRequests: number;
    totalCost: number;
    modelBreakdown: Array<{
      model: string;
      totalTokens: number;
      inputTokens: number;
      outputTokens: number;
      totalRequests: number;
      totalCost: number;
    }>;
    firstRequest: string;
    lastRequest: string;
    avgTokensPerRequest: number;
  };
  conversations: Array<{
    id: string;
    title: string;
    messageCount: number;
    tokenCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
  billing?: {
    subscriptionStatus: 'active' | 'inactive' | 'cancelled' | 'past_due';
    plan: 'free' | 'premium' | 'enterprise';
    nextBillingDate?: string;
    totalSpent: number;
    paymentMethod?: string;
  };
}

interface TokenUsage {
  global: {
    totalTokens: number;
    totalRequests: number;
    uniqueUsers: number;
    startTime: string;
    uptime: number;
  };
  topUsers: Array<{
    userId: string;
    email: string;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    totalRequests: number;
    firstRequest: string;
    lastRequest: string;
    modelBreakdown?: Array<{
      model: string;
      totalTokens: number;
      inputTokens: number;
      outputTokens: number;
      totalRequests: number;
      totalCost: number;
    }>;
  }>;
  modelBreakdown?: Array<{
    model: string;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    totalRequests: number;
    uniqueUsers: number;
    avgTokensPerRequest: number;
  }>;
  costs?: {
    totalCost: number;
    costByModel: Array<{
      model: string;
      totalCost: number;
      inputCost: number;
      outputCost: number;
      avgCostPerRequest: number;
    }>;
    costByUser: Array<{
      email: string;
      totalCost: number;
      avgCostPerRequest: number;
    }>;
    avgCostPerToken: number;
    avgCostPerRequest: number;
    avgCostPerUser: number;
  };
}

const AdminPanel: React.FC<AdminPanelProps> = ({ user, onBack }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'analytics' | 'pricing' | 'health'>('dashboard');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'analytics' | 'conversations' | 'billing' | 'support'>('overview');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    displayName: '',
    tier: 'free' as 'free' | 'premium'
  });
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [pricing, setPricing] = useState<ModelPricing | null>(null);
  const [editingPricing, setEditingPricing] = useState<ModelPricing | null>(null);
  const [showAddModel, setShowAddModel] = useState(false);
  const [newModel, setNewModel] = useState({
    model: '',
    displayName: '',
    input: 0.00015,
    output: 0.0006
  });

  const API_BASE = 'http://localhost:3001'; // Adjust based on your backend port

  const getAuthHeaders = async () => {
    const token = await getIdToken(user);
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const fetchUsers = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/admin/users`, { headers });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    }
  };

  const fetchStats = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/admin/stats`, { headers });
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    }
  };

  const fetchHealth = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/admin/health`, { headers });
      if (!response.ok) throw new Error('Failed to fetch health');
      const data = await response.json();
      setHealth(data.health);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health');
    }
  };

  const fetchTokenUsage = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/admin/usage`, { headers });
      if (!response.ok) throw new Error('Failed to fetch token usage');
      const data = await response.json();
      setTokenUsage(data.usage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch token usage');
    }
  };

  const fetchPricing = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/admin/pricing`, { headers });
      if (!response.ok) throw new Error('Failed to fetch pricing');
      const data = await response.json();
      setPricing(data.pricing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pricing');
    }
  };

  const updatePricing = async (newPricing: ModelPricing) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/admin/pricing`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ pricing: newPricing })
      });
      if (!response.ok) throw new Error('Failed to update pricing');
      
      setPricing(newPricing);
      setEditingPricing(null);
      // Refresh usage data to show updated costs
      await fetchTokenUsage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update pricing');
    }
  };

  const addNewModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricing) return;
    
    const updatedPricing = {
      ...pricing,
      [newModel.model]: {
        input: newModel.input,
        output: newModel.output,
        displayName: newModel.displayName || undefined
      }
    };
    
    await updatePricing(updatedPricing);
    setNewModel({ model: '', displayName: '', input: 0.00015, output: 0.0006 });
    setShowAddModel(false);
  };

  const fetchUserDetails = async (userId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/admin/users/${userId}/details`, { headers });
      if (!response.ok) throw new Error('Failed to fetch user details');
      const data = await response.json();
      setUserDetails(data.userDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user details');
    }
  };

  const viewUserDetails = async (user: AdminUser) => {
    setSelectedUser(user);
    await fetchUserDetails(user.uid);
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newUser)
      });
      if (!response.ok) throw new Error('Failed to create user');
      
      setNewUser({ email: '', password: '', displayName: '', tier: 'free' });
      setShowCreateUser(false);
      await fetchUsers();
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const updateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/admin/users/${editingUser.uid}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          email: editingUser.email,
          displayName: editingUser.displayName,
          tier: editingUser.tier,
          disabled: editingUser.disabled
        })
      });
      if (!response.ok) throw new Error('Failed to update user');
      
      setEditingUser(null);
      await fetchUsers();
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE',
        headers
      });
      if (!response.ok) throw new Error('Failed to delete user');
      
      await fetchUsers();
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchUsers(), fetchStats(), fetchHealth(), fetchTokenUsage(), fetchPricing()]);
      } catch (err) {
        setError('Failed to load admin data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatBytes = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const formatModelName = (model: string) => {
    const modelMap: { [key: string]: string } = {
      'gpt-4o-realtime-preview-2025-06-03': 'GPT-4o Realtime (Premium)',
      'gpt-4o-mini-realtime-preview-2024-12-17': 'GPT-4o Mini Realtime (Free)',
      'gpt-4.1-mini-2025-04-14': 'GPT-4.1 Mini (Deep Synthesis)',
      'gpt-4o-mini-2024-07-18': 'GPT-4o Mini (Lightweight)',
      'unknown': 'Unknown Model'
    };
    return modelMap[model] || model;
  };

  const toggleUserExpansion = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  if (loading) {
    return <div className="admin-loading">Loading admin panel...</div>;
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <div className="admin-title">
          <h1>Admin Panel</h1>
          <p>Welcome, {user.email}</p>
        </div>
      </div>

      <div className="admin-tabs">
        <button 
          className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button 
          className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Analytics
        </button>
        <button 
          className={`tab ${activeTab === 'pricing' ? 'active' : ''}`}
          onClick={() => setActiveTab('pricing')}
        >
          Pricing
        </button>
        <button 
          className={`tab ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => setActiveTab('health')}
        >
          System Health
        </button>
      </div>

      {error && (
        <div className="admin-error">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {activeTab === 'dashboard' && stats && (
        <div className="admin-dashboard">
          <h2>Dashboard Overview</h2>
          
          {/* User Statistics */}
          <div className="dashboard-section">
            <h3>User Statistics</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-number">{stats.users.totalUsers}</div>
                <div className="stat-label">Total Users</div>
              </div>
              <div className="stat-card premium">
                <div className="stat-number">{stats.users.premiumUsers}</div>
                <div className="stat-label">Premium Users</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.users.freeUsers}</div>
                <div className="stat-label">Free Users</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.users.activeUsers}</div>
                <div className="stat-label">Active (30 days)</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.users.recentSignups}</div>
                <div className="stat-label">Recent Signups (7 days)</div>
              </div>
              <div className="stat-card admin">
                <div className="stat-number">{stats.users.adminUsers}</div>
                <div className="stat-label">Admin Users</div>
              </div>
            </div>
          </div>



          {/* Token Usage Summary */}
          <div className="dashboard-section">
            <h3>Token Usage Summary</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-number">{stats.tokens.totalTokens.toLocaleString()}</div>
                <div className="stat-label">Total Tokens</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.tokens.totalRequests}</div>
                <div className="stat-label">Total Requests</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.tokens.uniqueUsers}</div>
                <div className="stat-label">Token Users</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="admin-users">
          <div className="users-header">
            <h2>User Management</h2>
            <button 
              className="create-user-button"
              onClick={() => setShowCreateUser(true)}
            >
              Create User
            </button>
          </div>

          {showCreateUser && (
            <div className="modal-overlay">
              <div className="modal">
                <h3>Create New User</h3>
                <form onSubmit={createUser}>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Display Name</label>
                    <input
                      type="text"
                      value={newUser.displayName}
                      onChange={(e) => setNewUser({...newUser, displayName: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Tier</label>
                    <select
                      value={newUser.tier}
                      onChange={(e) => setNewUser({...newUser, tier: e.target.value as 'free' | 'premium'})}
                    >
                      <option value="free">Free</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
                  <div className="modal-actions">
                    <button type="button" onClick={() => setShowCreateUser(false)}>Cancel</button>
                    <button type="submit">Create User</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {editingUser && (
            <div className="modal-overlay">
              <div className="modal">
                <h3>Edit User</h3>
                <form onSubmit={updateUser}>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={editingUser.email}
                      onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Display Name</label>
                    <input
                      type="text"
                      value={editingUser.displayName || ''}
                      onChange={(e) => setEditingUser({...editingUser, displayName: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Tier</label>
                    <select
                      value={editingUser.tier}
                      onChange={(e) => setEditingUser({...editingUser, tier: e.target.value as 'free' | 'premium'})}
                    >
                      <option value="free">Free</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={editingUser.disabled}
                        onChange={(e) => setEditingUser({...editingUser, disabled: e.target.checked})}
                      />
                      Disabled
                    </label>
                  </div>
                  <div className="modal-actions">
                    <button type="button" onClick={() => setEditingUser(null)}>Cancel</button>
                    <button type="submit">Update User</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="users-table">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Display Name</th>
                  <th>Tier</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Last Sign In</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.uid} className={user.disabled ? 'disabled' : ''}>
                    <td>
                      {user.email}
                      {user.isAdmin && <span className="admin-badge">Admin</span>}
                    </td>
                    <td>{user.displayName || '—'}</td>
                    <td>
                      <span className={`tier-badge ${user.tier}`}>
                        {user.tier}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${user.disabled ? 'disabled' : 'active'}`}>
                        {user.disabled ? 'Disabled' : 'Active'}
                      </span>
                    </td>
                    <td>{formatDate(user.creationTime)}</td>
                    <td>{user.lastSignInTime ? formatDate(user.lastSignInTime) : '—'}</td>
                    <td className="actions">
                      <button onClick={() => viewUserDetails(user)} className="view-button">View</button>
                      <button onClick={() => setEditingUser(user)}>Edit</button>
                      {!user.isAdmin && (
                        <button 
                          onClick={() => deleteUser(user.uid)}
                          className="delete-button"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedUser && userDetails && (
        <div className="user-detail-overlay">
          <div className="user-detail-modal">
            <div className="user-detail-header">
              <button 
                className="back-button"
                onClick={() => {setSelectedUser(null); setUserDetails(null);}}
              >
                ← Back to Users
              </button>
              <div className="user-detail-title">
                <h2>{selectedUser.email}</h2>
                <div className="user-detail-badges">
                  <span className={`tier-badge ${selectedUser.tier}`}>
                    {selectedUser.tier}
                  </span>
                  {selectedUser.isAdmin && <span className="admin-badge">Admin</span>}
                  <span className={`status-badge ${selectedUser.disabled ? 'disabled' : 'active'}`}>
                    {selectedUser.disabled ? 'Disabled' : 'Active'}
                  </span>
                </div>
              </div>
            </div>

            <div className="user-detail-tabs">
              <button 
                className={`detail-tab ${activeDetailTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveDetailTab('overview')}
              >
                Overview
              </button>
              <button 
                className={`detail-tab ${activeDetailTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveDetailTab('analytics')}
              >
                Analytics
              </button>
              <button 
                className={`detail-tab ${activeDetailTab === 'conversations' ? 'active' : ''}`}
                onClick={() => setActiveDetailTab('conversations')}
              >
                Conversations
              </button>
              <button 
                className={`detail-tab ${activeDetailTab === 'billing' ? 'active' : ''}`}
                onClick={() => setActiveDetailTab('billing')}
              >
                Billing
              </button>
              <button 
                className={`detail-tab ${activeDetailTab === 'support' ? 'active' : ''}`}
                onClick={() => setActiveDetailTab('support')}
              >
                Support
              </button>
            </div>

            <div className="user-detail-content">
              {/* Overview Tab */}
              {activeDetailTab === 'overview' && (
                <div className="detail-section">
                  <h3>Account Information</h3>
                  <div className="detail-grid">
                    <div className="detail-card">
                      <div className="detail-label">Display Name</div>
                      <div className="detail-value">{selectedUser.displayName || '—'}</div>
                    </div>
                    <div className="detail-card">
                      <div className="detail-label">Created</div>
                      <div className="detail-value">{formatDate(selectedUser.creationTime)}</div>
                    </div>
                    <div className="detail-card">
                      <div className="detail-label">Last Sign In</div>
                      <div className="detail-value">
                        {selectedUser.lastSignInTime ? formatDate(selectedUser.lastSignInTime) : '—'}
                      </div>
                    </div>
                    <div className="detail-card">
                      <div className="detail-label">Account Status</div>
                      <div className="detail-value">
                        <span className={`status-badge ${selectedUser.disabled ? 'disabled' : 'active'}`}>
                          {selectedUser.disabled ? 'Disabled' : 'Active'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Analytics Tab */}
              {activeDetailTab === 'analytics' && userDetails.analytics && (
                <div className="detail-section">
                  <h3>Usage Analytics</h3>
                  <div className="detail-stats-grid">
                    <div className="detail-stat-card">
                      <div className="detail-stat-number">{userDetails.analytics.totalTokens.toLocaleString()}</div>
                      <div className="detail-stat-label">Total Tokens</div>
                    </div>
                    <div className="detail-stat-card">
                      <div className="detail-stat-number">{userDetails.analytics.totalRequests.toLocaleString()}</div>
                      <div className="detail-stat-label">Total Requests</div>
                    </div>
                    <div className="detail-stat-card">
                      <div className="detail-stat-number">${userDetails.analytics.totalCost.toFixed(4)}</div>
                      <div className="detail-stat-label">Total Cost</div>
                    </div>
                    <div className="detail-stat-card">
                      <div className="detail-stat-number">{userDetails.analytics.avgTokensPerRequest}</div>
                      <div className="detail-stat-label">Avg Tokens/Request</div>
                    </div>
                  </div>

                  {/* Model Breakdown */}
                  {userDetails.analytics.modelBreakdown && userDetails.analytics.modelBreakdown.length > 0 && (
                    <div className="model-breakdown-section">
                      <h4>Model Usage Breakdown</h4>
                      <div className="model-breakdown-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Model</th>
                              <th>Tokens</th>
                              <th>Requests</th>
                              <th>Cost</th>
                              <th>Usage %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userDetails.analytics.modelBreakdown.map((model: any) => (
                              <tr key={model.model}>
                                <td>
                                  <div>
                                    <strong>{formatModelName(model.model)}</strong>
                                    <div className="model-meta">{model.model}</div>
                                  </div>
                                </td>
                                <td>{model.totalTokens.toLocaleString()}</td>
                                <td>{model.totalRequests.toLocaleString()}</td>
                                <td>${model.totalCost.toFixed(4)}</td>
                                <td>
                                  <span className="usage-percentage">
                                    {((model.totalTokens / userDetails.analytics.totalTokens) * 100).toFixed(1)}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Conversations Tab */}
              {activeDetailTab === 'conversations' && (
                <div className="detail-section">
                  <h3>Recent Conversations</h3>
                  {userDetails.conversations && userDetails.conversations.length > 0 ? (
                    <div className="conversations-list">
                      {userDetails.conversations.slice(0, 10).map((conversation: any) => (
                        <div key={conversation.id} className="conversation-item">
                          <div className="conversation-info">
                            <div className="conversation-title">{conversation.title || 'Untitled Conversation'}</div>
                            <div className="conversation-meta">
                              {conversation.messageCount} messages • {conversation.tokenCount} tokens
                            </div>
                          </div>
                          <div className="conversation-date">
                            {formatDate(conversation.updatedAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-data">
                      <p>No conversations found for this user.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Billing Tab */}
              {activeDetailTab === 'billing' && (
                <div className="detail-section">
                  <h3>Billing & Payments</h3>
                  <div className="billing-placeholder">
                    <div className="billing-info">
                      <p><strong>Current Plan:</strong> {selectedUser.tier.charAt(0).toUpperCase() + selectedUser.tier.slice(1)}</p>
                      <p><strong>Estimated Monthly Cost:</strong> ${(userDetails.analytics?.totalCost || 0 * 30).toFixed(2)}</p>
                      <p><strong>Total Usage Cost:</strong> ${userDetails.analytics?.totalCost?.toFixed(4) || '0.0000'}</p>
                    </div>
                    <div className="billing-actions">
                      <button className="billing-button disabled" disabled>
                        Manage Subscription (Coming Soon)
                      </button>
                      <button className="billing-button disabled" disabled>
                        View Payment History (Coming Soon)
                      </button>
                      <button className="billing-button disabled" disabled>
                        Update Payment Method (Coming Soon)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Support Tab */}
              {activeDetailTab === 'support' && (
                <div className="detail-section">
                  <h3>Support Actions</h3>
                  <div className="support-actions">
                    <button 
                      className="support-button"
                      onClick={() => {
                        const updatedUser = { ...selectedUser, tier: selectedUser.tier === 'free' ? 'premium' : 'free' as 'free' | 'premium' };
                        setEditingUser(updatedUser);
                      }}
                    >
                      {selectedUser.tier === 'free' ? 'Upgrade to Premium' : 'Downgrade to Free'}
                    </button>
                    <button 
                      className="support-button"
                      onClick={() => {
                        const updatedUser = { ...selectedUser, disabled: !selectedUser.disabled };
                        setEditingUser(updatedUser);
                      }}
                    >
                      {selectedUser.disabled ? 'Enable Account' : 'Disable Account'}
                    </button>
                    <button className="support-button disabled" disabled>
                      Send Support Email (Coming Soon)
                    </button>
                    <button className="support-button disabled" disabled>
                      Issue Refund (Coming Soon)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && tokenUsage && (
        <div className="admin-analytics">
          <h2>Token Usage & Cost Analytics</h2>
          
          {/* Global Stats */}
          <div className="analytics-section">
            <h3>Global Usage</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-number">{tokenUsage.global.totalTokens.toLocaleString()}</div>
                <div className="stat-label">Total Tokens</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{tokenUsage.global.totalRequests.toLocaleString()}</div>
                <div className="stat-label">Total Requests</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{tokenUsage.global.uniqueUsers}</div>
                <div className="stat-label">Active Users</div>
              </div>
              {tokenUsage.costs && (
                <div className="stat-card premium">
                  <div className="stat-number">${tokenUsage.costs.totalCost.toFixed(4)}</div>
                  <div className="stat-label">Total Cost</div>
                </div>
              )}
            </div>
          </div>

          {/* Model Performance */}
          {tokenUsage.modelBreakdown && tokenUsage.modelBreakdown.length > 0 && (
            <div className="analytics-section">
              <h3>Token Usage by Model</h3>
              <div className="analytics-table">
                <table>
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Total Tokens</th>
                      <th>Input Tokens</th>
                      <th>Output Tokens</th>
                      <th>Requests</th>
                      <th>Users</th>
                      <th>Avg Tokens/Request</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokenUsage.modelBreakdown.map((model) => (
                      <tr key={model.model}>
                        <td>
                          <div>
                            <strong>{formatModelName(model.model)}</strong>
                            <div className="model-meta">
                              {model.model}
                            </div>
                          </div>
                        </td>
                        <td>{model.totalTokens.toLocaleString()}</td>
                        <td>{model.inputTokens.toLocaleString()}</td>
                        <td>{model.outputTokens.toLocaleString()}</td>
                        <td>{model.totalRequests.toLocaleString()}</td>
                        <td>{model.uniqueUsers}</td>
                        <td>{model.avgTokensPerRequest}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Users */}
          <div className="analytics-section">
            <h3>Top Users by Token Usage</h3>
            <div className="analytics-table">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Total Tokens</th>
                    <th>Input Tokens</th>
                    <th>Output Tokens</th>
                    <th>Requests</th>
                    <th>Avg Tokens/Request</th>
                    {tokenUsage.costs && <th>Total Cost</th>}
                    <th>Models</th>
                  </tr>
                </thead>
                <tbody>
                  {tokenUsage.topUsers.slice(0, 15).map((user) => {
                    const userCost = tokenUsage.costs?.costByUser.find(c => c.email === user.email);
                    const isExpanded = expandedUsers.has(user.userId);
                    return (
                      <React.Fragment key={user.userId}>
                        <tr className="user-row">
                          <td>
                            <div>
                              <strong>{user.email}</strong>
                              <div className="user-meta">
                                Last active: {formatDate(user.lastRequest)}
                              </div>
                            </div>
                          </td>
                          <td>{user.totalTokens.toLocaleString()}</td>
                          <td>{user.inputTokens?.toLocaleString() || '0'}</td>
                          <td>{user.outputTokens?.toLocaleString() || '0'}</td>
                          <td>{user.totalRequests.toLocaleString()}</td>
                          <td>{Math.round(user.totalTokens / Math.max(user.totalRequests, 1))}</td>
                          {tokenUsage.costs && (
                            <td>${userCost?.totalCost.toFixed(4) || '0.00'}</td>
                          )}
                          <td>
                            <button 
                              className="expand-button"
                              onClick={() => toggleUserExpansion(user.userId)}
                              title={isExpanded ? 'Hide model breakdown' : 'Show model breakdown'}
                            >
                              {user.modelBreakdown && user.modelBreakdown.length > 0 ? (
                                <>
                                  {user.modelBreakdown.length} model{user.modelBreakdown.length > 1 ? 's' : ''}
                                  <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
                                </>
                              ) : (
                                'No data'
                              )}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && user.modelBreakdown && user.modelBreakdown.length > 0 && (
                          user.modelBreakdown.map((modelData, index) => (
                            <tr key={`${user.userId}-${modelData.model}`} className="model-breakdown-row">
                              <td className="model-breakdown-cell">
                                <div className="model-info">
                                  <strong>{formatModelName(modelData.model)}</strong>
                                  <div className="model-meta">{modelData.model}</div>
                                </div>
                              </td>
                              <td>{modelData.totalTokens.toLocaleString()}</td>
                              <td>{modelData.inputTokens?.toLocaleString() || '0'}</td>
                              <td>{modelData.outputTokens?.toLocaleString() || '0'}</td>
                              <td>{modelData.totalRequests.toLocaleString()}</td>
                              <td>{Math.round(modelData.totalTokens / Math.max(modelData.totalRequests, 1))}</td>
                              {tokenUsage.costs && (
                                <td>${modelData.totalCost?.toFixed(4) || '0.00'}</td>
                              )}
                              <td>
                                <span className="model-badge">
                                  {((modelData.totalTokens / user.totalTokens) * 100).toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cost Breakdown */}
          {tokenUsage.costs && (
            <div className="analytics-section">
              <h3>Cost Analytics</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-number">${(tokenUsage.costs.avgCostPerToken * 1000).toFixed(4)}</div>
                  <div className="stat-label">Avg Cost per 1K Tokens</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">${tokenUsage.costs.avgCostPerRequest.toFixed(4)}</div>
                  <div className="stat-label">Avg Cost per Request</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">${tokenUsage.costs.avgCostPerUser.toFixed(4)}</div>
                  <div className="stat-label">Avg Cost per User</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'pricing' && pricing && (
        <div className="admin-pricing">
          <div className="pricing-header">
            <h2>Model Pricing Configuration</h2>
            <button 
              className="add-model-button"
              onClick={() => setShowAddModel(true)}
            >
              Add Model
            </button>
          </div>

          {showAddModel && (
            <div className="modal-overlay">
              <div className="modal">
                <h3>Add New Model</h3>
                <form onSubmit={addNewModel}>
                  <div className="form-group">
                    <label>Model ID</label>
                    <input
                      type="text"
                      value={newModel.model}
                      onChange={(e) => setNewModel({...newModel, model: e.target.value})}
                      placeholder="e.g., gpt-4o-turbo-2024-04-09"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Display Name (Optional)</label>
                    <input
                      type="text"
                      value={newModel.displayName}
                      onChange={(e) => setNewModel({...newModel, displayName: e.target.value})}
                      placeholder="e.g., GPT-4o Turbo"
                    />
                  </div>
                  <div className="form-group">
                    <label>Input Token Price (per 1K tokens)</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={newModel.input}
                      onChange={(e) => setNewModel({...newModel, input: parseFloat(e.target.value)})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Output Token Price (per 1K tokens)</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={newModel.output}
                      onChange={(e) => setNewModel({...newModel, output: parseFloat(e.target.value)})}
                      required
                    />
                  </div>
                  <div className="modal-actions">
                    <button type="button" onClick={() => setShowAddModel(false)}>Cancel</button>
                    <button type="submit">Add Model</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="pricing-table">
            <div className="pricing-actions">
              {editingPricing ? (
                <div className="editing-actions">
                  <button 
                    className="save-button"
                    onClick={() => updatePricing(editingPricing)}
                  >
                    Save Changes
                  </button>
                  <button 
                    className="cancel-button"
                    onClick={() => setEditingPricing(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  className="edit-button"
                  onClick={() => setEditingPricing({...pricing})}
                >
                  Edit Pricing
                </button>
              )}
            </div>

            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Display Name</th>
                  <th>Input Price (per 1K)</th>
                  <th>Output Price (per 1K)</th>
                  <th>Cost Ratio</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(pricing).map(([modelId, modelPricing]) => (
                  <tr key={modelId}>
                    <td>
                      <div className="model-id">
                        <code>{modelId}</code>
                      </div>
                    </td>
                    <td>
                      {editingPricing ? (
                        <input
                          type="text"
                          value={editingPricing[modelId]?.displayName || ''}
                          onChange={(e) => setEditingPricing({
                            ...editingPricing,
                            [modelId]: {
                              ...editingPricing[modelId],
                              displayName: e.target.value
                            }
                          })}
                          placeholder="Display name"
                        />
                      ) : (
                        <span>{formatModelName(modelId)}</span>
                      )}
                    </td>
                    <td>
                      {editingPricing ? (
                        <input
                          type="number"
                          step="0.000001"
                          value={editingPricing[modelId]?.input || 0}
                          onChange={(e) => setEditingPricing({
                            ...editingPricing,
                            [modelId]: {
                              ...editingPricing[modelId],
                              input: parseFloat(e.target.value) || 0
                            }
                          })}
                          className="price-input"
                        />
                      ) : (
                        <span className="price-display">${modelPricing.input.toFixed(6)}</span>
                      )}
                    </td>
                    <td>
                      {editingPricing ? (
                        <input
                          type="number"
                          step="0.000001"
                          value={editingPricing[modelId]?.output || 0}
                          onChange={(e) => setEditingPricing({
                            ...editingPricing,
                            [modelId]: {
                              ...editingPricing[modelId],
                              output: parseFloat(e.target.value) || 0
                            }
                          })}
                          className="price-input"
                        />
                      ) : (
                        <span className="price-display">${modelPricing.output.toFixed(6)}</span>
                      )}
                    </td>
                    <td>
                      <span className="cost-ratio">
                        {(modelPricing.output / modelPricing.input).toFixed(1)}x
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pricing-info">
            <div className="info-card">
              <h3>Pricing Notes</h3>
              <ul>
                <li>All prices are per 1,000 tokens</li>
                <li>Output tokens are typically more expensive than input tokens</li>
                <li>Changes apply immediately to all new cost calculations</li>
                <li>Historical costs are not recalculated</li>
              </ul>
            </div>
            <div className="info-card">
              <h3>Current OpenAI Pricing (Reference)</h3>
              <ul>
                <li><strong>GPT-4o Realtime:</strong> $0.005 input, $0.020 output</li>
                <li><strong>GPT-4o Mini:</strong> $0.00015 input, $0.0006 output</li>
                <li><strong>GPT-4 Turbo:</strong> $0.01 input, $0.03 output</li>
                <li>Check OpenAI pricing page for latest rates</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'health' && health && (
        <div className="admin-health">
          <h2>System Health</h2>
          <div className="health-grid">
            <div className="health-card">
              <div className="health-title">Server Status</div>
              <div className={`health-status ${health.server}`}>{health.server}</div>
            </div>
            <div className="health-card">
              <div className="health-title">Firebase</div>
              <div className={`health-status ${health.firebase}`}>{health.firebase}</div>
            </div>
            <div className="health-card">
              <div className="health-title">OpenAI</div>
              <div className={`health-status ${health.openai.replace(' ', '-')}`}>{health.openai}</div>
            </div>
            <div className="health-card">
              <div className="health-title">Zep Cloud</div>
              <div className={`health-status ${health.zep.replace(' ', '-')}`}>{health.zep}</div>
            </div>
          </div>
          <div className="system-info">
            <div className="info-card">
              <h3>Server Uptime</h3>
              <p>{Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m</p>
            </div>
            <div className="info-card">
              <h3>Memory Usage</h3>
              <p>RSS: {formatBytes(health.memory.rss)}</p>
              <p>Heap: {formatBytes(health.memory.heapUsed)} / {formatBytes(health.memory.heapTotal)}</p>
            </div>
            <div className="info-card">
              <h3>Last Updated</h3>
              <p>{formatDate(health.timestamp)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel; 