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
  const sendOTP = async () => {
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAlertMessage('Please enter a valid email address first');
      setShowAlert(true);
      return;
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
        setOtpSent(true);
        setAlertMessage(`OTP has been sent to ${email}. Please check your inbox.`);
        setShowAlert(true);
      } else {
        // Fallback: Show OTP in alert (for development/testing)
        // In production, configure EmailJS in src/services/emailService.ts
        setOtpSent(true);
        setAlertMessage(`OTP sent to ${email}. Your OTP code is: ${otp}. Please configure EmailJS in src/services/emailService.ts for production use.`);
        setShowAlert(true);
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      // Fallback for development
      setOtpSent(true);
      setAlertMessage(`OTP sent to ${email}. Your OTP code is: ${otp}. Please configure EmailJS in src/services/emailService.ts for production use.`);
      setShowAlert(true);
    }
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

    // Phone number validation - must be exactly 11 digits and start with 09
    const phoneDigits = phoneNumber.replace(/\D/g, '');
    const phoneRegex = /^09[0-9]{9}$/;
    if (!phoneRegex.test(phoneDigits)) {
      setAlertMessage('Please enter a valid 11-digit phone number starting with 09');
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

      // Create account in local database
      await databaseService.createAccount({
        email: email.toLowerCase().trim(),
        username: username.trim(),
        password, // In production, hash this password
        name: name.trim() || username.trim(),
        role,
        truckNo: role === 'collector' ? truckNo : undefined,
        address: address.trim(),
        barangay: barangay.trim(),
        phoneNumber: phoneNumber.replace(/\D/g, '').slice(0, 11),
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
                  style={{ marginBottom: '0.9rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                >
                  <IonLabel position="stacked">Address</IonLabel>
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
                    style={{ borderRadius: 14, '--background': '#f9fafb' } as any}
                  >
                    <IonLabel position="stacked">Barangay</IonLabel>
                    <IonInput 
                      required 
                      value={barangaySearch || barangay}
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
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '14px',
                        marginTop: '4px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 1000,
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      {isLoadingBarangays ? (
                        <div style={{ padding: '12px 16px', fontSize: '0.9rem', color: '#6b7280', textAlign: 'center' }}>
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
                            borderBottom: '1px solid #f3f4f6',
                            backgroundColor: barangay === bg.name ? '#ecfdf3' : '#ffffff',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f9fafb';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = barangay === bg.name ? '#ecfdf3' : '#ffffff';
                          }}
                        >
                          <IonText style={{ fontSize: '0.9rem', color: '#111827' }}>
                            {bg.name}
                          </IonText>
                        </div>
                      ))}
                      {filteredBarangays.length === 0 && (
                        <div style={{ padding: '12px 16px', fontSize: '0.9rem', color: '#6b7280', textAlign: 'center' }}>
                          No barangay found. Please check your spelling.
                        </div>
                      )}
                      {filteredBarangays.length > 10 && (
                        <div style={{ padding: '8px 16px', fontSize: '0.8rem', color: '#6b7280', textAlign: 'center', borderTop: '1px solid #f3f4f6' }}>
                          Showing first 10 of {filteredBarangays.length} results. Type to narrow down.
                        </div>
                      )}
                        </>
                      ) : (
                        <div style={{ padding: '12px 16px', fontSize: '0.9rem', color: '#6b7280', textAlign: 'center' }}>
                          No barangay found. Please check your spelling.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <IonItem
                  lines="none"
                  style={{ marginBottom: '0.9rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                >
                  <IonLabel position="stacked">Phone Number</IonLabel>
                  <IonInput 
                    required 
                    type="tel"
                    inputMode="numeric"
                    value={phoneNumber} 
                    onIonInput={(e) => {
                      // Only allow digits and limit to 11 digits - remove any non-numeric characters
                      let value = e.detail.value!.replace(/[^0-9]/g, '').slice(0, 11);
                      
                      // Ensure it starts with 09 - if user types something else, auto-correct
                      if (value.length === 1 && value !== '0') {
                        value = '0';
                      } else if (value.length === 2 && value[0] === '0' && value[1] !== '9') {
                        value = '09';
                      } else if (value.length >= 2 && value[0] !== '0') {
                        // If first digit is not 0, replace with 0
                        value = '0' + value.slice(1, 11);
                      } else if (value.length >= 2 && value[0] === '0' && value[1] !== '9') {
                        // If second digit is not 9, replace with 9
                        value = '09' + value.slice(2, 11);
                      }
                      
                      setPhoneNumber(value);
                    }}
                    onKeyDown={(e) => {
                      // Prevent non-numeric keys (except backspace, delete, tab, arrow keys)
                      const key = e.key;
                      if (!/[0-9]/.test(key) && 
                          !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key) &&
                          !(e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                      }
                    }}
                    placeholder="09xxxxxxxxx (must start with 09)" 
                    maxlength={11}
                  />
                </IonItem>

                <IonItem
                  lines="none"
                  style={{ marginBottom: '0.9rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                >
                  <IonLabel position="stacked">Select Account Type</IonLabel>
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
                    <IonLabel position="stacked">Select Truck Number</IonLabel>
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

