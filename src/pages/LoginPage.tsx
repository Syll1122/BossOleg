// src/pages/LoginPage.tsx

import React, { useState, useEffect } from 'react';
import { IonPage, IonContent, IonInput, IonItem, IonLabel, IonButton, IonText, IonAlert } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { databaseService } from '../services/database';

const LoginPage: React.FC = () => {
  const history = useHistory();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
      // Authenticate against local database
      const account = await databaseService.authenticate(identifier.trim(), password);

      if (account) {
        // Store user session in localStorage
        localStorage.setItem('watch_user_id', account.id);
        localStorage.setItem('watch_user_role', account.role);
        localStorage.setItem('watch_user_name', account.name);
        localStorage.setItem('watch_user_email', account.email);
        localStorage.setItem('watch_user_username', account.username);

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
