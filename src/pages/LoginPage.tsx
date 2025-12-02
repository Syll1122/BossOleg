// src/pages/LoginPage.tsx

import React, { useState } from 'react';
import { IonPage, IonContent, IonInput, IonItem, IonLabel, IonButton, IonText } from '@ionic/react';
import { useHistory } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const history = useHistory();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Temporary test accounts for testing
    // Resident account: R1 / 1234
    // Collector account: C1 / 1234
    
    if ((email.toLowerCase() === 'r1' || email === 'R1') && password === '1234') {
      // Store user role in localStorage for now
      localStorage.setItem('watch_user_role', 'resident');
      localStorage.setItem('watch_user_name', 'Resident User');
      history.push('/');
      window.location.reload(); // Reload to update user state
    } else if ((email.toLowerCase() === 'c1' || email === 'C1') && password === '1234') {
      localStorage.setItem('watch_user_role', 'collector');
      localStorage.setItem('watch_user_name', 'Collector User');
      history.push('/collector');
      window.location.reload(); // Reload to update user state
    } else {
      alert('Invalid credentials. Use R1/1234 for resident or C1/1234 for collector.');
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
                  <IonLabel position="stacked">Username</IonLabel>
                  <IonInput required value={email} onIonInput={(e) => setEmail(e.detail.value!)} placeholder="R1 or C1" />
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
                  style={{
                    '--background': '#16a34a',
                    '--background-activated': '#15803d',
                    marginBottom: '0.75rem',
                  }}
                >
                  Sign In
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
      </IonContent>
    </IonPage>
  );
};

export default LoginPage;
