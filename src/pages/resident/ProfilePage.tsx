// src/pages/resident/ProfilePage.tsx

import React, { useState } from 'react';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons, IonIcon, IonInput, IonItem, IonLabel } from '@ionic/react';
import { arrowBackOutline, personOutline, homeOutline, callOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import useCurrentUser from '../../state/useCurrentUser';

const ProfilePage: React.FC = () => {
  const history = useHistory();
  const { user } = useCurrentUser();
  const [name, setName] = useState(user?.name || '');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleSave = () => {
    // TODO: Save to backend
    history.goBack();
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
                  style={{
                    '--background': '#16a34a',
                    '--background-activated': '#15803d',
                  }}
                >
                  Save Changes
                </IonButton>
              </form>
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ProfilePage;

