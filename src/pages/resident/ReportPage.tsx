// src/pages/resident/ReportPage.tsx

import React, { useState, useEffect } from 'react';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons, IonIcon, IonInput, IonItem, IonLabel, IonTextarea, IonRadioGroup, IonRadio, IonAlert, IonSpinner } from '@ionic/react';
import { arrowBackOutline, documentTextOutline, listOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { databaseService } from '../../services/database';
import useCurrentUser from '../../state/useCurrentUser';
import { getCurrentUserId } from '../../utils/auth';

const ReportPage: React.FC = () => {
  const history = useHistory();
  const { user } = useCurrentUser();
  const [reportType, setReportType] = useState<'type' | 'select' | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [customReport, setCustomReport] = useState('');
  const [barangay, setBarangay] = useState('');
  const [truckNo, setTruckNo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertHeader, setAlertHeader] = useState('');

  useEffect(() => {
    // Initialize database
    databaseService.init().catch((error) => {
      console.error('Database initialization error:', error);
    });
  }, []);

  const predefinedOptions = [
    'Truck is not going in your street when it supposedly go',
    'It just pass your street',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that reportType is selected
    if (!reportType) {
      setAlertHeader('Validation Error');
      setAlertMessage('Please select a report type first.');
      setShowAlert(true);
      return;
    }
    
    if (reportType === 'select' && !selectedOption) {
      setAlertHeader('Validation Error');
      setAlertMessage('Please select an issue.');
      setShowAlert(true);
      return;
    }

    if (reportType === 'type' && !customReport.trim()) {
      setAlertHeader('Validation Error');
      setAlertMessage('Please describe the issue.');
      setShowAlert(true);
      return;
    }

    if (!barangay.trim()) {
      setAlertHeader('Validation Error');
      setAlertMessage('Please enter your barangay.');
      setShowAlert(true);
      return;
    }

    if (!truckNo.trim()) {
      setAlertHeader('Validation Error');
      setAlertMessage('Please enter the truck number.');
      setShowAlert(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const userId = getCurrentUserId();
      if (!userId || !user) {
        setAlertHeader('Error');
        setAlertMessage('You must be logged in to submit a report.');
        setShowAlert(true);
        setIsSubmitting(false);
        return;
      }

      // Get user email from account
      const account = await databaseService.getAccountById(userId);
      const userEmail = account?.email || '';

      // Create report (reportType is guaranteed to be non-null at this point due to validation above)
      await databaseService.createReport({
        userId: userId,
        userName: user.name,
        userEmail: userEmail,
        reportType: reportType, // No need for non-null assertion after validation
        issue: reportType === 'select' ? selectedOption : customReport.trim(),
        barangay: barangay.trim(),
        truckNo: truckNo.trim(),
      });

      setAlertHeader('Success');
      setAlertMessage('Report submitted successfully! The admin will review it.');
      setShowAlert(true);

      // Reset form and go back after delay
      setTimeout(() => {
        history.goBack();
      }, 1500);
    } catch (error: any) {
      console.error('Error submitting report:', error);
      setAlertHeader('Error');
      setAlertMessage(error.message || 'Failed to submit report. Please try again.');
      setShowAlert(true);
      setIsSubmitting(false);
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
          <IonTitle>Report Issue</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <div style={{ padding: '1.5rem', background: '#ecfdf3', minHeight: '100%' }}>
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <div className="watch-card" style={{ padding: '1.5rem 1.4rem' }}>
              {!reportType ? (
                <div>
                  <h2 style={{ margin: '0 0 1rem', fontSize: '1.2rem', fontWeight: 700 }}>How would you like to report?</h2>
                  
                  <button
                    type="button"
                    onClick={() => setReportType('select')}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      marginBottom: '0.75rem',
                      borderRadius: 16,
                      border: 'none',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.1)',
                      cursor: 'pointer',
                    }}
                  >
                    <IonIcon icon={listOutline} style={{ fontSize: '1.5rem', color: '#16a34a' }} />
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Select from options</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>Choose a predefined issue</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReportType('type')}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      borderRadius: 16,
                      border: 'none',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.1)',
                      cursor: 'pointer',
                    }}
                  >
                    <IonIcon icon={documentTextOutline} style={{ fontSize: '1.5rem', color: '#16a34a' }} />
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Type your report</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>Describe the issue in your own words</div>
                    </div>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setReportType(null)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#16a34a',
                        fontSize: '0.85rem',
                        marginBottom: '1rem',
                        cursor: 'pointer',
                      }}
                    >
                      ← Back
                    </button>

                    {reportType === 'select' ? (
                      <div>
                        <IonLabel style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', display: 'block' }}>
                          Select an issue:
                        </IonLabel>
                        <IonRadioGroup value={selectedOption} onIonChange={(e) => setSelectedOption(e.detail.value)}>
                          {predefinedOptions.map((option, index) => (
                            <IonItem
                              key={index}
                              lines="none"
                              style={{ marginBottom: '0.5rem', borderRadius: 12, '--background': '#f9fafb' } as any}
                            >
                              <IonRadio slot="start" value={option} />
                              <IonLabel style={{ fontSize: '0.9rem' }}>{option}</IonLabel>
                            </IonItem>
                          ))}
                        </IonRadioGroup>
                      </div>
                    ) : (
                      <IonItem
                        lines="none"
                        style={{ marginBottom: '1rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                      >
                        <IonLabel position="stacked">Describe the issue</IonLabel>
                        <IonTextarea
                          required
                          value={customReport}
                          onIonInput={(e) => setCustomReport(e.detail.value!)}
                          placeholder="Type your report here..."
                          rows={4}
                        />
                      </IonItem>
                    )}
                  </div>

                  <IonItem
                    lines="none"
                    style={{ marginBottom: '1rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                  >
                    <IonLabel position="stacked">Barangay</IonLabel>
                    <IonInput required value={barangay} onIonInput={(e) => setBarangay(e.detail.value!)} placeholder="Enter barangay name" />
                  </IonItem>

                  <IonItem
                    lines="none"
                    style={{ marginBottom: '1.5rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                  >
                    <IonLabel position="stacked">Truck No</IonLabel>
                    <IonInput required value={truckNo} onIonInput={(e) => setTruckNo(e.detail.value!)} placeholder="Enter truck number" />
                  </IonItem>

                  <IonButton
                    type="submit"
                    expand="block"
                    shape="round"
                    disabled={(reportType === 'select' && !selectedOption) || isSubmitting}
                    style={{
                      '--background': '#16a34a',
                      '--background-activated': '#15803d',
                    }}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Report'}
                  </IonButton>
                </form>
              )}
            </div>
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

export default ReportPage;

