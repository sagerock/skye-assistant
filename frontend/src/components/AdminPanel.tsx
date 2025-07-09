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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'analytics' | 'health'>('dashboard');
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
        await Promise.all([fetchUsers(), fetchStats(), fetchHealth(), fetchTokenUsage()]);
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
                  <div className="stat-number">${tokenUsage.costs.totalCost.toFixed(2)}</div>
                  <div className="stat-label">Total Cost</div>
                </div>
              )}
            </div>
          </div>

          {/* Model Performance */}
          <div className="analytics-section">
            <h3>Model Performance</h3>
            <div className="analytics-note">
              <p>Model-specific analytics have been simplified. All usage is now tracked at the user level.</p>
            </div>
          </div>

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
                  </tr>
                </thead>
                <tbody>
                  {tokenUsage.topUsers.slice(0, 15).map((user) => {
                    const userCost = tokenUsage.costs?.costByUser.find(c => c.email === user.email);
                    return (
                      <tr key={user.userId}>
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
                      </tr>
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
                  <div className="stat-number">${tokenUsage.costs.avgCostPerToken.toFixed(6)}</div>
                  <div className="stat-label">Avg Cost per Token</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">${tokenUsage.costs.avgCostPerRequest.toFixed(4)}</div>
                  <div className="stat-label">Avg Cost per Request</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">${tokenUsage.costs.avgCostPerUser.toFixed(2)}</div>
                  <div className="stat-label">Avg Cost per User</div>
                </div>
              </div>
            </div>
          )}
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