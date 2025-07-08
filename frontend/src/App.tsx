import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Auth from './components/Auth';
import RealtimeInterface from './components/RealtimeInterface';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);



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

  return (
    <div className="App">
      <header className="App-header">
        <h1>Skye Assistant</h1>
      </header>
      
      <main className="app-main">
        {user ? (
          <div>
            <p>Welcome, {user.email}</p>
            <button onClick={() => auth.signOut()}>Sign Out</button>
            <RealtimeInterface />
          </div>
        ) : (
          <Auth user={user} onAuthChange={setUser} />
        )}
      </main>
    </div>
  );
}

export default App;