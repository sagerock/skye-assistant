import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Auth from './components/Auth';
import RealtimeInterface from './components/RealtimeInterface';
import LandingPage from './components/LandingPage';
import AdminPanel from './components/AdminPanel';
import UserProfile from './components/UserProfile';
import './App.css';

// Admin users list - should match backend
const ADMIN_USERS = new Set([
  'sage@sagerock.com'
]);

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const isAdmin = user && ADMIN_USERS.has(user.email || '');
  const isOnLandingPage = !user && !showAuth && !showAdmin && !showProfile;

  // Profile View
  if (showProfile && user) {
    return (
      <div className="App">
        <UserProfile 
          user={user} 
          onBack={() => setShowProfile(false)} 
        />
      </div>
    );
  }

  // Admin Panel View
  if (showAdmin && user && isAdmin) {
    return (
      <div className="App">
        <AdminPanel 
          user={user} 
          onBack={() => setShowAdmin(false)} 
        />
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="logo-section">
            <h1>Skye</h1>
            <p>AI Companion</p>
          </div>
          <div className="header-actions">
            {isOnLandingPage && (
              <button 
                className="header-get-started-button" 
                onClick={() => setShowAuth(true)}
              >
                Get Started
              </button>
            )}
            {user && (
              <button 
                className="header-profile-button" 
                onClick={() => setShowProfile(true)}
                title="User Profile"
              >
                👤 Profile
              </button>
            )}
            {user && isAdmin && !showAdmin && (
              <button 
                className="header-admin-button" 
                onClick={() => setShowAdmin(true)}
                title="Admin Panel"
              >
                ⚙️ Admin
              </button>
            )}
          </div>
        </div>
      </header>
      
      <main className={user || showAuth ? "app-main centered" : "app-main"}>
        {user ? (
          <div className="user-welcome">
            <div className="welcome-message">
              <p>Welcome back 🤍</p>
              <div className="welcome-actions">
                <button className="profile-button" onClick={() => setShowProfile(true)}>
                  Profile
                </button>
                {isAdmin && (
                  <button 
                    className="admin-access-button" 
                    onClick={() => setShowAdmin(true)}
                  >
                    Admin Panel
                  </button>
                )}
                <button className="sign-out-button" onClick={() => auth.signOut()}>
                  Sign Out
                </button>
              </div>
            </div>
            <RealtimeInterface />
          </div>
        ) : showAuth ? (
          <Auth user={user} onAuthChange={setUser} onBack={() => setShowAuth(false)} />
        ) : (
          <LandingPage onGetStarted={() => setShowAuth(true)} />
        )}
      </main>
    </div>
  );
}

export default App;