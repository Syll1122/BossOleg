// src/pages/SignUpPage.tsx

import React, { useState } from 'react';
import { IonPage, IonContent, IonInput, IonItem, IonLabel, IonButton, IonText, IonSelect, IonSelectOption, IonAlert } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { databaseService } from '../services/database';
import { UserRole } from '../models/types';

const SignUpPage: React.FC = () => {
  const history = useHistory();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('resident');
  const [name, setName] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');

  // Generate OTP code
  const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Send OTP (mock implementation - in production, send via email service)
  const sendOTP = () => {
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAlertMessage('Please enter a valid email address first');
      setShowAlert(true);
      return;
    }

    const otp = generateOTP();
    setGeneratedOtp(otp);
    setOtpSent(true);
    setOtpInput('');
    
    // In production, send OTP via email service
    // For now, show it in alert (for testing purposes)
    setAlertMessage(`OTP sent to ${email}. Your OTP code is: ${otp} (This is for testing only)`);
    setShowAlert(true);
    
    // Store OTP with expiration (5 minutes)
    const otpData = {
      code: otp,
      email: email.toLowerCase().trim(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    };
    localStorage.setItem('signup_otp', JSON.stringify(otpData));
  };

  // Validate name (only letters and spaces)
  const validateName = (value: string): boolean => {
    // Allow only letters, spaces, and common name characters (apostrophes, hyphens)
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    return nameRegex.test(value);
  };

  const handleNameChange = (value: string) => {
    if (value === '' || validateName(value)) {
      setName(value);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Validation
    if (!email || !username || !password || !confirmPassword || !role || !name.trim()) {
      setAlertMessage('Please fill in all fields');
      setShowAlert(true);
      setIsLoading(false);
      return;
    }

    // Name validation
    if (!validateName(name.trim())) {
      setAlertMessage('Name can only contain letters, spaces, apostrophes, and hyphens');
      setShowAlert(true);
      setIsLoading(false);
      return;
    }

    // OTP validation
    if (!otpSent) {
      setAlertMessage('Please verify your email with OTP first');
      setShowAlert(true);
      setIsLoading(false);
      return;
    }

    // Check OTP
    const storedOtpData = localStorage.getItem('signup_otp');
    if (!storedOtpData) {
      setAlertMessage('OTP expired. Please request a new one.');
      setShowAlert(true);
      setIsLoading(false);
      return;
    }

    const otpData = JSON.parse(storedOtpData);
    if (otpData.email !== email.toLowerCase().trim()) {
      setAlertMessage('OTP was sent to a different email. Please request a new one.');
      setShowAlert(true);
      setIsLoading(false);
      return;
    }

    if (Date.now() > otpData.expiresAt) {
      setAlertMessage('OTP expired. Please request a new one.');
      setShowAlert(true);
      setIsLoading(false);
      localStorage.removeItem('signup_otp');
      return;
    }

    if (otpInput !== otpData.code && otpInput !== generatedOtp) {
      setAlertMessage('Invalid OTP code. Please try again.');
      setShowAlert(true);
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setAlertMessage('Passwords do not match');
      setShowAlert(true);
      setIsLoading(false);
      return;
    }

    if (password.length < 4) {
      setAlertMessage('Password must be at least 4 characters long');
      setShowAlert(true);
      setIsLoading(false);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAlertMessage('Please enter a valid email address');
      setShowAlert(true);
      setIsLoading(false);
      return;
    }

    try {
      // Create account in local database
      await databaseService.createAccount({
        email: email.toLowerCase().trim(),
        username: username.trim(),
        password, // In production, hash this password
        name: name.trim() || username.trim(),
        role,
      });

      // Clear OTP data
      localStorage.removeItem('signup_otp');

      // Success - redirect to login
      setAlertMessage('Account created successfully! Please log in.');
      setShowAlert(true);
      
      // Redirect after alert is dismissed
      setTimeout(() => {
        history.push('/login');
      }, 1500);
    } catch (error: any) {
      setAlertMessage(error.message || 'Failed to create account. Please try again.');
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
            padding: '2.5rem 1.5rem 2rem',
            background:
              'radial-gradient(circle at top, rgba(34, 197, 94, 0.3), transparent 60%), #ecfdf3',
          }}
        >
          <div style={{ width: '100%', maxWidth: 380 }}>
            {/* Illustration */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <div
                style={{
                  width: 210,
                  height: 150,
                  borderRadius: 24,
                  background:
                    'linear-gradient(135deg, #16a34a 0%, #22c55e 35%, #bbf7d0 70%, #ecfdf3 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 20px 40px rgba(15,23,42,0.16)',
                }}
              >
                <span role="img" aria-label="recycling truck" style={{ fontSize: '3rem' }}>
                  🚛
                </span>
              </div>
            </div>

            {/* Title and subtitle */}
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: '1.75rem',
                  fontWeight: 700,
                  color: '#111827',
                }}
              >
                Sign up
              </h1>
              <p
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.9rem',
                  color: '#6b7280',
                }}
              >
                Create an account to manage your waste collection.
              </p>
            </div>

            <div style={{ padding: '0 0.25rem' }}>
              <form onSubmit={onSubmit}>
                <IonItem
                  lines="none"
                  style={{ marginBottom: '0.9rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                >
                  <IonLabel position="stacked">Full Name</IonLabel>
                  <IonInput 
                    required 
                    value={name} 
                    onIonInput={(e) => handleNameChange(e.detail.value!)} 
                    placeholder="Your name (letters only)" 
                  />
                </IonItem>

                <IonItem
                  lines="none"
                  style={{ marginBottom: '0.9rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                >
                  <IonLabel position="stacked">Username</IonLabel>
                  <IonInput 
                    required 
                    value={username} 
                    onIonInput={(e) => setUsername(e.detail.value!)} 
                    placeholder="Choose a username" 
                  />
                </IonItem>

                <IonItem
                  lines="none"
                  style={{ marginBottom: '0.9rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                >
                  <IonLabel position="stacked">Email</IonLabel>
                  <IonInput 
                    required 
                    type="email" 
                    value={email} 
                    onIonInput={(e) => {
                      setEmail(e.detail.value!);
                      if (otpSent) {
                        setOtpSent(false);
                        setOtpInput('');
                        setGeneratedOtp('');
                      }
                    }} 
                    placeholder="you@example.com" 
                  />
                </IonItem>

                {!otpSent ? (
                  <IonButton
                    type="button"
                    expand="block"
                    shape="round"
                    fill="outline"
                    onClick={sendOTP}
                    style={{
                      '--border-color': '#16a34a',
                      '--color': '#16a34a',
                      marginBottom: '0.9rem',
                    }}
                  >
                    Send OTP to Email
                  </IonButton>
                ) : (
                  <IonItem
                    lines="none"
                    style={{ marginBottom: '0.9rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                  >
                    <IonLabel position="stacked">Enter OTP Code</IonLabel>
                    <IonInput 
                      required 
                      type="text" 
                      value={otpInput} 
                      onIonInput={(e) => setOtpInput(e.detail.value!.replace(/\D/g, '').slice(0, 6))} 
                      placeholder="6-digit code" 
                      maxlength={6}
                    />
                    <IonButton
                      slot="end"
                      fill="clear"
                      size="small"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpInput('');
                        setGeneratedOtp('');
                        localStorage.removeItem('signup_otp');
                      }}
                      style={{ '--color': '#6b7280', fontSize: '0.75rem' }}
                    >
                      Change Email
                    </IonButton>
                  </IonItem>
                )}

                <IonItem
                  lines="none"
                  style={{ marginBottom: '0.9rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                >
                  <IonLabel position="stacked">Password</IonLabel>
                  <IonInput 
                    required 
                    type="password" 
                    value={password} 
                    onIonInput={(e) => setPassword(e.detail.value!)} 
                    placeholder="At least 4 characters"
                  />
                </IonItem>

                <IonItem
                  lines="none"
                  style={{ marginBottom: '0.9rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                >
                  <IonLabel position="stacked">Confirm Password</IonLabel>
                  <IonInput 
                    required 
                    type="password" 
                    value={confirmPassword} 
                    onIonInput={(e) => setConfirmPassword(e.detail.value!)} 
                  />
                </IonItem>

                <IonItem
                  lines="none"
                  style={{ marginBottom: '1.1rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                >
                  <IonLabel position="stacked">Select Account Type</IonLabel>
                  <IonSelect
                    interface="popover"
                    placeholder="Choose role"
                    required
                    value={role}
                    onIonChange={(e) => setRole(e.detail.value)}
                    style={{ paddingLeft: 0 }}
                  >
                    <IonSelectOption value="resident">Resident</IonSelectOption>
                    <IonSelectOption value="collector">Garbage Collector</IonSelectOption>
                  </IonSelect>
                </IonItem>

                <IonButton
                  type="submit"
                  expand="block"
                  shape="round"
                  disabled={isLoading}
                  style={{
                    '--background': '#16a34a',
                    '--background-activated': '#15803d',
                    marginTop: '0.4rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  {isLoading ? 'Creating Account...' : 'Sign Up'}
                </IonButton>

                <IonButton
                  expand="block"
                  shape="round"
                  fill="clear"
                  style={{ '--color': '#16a34a', fontSize: '0.9rem' }}
                  onClick={() => history.push('/login')}
                >
                  Already have an account? Log In
                </IonButton>
              </form>
            </div>
          </div>
        </div>

        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header={alertMessage.includes('successfully') ? 'Success' : 'Error'}
          message={alertMessage}
          buttons={['OK']}
        />
      </IonContent>
    </IonPage>
  );
};

export default SignUpPage;

