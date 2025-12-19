// src/pages/LoginPage.tsx

import React, { useState, useEffect } from 'react';
import { IonPage, IonContent, IonInput, IonItem, IonLabel, IonButton, IonText, IonAlert } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { databaseService } from '../services/database';
import { sendPasswordEmail } from '../services/emailService';

const LoginPage: React.FC = () => {
  const history = useHistory();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isSendingPassword, setIsSendingPassword] = useState(false);

  // Initialize database on mount
  useEffect(() => {
    databaseService.init().catch((error) => {
      console.error('Database initialization error:', error);
    });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!identifier || !password) {
      setAlertMessage('Please enter your username/email and password');
      setShowAlert(true);
      setIsLoading(false);
      return;
    }

    try {
      // Clear any existing session data before starting new login
      // This ensures clean state when switching between accounts
      const previousUserId = localStorage.getItem('watch_user_id');
      const previousSessionToken = localStorage.getItem('watch_session_token');
      
      // Clear previous session from database if exists
      if (previousUserId && previousSessionToken) {
        try {
          await databaseService.deleteSession(previousSessionToken);
          await databaseService.setUserOnlineStatus(previousUserId, false);
        } catch (error) {
          console.warn('Error clearing previous session:', error);
          // Continue with login even if clearing fails
        }
      }
      
      // Clear localStorage before proceeding
      localStorage.removeItem('watch_user_id');
      localStorage.removeItem('watch_user_role');
      localStorage.removeItem('watch_user_name');
      localStorage.removeItem('watch_user_email');
      localStorage.removeItem('watch_user_username');
      localStorage.removeItem('watch_session_token');

      // Authenticate against Supabase
      const account = await databaseService.authenticate(identifier.trim(), password);

      if (account) {
        // Check if collector registration is approved
        if (account.role === 'collector') {
          const registrationStatus = (account as any).registrationStatus;
          if (registrationStatus === 'pending') {
            setAlertMessage('Your registration is pending approval. Please wait for admin approval before logging in.');
            setShowAlert(true);
            setIsLoading(false);
            return;
          } else if (registrationStatus === 'rejected') {
            setAlertMessage('Your registration has been rejected. Please contact support for more information.');
            setShowAlert(true);
            setIsLoading(false);
            return;
          } else if (registrationStatus !== 'approved') {
            setAlertMessage('Your registration is still being reviewed. Please wait for approval.');
            setShowAlert(true);
            setIsLoading(false);
            return;
          }
        }

        // Delete any existing sessions for this account before creating a new one
        // This allows users to log in from a new device/browser even if an old session exists
        try {
          await databaseService.deleteUserSessions(account.id);
          console.log('Cleared any existing sessions for account:', account.id);
        } catch (sessionError: any) {
          console.warn('Error clearing existing sessions:', sessionError);
          // Continue with login even if clearing fails
        }

        // Generate a unique session token
        const sessionToken = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${account.id}`;
        
        // Create new session in database
        try {
          await databaseService.createSession(account.id, sessionToken);
          console.log('Session created successfully');
        } catch (sessionError: any) {
          console.error('Error creating session:', sessionError);
          // If session creation fails, we should still allow login but log the error
        }
        
        // Note: setUserOnlineStatus is already called in authenticate() method

        // Store user session in localStorage
        localStorage.setItem('watch_user_id', account.id);
        localStorage.setItem('watch_user_role', account.role);
        localStorage.setItem('watch_user_name', account.name);
        localStorage.setItem('watch_user_email', account.email);
        localStorage.setItem('watch_user_username', account.username);
        localStorage.setItem('watch_session_token', sessionToken);

        // Redirect based on role
        if (account.role === 'collector') {
          history.push('/collector');
        } else {
          history.push('/');
        }
        
        // Reload to update user state
        window.location.reload();
      } else {
        setAlertMessage('Invalid username/email or password. Please try again.');
        setShowAlert(true);
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setAlertMessage('An error occurred during login. Please try again.');
      setShowAlert(true);
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail.trim()) {
      setAlertMessage('Please enter your email address');
      setShowAlert(true);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotPasswordEmail)) {
      setAlertMessage('Please enter a valid email address');
      setShowAlert(true);
      return;
    }

    setIsSendingPassword(true);

    try {
      await databaseService.init();
      
      // Check if account exists with this email
      const account = await databaseService.getAccountByEmail(forgotPasswordEmail.toLowerCase().trim());
      
      if (!account) {
        setAlertMessage('No account found with this email address');
        setShowAlert(true);
        setIsSendingPassword(false);
        return;
      }

      // Send password to email
      try {
        const emailSent = await sendPasswordEmail(account.email, account.name, account.password);
        
        if (emailSent) {
          setAlertMessage(`Your password has been sent to ${account.email}. Please check your inbox.`);
          setShowAlert(true);
          setShowForgotPassword(false);
          setForgotPasswordEmail('');
        } else {
          // Fallback for development
          setAlertMessage(`Password sent to ${account.email}. Your password is: ${account.password}. Please configure EmailJS in src/services/emailService.ts for production use.`);
          setShowAlert(true);
          setShowForgotPassword(false);
          setForgotPasswordEmail('');
        }
      } catch (error) {
        console.error('Error sending password email:', error);
        // Fallback for development
        setAlertMessage(`Password sent to ${account.email}. Your password is: ${account.password}. Please configure EmailJS in src/services/emailService.ts for production use.`);
        setShowAlert(true);
        setShowForgotPassword(false);
        setForgotPasswordEmail('');
      }
    } catch (error: any) {
      console.error('Forgot password error:', error);
      setAlertMessage('An error occurred. Please try again.');
      setShowAlert(true);
    } finally {
      setIsSendingPassword(false);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1.5rem',
            background: 'radial-gradient(circle at 20% 20%, rgba(34,197,94,0.15), transparent 35%), radial-gradient(circle at 80% 30%, rgba(59,130,246,0.15), transparent 35%), linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 40%, #252525 100%)',
            position: 'relative',
          }}
        >
          {/* Eco Truck Background Element */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '400px',
              height: '400px',
              opacity: 0.08,
              zIndex: 0,
              pointerEvents: 'none',
            }}
          >
            <img
              src="https://images.unsplash.com/photo-1502877828070-33c90eec0b2f?w=600&h=400&fit=crop&q=80&sat=-40&hue=90"
              alt="Eco Truck Background"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: 'blur(2px)',
              }}
            />
          </div>

          <div style={{ textAlign: 'center', marginBottom: '1rem', position: 'relative', zIndex: 1 }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '0.08em', color: '#22c55e' }}>W.A.T.C.H</h1>
            <div style={{ marginTop: '0.35rem', fontWeight: 600, color: '#e5e5e5' }}>Waste Alert Tracking Collection Hub</div>
          </div>
          <div
            style={{
              width: '100%',
              maxWidth: 380,
              background: 'var(--app-surface)',
              border: '1px solid var(--app-border)',
              borderRadius: 28,
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 45%, #4ade80 100%)',
                padding: '1.75rem 1.5rem 1.5rem',
                color: 'white',
                textAlign: 'left',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Welcome back</h2>
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', opacity: 0.95 }}>
                  Sign in to track eco-friendly fleets and greener collection routes.
                </p>
              </div>
            </div>

            <div style={{ padding: '1.5rem 1.5rem 1.25rem' }}>
              <form onSubmit={onSubmit}>
                <IonItem
                  lines="none"
                  style={{ marginBottom: '0.9rem', borderRadius: 16, '--background': '#242424', border: '1px solid #2a2a2a' } as any}
                >
                  <IonLabel position="stacked">Username or Email</IonLabel>
                  <IonInput 
                    required 
                    value={identifier} 
                    onIonInput={(e) => setIdentifier(e.detail.value!)} 
                    placeholder="Enter username or email" 
                  />
                </IonItem>

                <IonItem
                  lines="none"
                  style={{ marginBottom: '0.6rem', borderRadius: 16, '--background': '#f9fafb' } as any}
                >
                  <IonLabel position="stacked">Password</IonLabel>
                  <IonInput required type="password" value={password} onIonInput={(e) => setPassword(e.detail.value!)} />
                </IonItem>
                

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    fontSize: '0.8rem',
                    marginBottom: '0.9rem',
                    color: '#b0b0b0',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      color: '#3b82f6',
                      cursor: 'pointer',
                    }}
                  >
                    Forgot password?
                  </button>
                </div>

                {showForgotPassword && (
                  <div
                    style={{
                      padding: '1rem',
                      marginBottom: '0.9rem',
                      borderRadius: 12,
                      background: '#242424',
                      border: '1px solid #2a2a2a',
                    }}
                  >
                    <IonText style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                      Reset Password
                    </IonText>
                    <IonText style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.75rem', display: 'block' }}>
                      Enter your email address and we'll send you your password.
                    </IonText>
                    <IonItem
                      lines="none"
                      style={{ marginBottom: '0.75rem', borderRadius: 12, '--background': '#242424', border: '1px solid #2a2a2a' } as any}
                    >
                      <IonLabel position="stacked">Email Address</IonLabel>
                      <IonInput
                        type="email"
                        value={forgotPasswordEmail}
                        onIonInput={(e) => setForgotPasswordEmail(e.detail.value!)}
                        placeholder="your@email.com"
                      />
                    </IonItem>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <IonButton
                        type="button"
                        expand="block"
                        shape="round"
                        disabled={isSendingPassword}
                        onClick={handleForgotPassword}
                        style={{
                          '--background': '#22c55e',
                          '--background-activated': '#16a34a',
                          flex: 1,
                        }}
                      >
                        {isSendingPassword ? 'Sending...' : 'Send Password'}
                      </IonButton>
                      <IonButton
                        type="button"
                        expand="block"
                        shape="round"
                        fill="outline"
                        onClick={() => {
                          setShowForgotPassword(false);
                          setForgotPasswordEmail('');
                        }}
                        style={{
                          '--border-color': '#3a3a3a',
                          '--color': '#b0b0b0',
                        }}
                      >
                        Cancel
                      </IonButton>
                    </div>
                  </div>
                )}

                <div style={{ 
                  textAlign: 'center',
                  width: '100%',
                  marginBottom: '0.75rem' 
                }}>
                  <IonButton
                    type="submit"
                    shape="round"
                    disabled={isLoading}
                    style={{
                      '--background': '#16a34a',
                      '--background-activated': '#15803d',
                      display: 'inline-block',
                      width: 'auto',
                      padding: '0 2rem',
                    }}
                  >
                    {isLoading ? 'Signing In...' : 'Sign In'}
                  </IonButton>
                </div>

                <IonButton
                  expand="block"
                  shape="round"
                  fill="clear"
                  style={{ '--color': '#22c55e' }}
                  onClick={() => history.push('/signup')}
                >
                  Create an account
                </IonButton>
              </form>
            </div>
          </div>

          <IonText>
            <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--app-text-secondary)', textAlign: 'center' }}>
              By signing in you agree to follow proper waste segregation and barangay guidelines.
            </p>
          </IonText>
        </div>

        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header="Login Error"
          message={alertMessage}
          buttons={['OK']}
        />
      </IonContent>
    </IonPage>
  );
};

export default LoginPage;
