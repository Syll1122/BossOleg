// src/pages/SignUpPage.tsx

import React, { useState, useEffect } from 'react';
import { IonPage, IonContent, IonInput, IonItem, IonLabel, IonButton, IonText, IonSelect, IonSelectOption, IonAlert } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { databaseService } from '../services/database';
import { sendOTPEmail } from '../services/emailService';
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
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResendingOTP, setIsResendingOTP] = useState(false);
  const [truckNo, setTruckNo] = useState('');
  const [availableTrucks, setAvailableTrucks] = useState<string[]>([]);
  const [isLoadingTrucks, setIsLoadingTrucks] = useState(false);
  const [address, setAddress] = useState('');
  const [barangay, setBarangay] = useState('');
  const [barangaySearch, setBarangaySearch] = useState('');
  const [showBarangayDropdown, setShowBarangayDropdown] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  // Available trucks in the system
  const ALL_TRUCKS = ['BCG 12*5', 'BCG 13*6', 'BCG 14*7'];

  // Barangays loaded from database
  const [barangays, setBarangays] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingBarangays, setIsLoadingBarangays] = useState(false);

  // Load barangays from database on component mount
  useEffect(() => {
    const loadBarangays = async () => {
      setIsLoadingBarangays(true);
      try {
        await databaseService.init();
        const barangayList = await databaseService.getAllBarangays();
        setBarangays(barangayList);
      } catch (error) {
        console.error('Error loading barangays:', error);
        // Fallback to empty array - will use default from database service
        setBarangays([]);
      } finally {
        setIsLoadingBarangays(false);
      }
    };

    loadBarangays();
  }, []);

  // Filter barangays based on search input
  const filteredBarangays = barangaySearch
    ? barangays.filter(b =>
        b.name.toLowerCase().includes(barangaySearch.toLowerCase())
      )
    : barangays;

  // Countdown timer for resend OTP cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Load available trucks when role changes to collector
  useEffect(() => {
    const loadAvailableTrucks = async () => {
      if (role === 'collector') {
        setIsLoadingTrucks(true);
        try {
          await databaseService.init();
          const collectors = await databaseService.getAccountsByRole('collector');
          const assignedTrucks = collectors
            .map((c) => c.truckNo)
            .filter((truck): truck is string => !!truck);
          const available = ALL_TRUCKS.filter((truck) => !assignedTrucks.includes(truck));
          setAvailableTrucks(available);
        } catch (error) {
          console.error('Error loading available trucks:', error);
          setAvailableTrucks(ALL_TRUCKS); // Fallback to all trucks
        } finally {
          setIsLoadingTrucks(false);
        }
      } else {
        setAvailableTrucks([]);
        setTruckNo('');
      }
    };

    loadAvailableTrucks();
  }, [role]);

  // Generate OTP code
  const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Send OTP via email using EmailJS or similar service
  const sendOTP = async (isResend: boolean = false) => {
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAlertMessage('Please enter a valid email address first');
      setShowAlert(true);
      return;
    }

    if (isResend) {
      setIsResendingOTP(true);
    }

    const otp = generateOTP();
    setGeneratedOtp(otp);
    setOtpInput('');
    
    // Store OTP with expiration (5 minutes)
    const otpData = {
      code: otp,
      email: email.toLowerCase().trim(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    };
    localStorage.setItem('signup_otp', JSON.stringify(otpData));

    try {
      const emailSent = await sendOTPEmail(email, otp);
      
      if (emailSent) {
        // Successfully sent - set cooldown timer (10 seconds)
        setOtpSent(true);
        setResendCooldown(10); // 10 second cooldown
        if (isResend) {
          setAlertMessage('OTP resent successfully!');
          setShowAlert(true);
        } else {
          // First time sending OTP
          setAlertMessage('OTP sent successfully!');
          setShowAlert(true);
        }
      } else {
        // Email failed to send - show error
        setAlertMessage(`Failed to send OTP email. Please try again.`);
        setShowAlert(true);
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      // Show error message if something went wrong
      setAlertMessage(`Error sending OTP email. Please try again.`);
      setShowAlert(true);
    } finally {
      if (isResend) {
        setIsResendingOTP(false);
      }
    }
  };

  // Handle resend OTP
  const handleResendOTP = async () => {
    if (resendCooldown > 0) {
      return; // Still in cooldown, do nothing
    }
    await sendOTP(true);
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
    if (!email || !username || !password || !confirmPassword || !role || !name.trim() || !address.trim() || !barangay.trim() || !phoneNumber.trim()) {
      setAlertMessage('Please fill in all fields');
      setShowAlert(true);
      setIsLoading(false);
      return;
    }

    // Phone number validation - must be exactly 9 digits (after "09")
    if (!phoneNumber || phoneNumber.length !== 9) {
      setAlertMessage('Please enter a complete 11-digit phone number');
      setShowAlert(true);
      setIsLoading(false);
      return;
    }

    // Truck number validation for collectors
    if (role === 'collector' && !truckNo) {
      setAlertMessage('Please select a truck number');
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
      // Validate truck number is not already taken (for collectors)
      if (role === 'collector' && truckNo) {
        const existingAccount = await databaseService.getAccountByTruckNo(truckNo);
        if (existingAccount) {
          setAlertMessage('This truck number is already assigned to another collector');
          setShowAlert(true);
          setIsLoading(false);
          return;
        }
      }

      // Create account in Supabase
      // Note: registrationStatus will be automatically set to 'pending' for collectors in createAccount
      await databaseService.createAccount({
        email: email.toLowerCase().trim(),
        username: username.trim(),
        password, // In production, hash this password
        name: name.trim() || username.trim(),
        role,
        truckNo: role === 'collector' ? truckNo : undefined,
        address: address.trim(),
        barangay: barangay.trim(),
        phoneNumber: '09' + phoneNumber.replace(/\D/g, '').slice(0, 9), // Prepend "09" to the 9 digits
      });

      // Clear OTP data
      localStorage.removeItem('signup_otp');

      // Success - redirect to login
      if (role === 'collector') {
        setAlertMessage('Account created successfully! Your registration is pending approval. You will receive an email once approved.');
      } else {
        setAlertMessage('Account created successfully! Please log in.');
      }
      setShowAlert(true);
      
      // Redirect after alert is dismissed
      setTimeout(() => {
        history.push('/login');
      }, 3000);
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
            background: '#0a0a0a',
          }}
        >
          <div style={{ width: '100%', maxWidth: 380 }}>
            {/* Illustration */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '1.5rem',
              }}
            >
              <div
                style={{
                  width: 220,
                  height: 160,
                  borderRadius: 28,
                  background:
                    'linear-gradient(135deg, #22c55e 0%, #4ade80 25%, #16a34a 50%, #3b82f6 75%, #22c55e 100%)',
                  backgroundSize: '200% 200%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 20px 50px rgba(34, 197, 94, 0.5), 0 0 40px rgba(59, 130, 246, 0.3), 0 10px 20px rgba(0, 0, 0, 0.5)',
                  position: 'relative',
                  overflow: 'hidden',
                  animation: 'gradientShift 8s ease infinite',
                }}
              >
                <style>
                  {`
                    @keyframes gradientShift {
                      0%, 100% { background-position: 0% 50%; }
                      50% { background-position: 100% 50%; }
                    }
                    @keyframes float {
                      0%, 100% { transform: translateY(0px) rotate(0deg); }
                      50% { transform: translateY(-10px) rotate(2deg); }
                    }
                    @keyframes pulse {
                      0%, 100% { transform: scale(1); }
                      50% { transform: scale(1.05); }
                    }
                    @keyframes fadeIn {
                      from { opacity: 0; transform: translateY(-10px); }
                      to { opacity: 1; transform: translateY(0); }
                    }
                  `}
                </style>
                <div style={{
                  position: 'absolute',
                  top: '-50%',
                  left: '-50%',
                  width: '200%',
                  height: '200%',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                  animation: 'pulse 3s ease-in-out infinite',
                }} />
                <span 
                  role="img" 
                  aria-label="recycling truck" 
                  style={{ 
                    fontSize: '4rem',
                    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
                    animation: 'float 3s ease-in-out infinite',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  🚛
                </span>
              </div>
            </div>

            {/* Title and subtitle */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: '2rem',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #22c55e 0%, #4ade80 50%, #3b82f6 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: '0 0 30px rgba(34, 197, 94, 0.3)',
                  letterSpacing: '-0.5px',
                }}
              >
                Sign up
              </h1>
              <p
                style={{
                  marginTop: '0.75rem',
                  fontSize: '0.95rem',
                  color: 'var(--app-text-secondary)',
                  lineHeight: '1.5',
                }}
              >
                Create an account to manage your waste collection.
              </p>
            </div>

            <div style={{ padding: '0 0.25rem' }}>
              <form onSubmit={onSubmit}>
                <IonItem
                  lines="none"
                  style={{ 
                    marginBottom: '1rem', 
                    borderRadius: 16, 
                    '--background': 'var(--app-surface-elevated)', 
                    '--color': 'var(--app-text-primary)', 
                    border: '1px solid var(--app-border)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    transition: 'all 0.3s ease',
                  } as any}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#22c55e';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(34, 197, 94, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#2a2a2a';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                  }}
                >
                  <IonLabel position="stacked" style={{ '--color': '#b0b0b0' } as any}>Full Name</IonLabel>
                  <IonInput 
                    required 
                    value={name} 
                    onIonInput={(e) => handleNameChange(e.detail.value!)} 
                    placeholder="Your name (letters only)" 
                  />
                </IonItem>

                <IonItem
                  lines="none"
                  style={{ 
                    marginBottom: '1rem', 
                    borderRadius: 16, 
                    '--background': 'var(--app-surface-elevated)', 
                    '--color': 'var(--app-text-primary)', 
                    border: '1px solid var(--app-border)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    transition: 'all 0.3s ease',
                  } as any}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#22c55e';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(34, 197, 94, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#2a2a2a';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                  }}
                >
                  <IonLabel position="stacked" style={{ '--color': '#b0b0b0' } as any}>Username</IonLabel>
                  <IonInput 
                    required 
                    value={username} 
                    onIonInput={(e) => setUsername(e.detail.value!)} 
                    placeholder="Choose a username" 
                  />
                </IonItem>

                <IonItem
                  lines="none"
                  style={{ 
                    marginBottom: '1rem', 
                    borderRadius: 16, 
                    '--background': 'var(--app-surface-elevated)', 
                    '--color': 'var(--app-text-primary)', 
                    border: '1px solid var(--app-border)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    transition: 'all 0.3s ease',
                  } as any}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#22c55e';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(34, 197, 94, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#2a2a2a';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                  }}
                >
                  <IonLabel position="stacked" style={{ '--color': '#b0b0b0' } as any}>Email</IonLabel>
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
                        setResendCooldown(0);
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
                    onClick={() => sendOTP()}
                    style={{
                      '--border-color': '#22c55e',
                      '--color': '#22c55e',
                      marginBottom: '0.9rem',
                    }}
                  >
                    Send OTP to Email
                  </IonButton>
                ) : (
                  <>
                    <IonItem
                      lines="none"
                      style={{ 
                        marginBottom: '0.5rem', 
                        borderRadius: 16, 
                        '--background': '#242424', 
                        '--color': '#ffffff', 
                        border: '1px solid #2a2a2a',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                        transition: 'all 0.3s ease',
                      } as any}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#22c55e';
                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(34, 197, 94, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#2a2a2a';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                      }}
                    >
                      <IonLabel position="stacked" style={{ '--color': '#b0b0b0' } as any}>Enter OTP Code</IonLabel>
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
                          setResendCooldown(0);
                          localStorage.removeItem('signup_otp');
                        }}
                        style={{ '--color': '#b0b0b0', fontSize: '0.75rem' }}
                      >
                        Change Email
                      </IonButton>
                    </IonItem>
                    <div style={{ marginBottom: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.5rem' }}>
                      <IonText style={{ fontSize: '0.75rem', color: '#b0b0b0' }}>
                        Didn't receive the code?
                      </IonText>
                      <IonButton
                        fill="clear"
                        size="small"
                        onClick={handleResendOTP}
                        disabled={resendCooldown > 0 || isResendingOTP}
                        style={{
                          '--color': resendCooldown > 0 ? '#808080' : '#22c55e',
                          fontSize: '0.75rem',
                          height: 'auto',
                          minHeight: 'auto',
                          margin: 0,
                          padding: '0.25rem 0.5rem',
                        }}
                      >
                        {isResendingOTP ? 'Sending...' : resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend OTP'}
                      </IonButton>
                    </div>
                  </>
                )}

                <IonItem
                  lines="none"
                  style={{ 
                    marginBottom: '1rem', 
                    borderRadius: 16, 
                    '--background': 'var(--app-surface-elevated)', 
                    '--color': 'var(--app-text-primary)', 
                    border: '1px solid var(--app-border)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    transition: 'all 0.3s ease',
                  } as any}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#22c55e';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(34, 197, 94, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#2a2a2a';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                  }}
                >
                  <IonLabel position="stacked" style={{ '--color': '#b0b0b0' } as any}>Password</IonLabel>
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
                  style={{ 
                    marginBottom: '1rem', 
                    borderRadius: 16, 
                    '--background': 'var(--app-surface-elevated)', 
                    '--color': 'var(--app-text-primary)', 
                    border: '1px solid var(--app-border)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    transition: 'all 0.3s ease',
                  } as any}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#22c55e';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(34, 197, 94, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#2a2a2a';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                  }}
                >
                  <IonLabel position="stacked" style={{ '--color': '#b0b0b0' } as any}>Confirm Password</IonLabel>
                  <IonInput 
                    required 
                    type="password" 
                    value={confirmPassword} 
                    onIonInput={(e) => setConfirmPassword(e.detail.value!)} 
                  />
                </IonItem>

                <IonItem
                  lines="none"
                  style={{ 
                    marginBottom: '1rem', 
                    borderRadius: 16, 
                    '--background': 'var(--app-surface-elevated)', 
                    '--color': 'var(--app-text-primary)', 
                    border: '1px solid var(--app-border)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    transition: 'all 0.3s ease',
                  } as any}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#22c55e';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(34, 197, 94, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#2a2a2a';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                  }}
                >
                  <IonLabel position="stacked" style={{ '--color': '#b0b0b0' } as any}>Address</IonLabel>
                  <IonInput 
                    required 
                    value={address} 
                    onIonInput={(e) => setAddress(e.detail.value!)} 
                    placeholder="Enter your address" 
                  />
                </IonItem>

                <div style={{ position: 'relative', marginBottom: '0.9rem' }}>
                  <IonItem
                    lines="none"
                    style={{ 
                      borderRadius: 16, 
                      '--background': '#242424', 
                      '--color': '#ffffff', 
                      border: '1px solid #2a2a2a',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                      transition: 'all 0.3s ease',
                    } as any}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#2a2a2a';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                    }}
                  >
                    <IonLabel position="stacked" style={{ '--color': '#b0b0b0' } as any}>Barangay</IonLabel>
                    <IonInput 
                      required 
                      value={barangaySearch || barangay}
                      style={{ '--color': '#ffffff', '--placeholder-color': '#808080', '--background': '#242424' } as any}
                      onIonInput={(e) => {
                        const value = e.detail.value!;
                        setBarangaySearch(value);
                        setShowBarangayDropdown(true);
                        // If exact match found, set barangay
                        const exactMatch = barangays.find(b => b.name.toLowerCase() === value.toLowerCase());
                        if (exactMatch) {
                          setBarangay(exactMatch.name);
                          setBarangaySearch('');
                          setShowBarangayDropdown(false);
                        } else {
                          // Clear barangay if user is typing something different
                          if (barangay && !value.startsWith(barangay)) {
                            setBarangay('');
                          }
                        }
                      }}
                      onIonFocus={() => {
                        setShowBarangayDropdown(true);
                        if (barangay) {
                          setBarangaySearch(barangay);
                        }
                      }}
                      onIonBlur={() => {
                        // Delay to allow click on dropdown items
                        setTimeout(() => {
                          setShowBarangayDropdown(false);
                          // If search doesn't match any barangay, keep the selected one
                          const matchesBarangay = barangays.some(b => b.name.toLowerCase() === barangaySearch.toLowerCase());
                          if (barangay && !matchesBarangay) {
                            setBarangaySearch('');
                          }
                        }, 200);
                      }}
                      placeholder="Search or select your barangay" 
                    />
                  </IonItem>
                  {showBarangayDropdown && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #2a2a2a',
                        borderRadius: '14px',
                        marginTop: '4px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 1000,
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      {isLoadingBarangays ? (
                        <div style={{ padding: '12px 16px', fontSize: '0.9rem', color: '#b0b0b0', textAlign: 'center' }}>
                          Loading barangays...
                        </div>
                      ) : filteredBarangays.length > 0 ? (
                        <>
                      {filteredBarangays.slice(0, 10).map((bg) => (
                        <div
                          key={bg.id}
                          onMouseDown={(e) => {
                            // Prevent blur event from firing before click
                            e.preventDefault();
                          }}
                          onClick={() => {
                            setBarangay(bg.name);
                            setBarangaySearch('');
                            setShowBarangayDropdown(false);
                          }}
                          style={{
                            padding: '12px 16px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #2a2a2a',
                            backgroundColor: barangay === bg.name ? '#242424' : '#1a1a1a',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#242424';
                            e.currentTarget.style.transform = 'translateX(4px)';
                            e.currentTarget.style.borderLeft = '3px solid #3b82f6';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = barangay === bg.name ? '#242424' : '#1a1a1a';
                            e.currentTarget.style.transform = 'translateX(0)';
                            e.currentTarget.style.borderLeft = 'none';
                          }}
                        >
                          <IonText style={{ fontSize: '0.9rem', color: '#ffffff' }}>
                            {bg.name}
                          </IonText>
                        </div>
                      ))}
                      {filteredBarangays.length === 0 && (
                        <div style={{ padding: '12px 16px', fontSize: '0.9rem', color: '#b0b0b0', textAlign: 'center' }}>
                          No barangay found. Please check your spelling.
                        </div>
                      )}
                      {filteredBarangays.length > 10 && (
                        <div style={{ padding: '8px 16px', fontSize: '0.8rem', color: '#b0b0b0', textAlign: 'center', borderTop: '1px solid #2a2a2a' }}>
                          Showing first 10 of {filteredBarangays.length} results. Type to narrow down.
                        </div>
                      )}
                        </>
                      ) : (
                        <div style={{ padding: '12px 16px', fontSize: '0.9rem', color: '#b0b0b0', textAlign: 'center' }}>
                          No barangay found. Please check your spelling.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <IonItem
                  lines="none"
                  style={{ marginBottom: '0.9rem', borderRadius: 14, '--background': '#242424', '--color': '#ffffff', border: '1px solid #2a2a2a', position: 'relative' } as any}
                >
                  <IonLabel position="stacked" style={{ '--color': '#b0b0b0' } as any}>Phone Number</IonLabel>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <span style={{
                      position: 'absolute',
                      left: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#ffffff',
                      fontWeight: '600',
                      pointerEvents: 'none',
                      userSelect: 'none',
                      zIndex: 10,
                      fontSize: '1rem',
                      lineHeight: '1'
                    }}>
                      09
                    </span>
                    <IonInput 
                      required 
                      type="tel"
                      inputMode="numeric"
                      value={phoneNumber} 
                      onIonInput={(e) => {
                        // Only allow digits, max 9 characters (after "09")
                        const value = e.detail.value!.replace(/[^0-9]/g, '').slice(0, 9);
                        setPhoneNumber(value);
                      }}
                      placeholder="XXXXXXXXX" 
                      maxlength={9}
                      style={{
                        '--padding-start': '2.5rem',
                        '--padding-end': '0.75rem',
                        '--color': '#ffffff',
                        '--placeholder-color': '#808080',
                        '--background': '#242424'
                      } as any}
                    />
                  </div>
                  {phoneNumber && phoneNumber.length < 9 && (
                    <IonText style={{ fontSize: '0.75rem', color: '#ef4444', padding: '0.25rem 0.5rem', display: 'block' }}>
                      Phone number must be 11 digits
                    </IonText>
                  )}
                </IonItem>

                <IonItem
                  lines="none"
                  style={{ 
                    marginBottom: '1rem', 
                    borderRadius: 16, 
                    '--background': 'var(--app-surface-elevated)', 
                    '--color': 'var(--app-text-primary)', 
                    border: '1px solid var(--app-border)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    transition: 'all 0.3s ease',
                  } as any}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#22c55e';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(34, 197, 94, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#2a2a2a';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                  }}
                >
                  <IonLabel position="stacked" style={{ '--color': '#b0b0b0' } as any}>Select Account Type</IonLabel>
                  <IonSelect
                    interface="popover"
                    placeholder="Choose role"
                    required
                    value={role}
                    onIonChange={(e) => {
                      setRole(e.detail.value);
                      setTruckNo(''); // Reset truck selection when role changes
                    }}
                    style={{ paddingLeft: 0 }}
                  >
                    <IonSelectOption value="resident">Resident</IonSelectOption>
                    <IonSelectOption value="collector">Garbage Collector</IonSelectOption>
                  </IonSelect>
                </IonItem>

                {role === 'collector' && (
                  <IonItem
                    lines="none"
                    style={{ marginBottom: '1.1rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                  >
                    <IonLabel position="stacked" style={{ '--color': '#b0b0b0' } as any}>Select Truck Number</IonLabel>
                    {isLoadingTrucks ? (
                      <IonText style={{ fontSize: '0.9rem', color: '#6b7280' }}>Loading available trucks...</IonText>
                    ) : availableTrucks.length > 0 ? (
                      <IonSelect
                        interface="popover"
                        placeholder="Choose truck number"
                        required
                        value={truckNo}
                        onIonChange={(e) => setTruckNo(e.detail.value)}
                        style={{ paddingLeft: 0 }}
                      >
                        {availableTrucks.map((truck) => (
                          <IonSelectOption key={truck} value={truck}>
                            {truck}
                          </IonSelectOption>
                        ))}
                      </IonSelect>
                    ) : (
                      <IonText style={{ fontSize: '0.9rem', color: '#ef4444' }}>
                        No trucks available. All trucks are assigned.
                      </IonText>
                    )}
                  </IonItem>
                )}

                <IonButton
                  type="submit"
                  expand="block"
                  shape="round"
                  disabled={isLoading}
                  style={{
                    '--background': '#22c55e',
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
                  style={{ 
                    '--color': '#22c55e', 
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    transition: 'all 0.3s ease',
                  }}
                  onClick={() => history.push('/login')}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.setProperty('--color', '#4ade80');
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.setProperty('--color', '#22c55e');
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
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

