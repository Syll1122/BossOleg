// src/pages/resident/ProfilePage.tsx

import React, { useState, useEffect } from 'react';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons, IonIcon, IonInput, IonItem, IonLabel, IonAlert, IonSpinner } from '@ionic/react';
import { arrowBackOutline, personOutline, homeOutline, callOutline, createOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import useCurrentUser from '../../state/useCurrentUser';
import { databaseService } from '../../services/database';
import { getCurrentUserId } from '../../utils/auth';

const ProfilePage: React.FC = () => {
  const history = useHistory();
  const { user } = useCurrentUser();
  const [name, setName] = useState(user?.name || '');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertHeader, setAlertHeader] = useState('');
  const [hasProfileData, setHasProfileData] = useState(false);

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
          setPhoneNumber(account.phoneNumber || '');
          
          // Check if profile is complete
          const hasData = account.address && account.phoneNumber;
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

    if (!phoneNumber.trim()) {
      setAlertHeader('Validation Error');
      setAlertMessage('Please enter your phone number.');
      setShowAlert(true);
      return;
    }

    // Phone number validation (basic)
    const phoneRegex = /^[0-9+\-\s()]+$/;
    if (!phoneRegex.test(phoneNumber)) {
      setAlertHeader('Validation Error');
      setAlertMessage('Please enter a valid phone number.');
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
        phoneNumber: phoneNumber.trim(),
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
          {hasProfileData && !isEditing && (
            <IonButtons slot="end">
              <IonButton onClick={() => setIsEditing(true)}>
                <IonIcon icon={createOutline} />
              </IonButton>
            </IonButtons>
          )}
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

                    <IonItem
                      lines="none"
                      style={{ marginBottom: '1.5rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                    >
                      <IonIcon slot="start" icon={callOutline} style={{ color: '#16a34a', fontSize: '1.2rem' }} />
                      <IonLabel position="stacked">Phone Number</IonLabel>
                      <IonInput required type="tel" value={phoneNumber} onIonInput={(e) => setPhoneNumber(e.detail.value!)} placeholder="09xx xxx xxxx" />
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
                      style={{ marginBottom: '1.5rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                    >
                      <IonIcon slot="start" icon={callOutline} style={{ color: '#16a34a', fontSize: '1.2rem' }} />
                      <IonLabel>
                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Phone Number</h3>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#6b7280' }}>{phoneNumber || 'Not set'}</p>
                      </IonLabel>
                    </IonItem>
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

