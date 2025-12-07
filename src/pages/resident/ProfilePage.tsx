// src/pages/resident/ProfilePage.tsx

import React, { useState, useEffect } from 'react';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons, IonIcon, IonInput, IonItem, IonLabel, IonAlert, IonSpinner, IonText } from '@ionic/react';
import { arrowBackOutline, personOutline, homeOutline, callOutline, createOutline, locationOutline, busOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import useCurrentUser from '../../state/useCurrentUser';
import { databaseService } from '../../services/database';
import { getCurrentUserId } from '../../utils/auth';

const ProfilePage: React.FC = () => {
  const history = useHistory();
  const { user } = useCurrentUser();
  const [name, setName] = useState(user?.name || '');
  const [address, setAddress] = useState('');
  const [barangay, setBarangay] = useState('');
  const [barangaySearch, setBarangaySearch] = useState('');
  const [showBarangayDropdown, setShowBarangayDropdown] = useState(false);
  const [barangays, setBarangays] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingBarangays, setIsLoadingBarangays] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [truckNo, setTruckNo] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertHeader, setAlertHeader] = useState('');
  const [hasProfileData, setHasProfileData] = useState(false);

  // Load barangays from database
  useEffect(() => {
    const loadBarangays = async () => {
      setIsLoadingBarangays(true);
      try {
        await databaseService.init();
        const barangayList = await databaseService.getAllBarangays();
        setBarangays(barangayList);
      } catch (error) {
        console.error('Error loading barangays:', error);
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

  // Load profile data from database when component mounts
  useEffect(() => {
    const loadProfile = async () => {
      try {
        await databaseService.init();
        const userId = getCurrentUserId();
        
        if (!userId) {
          setAlertHeader('Error');
          setAlertMessage('You must be logged in to view your profile.');
          setShowAlert(true);
          setIsLoading(false);
          return;
        }

        // Get account from database by ID
        const account = await databaseService.getAccountById(userId);

        if (account) {
          setName(account.name || '');
          setAddress(account.address || '');
          setBarangay(account.barangay || '');
          setPhoneNumber(account.phoneNumber || '');
          setTruckNo(account.truckNo || '');
          
          // Check if profile is complete
          const hasData = account.address && account.barangay && account.phoneNumber;
          setHasProfileData(!!hasData);
          setIsEditing(false); // Always start in view mode, user can click edit button
        } else {
          // If account not found, use current user data
          setName(user?.name || '');
          setIsEditing(true); // Start in edit mode if no account
        }
      } catch (error: any) {
        console.error('Error loading profile:', error);
        setAlertHeader('Error');
        setAlertMessage('Failed to load profile data. Please try again.');
        setShowAlert(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      setAlertHeader('Validation Error');
      setAlertMessage('Please enter your full name.');
      setShowAlert(true);
      return;
    }

    if (!address.trim()) {
      setAlertHeader('Validation Error');
      setAlertMessage('Please enter your address.');
      setShowAlert(true);
      return;
    }

    if (!barangay.trim()) {
      setAlertHeader('Validation Error');
      setAlertMessage('Please select your barangay.');
      setShowAlert(true);
      return;
    }

    if (!phoneNumber.trim()) {
      setAlertHeader('Validation Error');
      setAlertMessage('Please enter your phone number.');
      setShowAlert(true);
      return;
    }

    // Phone number validation - must be exactly 11 digits and start with 09
    const phoneDigits = phoneNumber.replace(/\D/g, '');
    const phoneRegex = /^09[0-9]{9}$/;
    if (!phoneRegex.test(phoneDigits)) {
      setAlertHeader('Validation Error');
      setAlertMessage('Please enter a valid 11-digit phone number starting with 09.');
      setShowAlert(true);
      return;
    }

    setIsSaving(true);

    try {
      await databaseService.init();
      const userId = getCurrentUserId();

      if (!userId) {
        setAlertHeader('Error');
        setAlertMessage('You must be logged in to save your profile.');
        setShowAlert(true);
        setIsSaving(false);
        return;
      }

      // Get account to verify it exists
      const account = await databaseService.getAccountById(userId);

      if (!account) {
        setAlertHeader('Error');
        setAlertMessage('Account not found. Please log in again.');
        setShowAlert(true);
        setIsSaving(false);
        return;
      }

      // Update account with profile data
      await databaseService.updateAccount(userId, {
        name: name.trim(),
        address: address.trim(),
        barangay: barangay.trim(),
        phoneNumber: phoneNumber.replace(/\D/g, '').slice(0, 11),
      });

      // Update localStorage with new name
      localStorage.setItem('watch_user_name', name.trim());

      setHasProfileData(true);
      setIsEditing(false);
      
      setAlertHeader('Success');
      setAlertMessage('Profile updated successfully!');
      setShowAlert(true);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      setAlertHeader('Error');
      setAlertMessage(error.message || 'Failed to save profile. Please try again.');
      setShowAlert(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': '#16a34a', '--color': '#ecfdf3' }}>
          <IonButtons slot="start">
            <IonButton onClick={() => history.goBack()}>
              <IonIcon icon={arrowBackOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>Profile</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <div style={{ padding: '1.5rem', background: '#ecfdf3', minHeight: '100%' }}>
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <IonSpinner name="crescent" />
              </div>
            ) : (
              <div className="watch-card" style={{ padding: '1.5rem 1.4rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      backgroundColor: '#ecfdf3',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IonIcon icon={personOutline} style={{ fontSize: '2rem', color: '#16a34a' }} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{user?.name || 'User'}</h2>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#6b7280' }}>{user?.role || 'Resident'}</p>
                  </div>
                </div>

                {isEditing ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    <IonItem
                      lines="none"
                      style={{ marginBottom: '1rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                    >
                      <IonIcon slot="start" icon={personOutline} style={{ color: '#16a34a', fontSize: '1.2rem' }} />
                      <IonLabel position="stacked">Full Name</IonLabel>
                      <IonInput required value={name} onIonInput={(e) => setName(e.detail.value!)} placeholder="Enter your full name" />
                    </IonItem>

                    <IonItem
                      lines="none"
                      style={{ marginBottom: '1rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                    >
                      <IonIcon slot="start" icon={homeOutline} style={{ color: '#16a34a', fontSize: '1.2rem' }} />
                      <IonLabel position="stacked">Address</IonLabel>
                      <IonInput required value={address} onIonInput={(e) => setAddress(e.detail.value!)} placeholder="Enter your address" />
                    </IonItem>

                    <div style={{ position: 'relative', marginBottom: '1rem' }}>
                      <IonItem
                        lines="none"
                        style={{ borderRadius: 14, '--background': '#f9fafb' } as any}
                      >
                        <IonIcon slot="start" icon={locationOutline} style={{ color: '#16a34a', fontSize: '1.2rem' }} />
                        <IonLabel position="stacked">Barangay</IonLabel>
                        <IonInput 
                          required 
                          value={barangaySearch || barangay}
                          onIonInput={(e) => {
                            const value = e.detail.value!;
                            setBarangaySearch(value);
                            setShowBarangayDropdown(true);
                            const exactMatch = barangays.find(b => b.name.toLowerCase() === value.toLowerCase());
                            if (exactMatch) {
                              setBarangay(exactMatch.name);
                              setBarangaySearch('');
                              setShowBarangayDropdown(false);
                            } else {
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
                            setTimeout(() => {
                              setShowBarangayDropdown(false);
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
                      style={{ marginBottom: '1.5rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                    >
                      <IonIcon slot="start" icon={callOutline} style={{ color: '#16a34a', fontSize: '1.2rem' }} />
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

                    <IonButton
                      type="submit"
                      expand="block"
                      shape="round"
                      disabled={isSaving}
                      style={{
                        '--background': '#16a34a',
                        '--background-activated': '#15803d',
                      }}
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </IonButton>
                    
                    {hasProfileData && (
                      <IonButton
                        type="button"
                        expand="block"
                        shape="round"
                        fill="clear"
                        onClick={() => setIsEditing(false)}
                        style={{ marginTop: '0.5rem', '--color': '#6b7280' }}
                      >
                        Cancel
                      </IonButton>
                    )}
                  </form>
                ) : (
                  <div>
                    <IonItem
                      lines="none"
                      style={{ marginBottom: '1rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                    >
                      <IonIcon slot="start" icon={personOutline} style={{ color: '#16a34a', fontSize: '1.2rem' }} />
                      <IonLabel>
                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Full Name</h3>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#6b7280' }}>{name || 'Not set'}</p>
                      </IonLabel>
                    </IonItem>

                    <IonItem
                      lines="none"
                      style={{ marginBottom: '1rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                    >
                      <IonIcon slot="start" icon={homeOutline} style={{ color: '#16a34a', fontSize: '1.2rem' }} />
                      <IonLabel>
                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Address</h3>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#6b7280' }}>{address || 'Not set'}</p>
                      </IonLabel>
                    </IonItem>

                    <IonItem
                      lines="none"
                      style={{ marginBottom: '1rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                    >
                      <IonIcon slot="start" icon={locationOutline} style={{ color: '#16a34a', fontSize: '1.2rem' }} />
                      <IonLabel>
                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Barangay</h3>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#6b7280' }}>{barangay || 'Not set'}</p>
                      </IonLabel>
                    </IonItem>

                    <IonItem
                      lines="none"
                      style={{ marginBottom: user?.role === 'collector' ? '1rem' : '1.5rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                    >
                      <IonIcon slot="start" icon={callOutline} style={{ color: '#16a34a', fontSize: '1.2rem' }} />
                      <IonLabel>
                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Phone Number</h3>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#6b7280' }}>{phoneNumber || 'Not set'}</p>
                      </IonLabel>
                    </IonItem>

                    {user?.role === 'collector' && (
                      <IonItem
                        lines="none"
                        style={{ marginBottom: '1.5rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                      >
                        <IonIcon slot="start" icon={busOutline} style={{ color: '#16a34a', fontSize: '1.2rem' }} />
                        <IonLabel>
                          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Truck Number</h3>
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#6b7280' }}>{truckNo || 'Not assigned'}</p>
                        </IonLabel>
                      </IonItem>
                    )}

                    <IonButton
                      expand="block"
                      shape="round"
                      onClick={() => setIsEditing(true)}
                      style={{
                        '--background': '#16a34a',
                        '--background-activated': '#15803d',
                        marginTop: '1rem',
                      }}
                    >
                      <IonIcon icon={createOutline} slot="start" />
                      Edit Profile
                    </IonButton>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header={alertHeader}
          message={alertMessage}
          buttons={['OK']}
        />
      </IonContent>
    </IonPage>
  );
};

export default ProfilePage;

