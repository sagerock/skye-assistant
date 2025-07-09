import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';

interface AuthProps {
  user: any;
  onAuthChange: (user: any) => void;
}

const Auth: React.FC<AuthProps> = ({ user, onAuthChange }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    try {
      await sendPasswordResetEmail(auth, email, {
        // This ensures the user gets redirected back to your app after reset
        url: window.location.origin,
        handleCodeInApp: false,
      });
      setMessage(`Password reset email sent to ${email}! Check your inbox and spam folder. The email may take a few minutes to arrive.`);
        
    } catch (error: any) {
      console.error('Password reset error:', error);
      
      // Provide specific error messages
      if (error.code === 'auth/user-not-found') {
        setError('No account found with this email address. Please check the email or sign up for a new account.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address format.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many password reset attempts. Please wait a few minutes before trying again.');
      } else {
        setError(`Error: ${error.message}`);
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      setError(error.message);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setError('');
    setMessage('');
    setIsForgotPassword(false);
    setIsSignUp(false);
  };

  if (user) {
    return (
      <div className="auth-container">
        <div className="user-info">
          <p>Welcome, {user.email}</p>
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
      </div>
    );
  }

  // Forgot Password Form
  if (isForgotPassword) {
    return (
      <div className="auth-container">
        <h2>Reset Password</h2>
        <form onSubmit={handleForgotPassword}>
          <div>
            <input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}
          <button type="submit">Send Reset Email</button>
        </form>
        <p>
          <button 
            type="button" 
            onClick={resetForm}
            className="link-button"
          >
            Back to Sign In
          </button>
        </p>
      </div>
    );
  }

  // Sign In/Up Form
  return (
    <div className="auth-container">
      <h2>{isSignUp ? 'Sign Up' : 'Sign In'}</h2>
      <form onSubmit={handleAuth}>
        <div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}
        <button type="submit">{isSignUp ? 'Sign Up' : 'Sign In'}</button>
      </form>
      
      {/* Sign Up/In Toggle */}
      <p>
        {isSignUp ? 'Already have an account?' : "Don't have an account?"}
        <button 
          type="button" 
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError('');
            setMessage('');
          }}
          className="link-button"
        >
          {isSignUp ? 'Sign In' : 'Sign Up'}
        </button>
      </p>
      
      {/* Forgot Password Link */}
      {!isSignUp && (
        <p>
          <button 
            type="button" 
            onClick={() => {
              setIsForgotPassword(true);
              setError('');
              setMessage('');
            }}
            className="link-button"
          >
            Forgot Password?
          </button>
        </p>
      )}
    </div>
  );
};

export default Auth;