// src/pages/resident/ReportPage.tsx

import React, { useState, useEffect } from 'react';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons, IonIcon, IonInput, IonItem, IonLabel, IonTextarea, IonRadioGroup, IonRadio, IonAlert, IonSpinner, IonSelect, IonSelectOption, IonText } from '@ionic/react';
import { arrowBackOutline, documentTextOutline, listOutline } from 'ionicons/icons';
import { useHistory, useLocation } from 'react-router-dom';
import { databaseService } from '../../services/database';
import NotificationBell from '../../components/NotificationBell';
import useCurrentUser from '../../state/useCurrentUser';
import { getCurrentUserId } from '../../utils/auth';

// Available trucks in the system
const AVAILABLE_TRUCKS = [
  'BCG 12*5',
  'BCG 13*6',
  'BCG 14*7',
];

const ReportPage: React.FC = () => {
  const history = useHistory();
  const location = useLocation<{ truckNo?: string } | undefined>();
  const { user } = useCurrentUser();
  const [reportType, setReportType] = useState<'type' | 'select' | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [customReport, setCustomReport] = useState('');
  const [barangay, setBarangay] = useState('');
  const [barangaySearch, setBarangaySearch] = useState('');
  const [showBarangayDropdown, setShowBarangayDropdown] = useState(false);
  const [barangays, setBarangays] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingBarangays, setIsLoadingBarangays] = useState(false);
  const [truckNo, setTruckNo] = useState('');
  const [hasAddress, setHasAddress] = useState(false);
  const [truckFromMarker, setTruckFromMarker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertHeader, setAlertHeader] = useState('');

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

  // Load profile address and truck number from navigation state
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await databaseService.init();
        
        // Get truck number from location state (if coming from truck marker)
        if (location.state?.truckNo) {
          setTruckNo(location.state.truckNo);
          setTruckFromMarker(true);
        }
        
        // Load user's barangay from profile
        const userId = getCurrentUserId();
        if (userId) {
          const account = await databaseService.getAccountById(userId);
          if (account?.barangay) {
            setBarangay(account.barangay);
            setHasAddress(true);
          }
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };

    loadInitialData();
  }, [location.state]);

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
      setAlertMessage(hasAddress ? 'Please update your barangay in Profile to use it here, or enter a barangay.' : 'Please enter your barangay.');
      setShowAlert(true);
      return;
    }

    if (!truckNo.trim()) {
      setAlertHeader('Validation Error');
      setAlertMessage(truckFromMarker ? 'Truck number is required.' : 'Please select a truck number.');
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
          <IonButtons slot="end">
            <NotificationBell />
          </IonButtons>
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

                  <div style={{ position: 'relative', marginBottom: '1rem' }}>
                    <IonItem
                      lines="none"
                      style={{ borderRadius: 14, '--background': hasAddress ? '#f3f4f6' : '#f9fafb' } as any}
                    >
                      <IonLabel position="stacked">Barangay</IonLabel>
                      {hasAddress ? (
                        <IonInput 
                          required 
                          value={barangay} 
                          readonly
                          style={{ '--color': '#6b7280', cursor: 'not-allowed' } as any}
                          placeholder="Barangay from profile"
                        />
                      ) : (
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
                            if (!hasAddress) {
                              setShowBarangayDropdown(true);
                              if (barangay) {
                                setBarangaySearch(barangay);
                              }
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
                      )}
                    </IonItem>
                    {!hasAddress && showBarangayDropdown && (
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
                    <IonLabel position="stacked">Truck No</IonLabel>
                    {truckFromMarker ? (
                      <IonInput 
                        required 
                        value={truckNo} 
                        readonly
                        style={{ '--color': '#6b7280', cursor: 'not-allowed' } as any}
                        placeholder="Truck number from selection"
                      />
                    ) : (
                      <IonSelect
                        value={truckNo}
                        placeholder="Select truck number"
                        onIonChange={(e) => setTruckNo(e.detail.value)}
                        interface="popover"
                      >
                        {AVAILABLE_TRUCKS.map((truck) => (
                          <IonSelectOption key={truck} value={truck}>
                            {truck}
                          </IonSelectOption>
                        ))}
                      </IonSelect>
                    )}
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

