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
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '3rem 1.5rem 2rem',
            background:
              'radial-gradient(circle at top, rgba(34, 197, 94, 0.3), transparent 60%), #ecfdf3',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 380,
              background: '#ffffff',
              borderRadius: 28,
              boxShadow: '0 20px 45px rgba(15, 23, 42, 0.16)',
              overflow: 'hidden',
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
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Welcome back</h2>
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', opacity: 0.95 }}>
                Sign in to track garbage trucks and schedules in your barangay.
              </p>
            </div>

            <div style={{ padding: '1.5rem 1.5rem 1.25rem' }}>
              <form onSubmit={onSubmit}>
                <IonItem
                  lines="none"
                  style={{ marginBottom: '0.9rem', borderRadius: 16, '--background': '#f9fafb' } as any}
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
                    color: '#6b7280',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      color: '#4b286d',
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
                      background: '#f3f4fb',
                      border: '1px solid #e5e7eb',
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
                      style={{ marginBottom: '0.75rem', borderRadius: 12, '--background': '#ffffff' } as any}
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
                          '--background': '#16a34a',
                          '--background-activated': '#15803d',
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
                          '--border-color': '#6b7280',
                          '--color': '#6b7280',
                        }}
                      >
                        Cancel
                      </IonButton>
                    </div>
                  </div>
                )}

                <IonButton
                  type="submit"
                  expand="block"
                  shape="round"
                  disabled={isLoading}
                  style={{
                    '--background': '#16a34a',
                    '--background-activated': '#15803d',
                    marginBottom: '0.75rem',
                  }}
                >
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </IonButton>

                <IonButton
                  expand="block"
                  shape="round"
                  fill="clear"
                  style={{ '--color': '#16a34a' }}
                  onClick={() => history.push('/signup')}
                >
                  Create an account
                </IonButton>
              </form>
            </div>
          </div>

          <IonText>
            <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#6b7280', textAlign: 'center' }}>
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
