// src/pages/resident/ReportsProgressPage.tsx

import React, { useState, useEffect } from 'react';
import { 
  IonPage, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonButton, 
  IonButtons, 
  IonIcon, 
  IonCard, 
  IonCardContent, 
  IonBadge, 
  IonSpinner,
  IonModal,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonRadioGroup,
  IonRadio,
  IonItem,
  IonLabel,
  IonAlert
} from '@ionic/react';
import { arrowBackOutline, checkmarkCircleOutline, timeOutline, alertCircleOutline, closeOutline, listOutline, documentTextOutline, addOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { databaseService } from '../../services/database';
import { getCurrentUserId } from '../../utils/auth';
import { Report } from '../../models/types';
import RefreshButton from '../../components/RefreshButton';
import ThemeToggle from '../../components/ThemeToggle';
import useCurrentUser from '../../state/useCurrentUser';

const ReportsProgressPage: React.FC = () => {
  const history = useHistory();
  const { user } = useCurrentUser();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateReportModal, setShowCreateReportModal] = useState(false);
  const [reportType, setReportType] = useState<'type' | 'select' | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [customReport, setCustomReport] = useState('');
  const [barangay, setBarangay] = useState('');
  const [truckNo, setTruckNo] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [showReportAlert, setShowReportAlert] = useState(false);
  const [reportAlertMessage, setReportAlertMessage] = useState('');
  const [reportAlertHeader, setReportAlertHeader] = useState('');

  const loadReports = async () => {
    setLoading(true);
    try {
      await databaseService.init();
      const userId = getCurrentUserId();
      
      if (!userId) {
        setLoading(false);
        return;
      }

      const userReports = await databaseService.getReportsByUserId(userId);
      // Sort by createdAt (newest first)
      userReports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReports(userReports);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  // Refresh function
  const handleRefresh = async () => {
    await loadReports();
  };

  const getStatusColor = (status: Report['status']) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'reviewed':
        return 'primary';
      case 'resolved':
        return 'success';
      default:
        return 'medium';
    }
  };

  const getStatusIcon = (status: Report['status']) => {
    switch (status) {
      case 'pending':
        return timeOutline;
      case 'reviewed':
        return alertCircleOutline;
      case 'resolved':
        return checkmarkCircleOutline;
      default:
        return alertCircleOutline;
    }
  };

  const getStatusText = (status: Report['status']) => {
    switch (status) {
      case 'pending':
        return 'Pending Review';
      case 'reviewed':
        return 'Under Review';
      case 'resolved':
        return 'Resolved';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Load user's barangay from profile
  useEffect(() => {
    const loadUserBarangay = async () => {
      try {
        await databaseService.init();
        const userId = getCurrentUserId();
        if (userId) {
          const account = await databaseService.getAccountById(userId);
          if (account?.barangay) {
            setBarangay(account.barangay);
          }
        }
      } catch (error) {
        console.error('Error loading user barangay:', error);
      }
    };
    loadUserBarangay();
  }, []);

  const predefinedOptions = [
    'Truck is not going in your street when it supposedly go',
    'It just pass your street',
    'Missed collection',
    'Overflowing trashbins',
  ];

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reportType) {
      setReportAlertHeader('Validation Error');
      setReportAlertMessage('Please select a report type first.');
      setShowReportAlert(true);
      return;
    }
    
    if (reportType === 'select' && !selectedOption) {
      setReportAlertHeader('Validation Error');
      setReportAlertMessage('Please select an issue.');
      setShowReportAlert(true);
      return;
    }

    if (reportType === 'type' && !customReport.trim()) {
      setReportAlertHeader('Validation Error');
      setReportAlertMessage('Please describe the issue.');
      setShowReportAlert(true);
      return;
    }

    if (!barangay.trim()) {
      setReportAlertHeader('Validation Error');
      setReportAlertMessage('Please enter your barangay.');
      setShowReportAlert(true);
      return;
    }

    if (!truckNo.trim()) {
      setReportAlertHeader('Validation Error');
      setReportAlertMessage('Please select a truck number.');
      setShowReportAlert(true);
      return;
    }

    setIsSubmittingReport(true);

    try {
      const userId = getCurrentUserId();
      if (!userId || !user) {
        setReportAlertHeader('Error');
        setReportAlertMessage('You must be logged in to submit a report.');
        setShowReportAlert(true);
        setIsSubmittingReport(false);
        return;
      }

      const account = await databaseService.getAccountById(userId);
      const userEmail = account?.email || '';

      await databaseService.createReport({
        userId: userId,
        userName: user.name,
        userEmail: userEmail,
        reportType: reportType,
        issue: reportType === 'select' ? selectedOption : customReport.trim(),
        barangay: barangay.trim(),
        truckNo: truckNo.trim(),
      });

      setReportAlertHeader('Success');
      setReportAlertMessage('Report submitted successfully! The admin will review it.');
      setShowReportAlert(true);

      // Reset form and reload reports
      setReportType(null);
      setSelectedOption('');
      setCustomReport('');
      setTruckNo('');
      setShowCreateReportModal(false);
      await loadReports();
    } catch (error: any) {
      console.error('Error submitting report:', error);
      setReportAlertHeader('Error');
      setReportAlertMessage(error.message || 'Failed to submit report. Please try again.');
      setShowReportAlert(true);
      setIsSubmittingReport(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton 
              onClick={() => history.goBack()}
              style={{
                minWidth: '48px',
                height: '48px',
              }}
            >
              <IonIcon icon={arrowBackOutline} style={{ fontSize: '1.75rem' }} />
            </IonButton>
          </IonButtons>
          <IonTitle>My Reports</IonTitle>
          <IonButtons slot="end">
            <ThemeToggle />
            <RefreshButton onRefresh={handleRefresh} variant="header" />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <div style={{ padding: '1.5rem', background: 'var(--app-bg-primary)', minHeight: '100%' }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            {/* Create Report Button */}
            <IonButton
              expand="block"
              onClick={() => setShowCreateReportModal(true)}
              style={{
                marginBottom: '1.5rem',
                '--background': '#16a34a',
                '--background-activated': '#15803d',
                borderRadius: '12px',
                height: '48px',
                fontWeight: 600
              }}
            >
              <IonIcon icon={addOutline} slot="start" />
              Create Report
            </IonButton>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                <IonSpinner />
              </div>
            ) : reports.length === 0 ? (
              <IonCard style={{ margin: '2rem 0', borderRadius: 16 }}>
                <IonCardContent style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                  <IonIcon
                    icon={alertCircleOutline}
                    style={{ fontSize: '4rem', color: 'var(--app-text-secondary)', marginBottom: '1rem' }}
                  />
                  <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 600, color: 'var(--app-text-primary)' }}>
                    No Reports Yet
                  </h2>
                  <p style={{ margin: 0, color: 'var(--app-text-secondary)', fontSize: '0.9rem' }}>
                    You haven't submitted any reports. Submit a report to track its progress here.
                  </p>
                </IonCardContent>
              </IonCard>
            ) : (
              <div>
                <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: 700, color: 'var(--app-text-primary)' }}>
                  Report Progress
                </h2>
                {reports.map((report) => (
                  <IonCard
                    key={report.id}
                    style={{
                      marginBottom: '1rem',
                      borderRadius: 16,
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.1)',
                    }}
                  >
                    <IonCardContent style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <IonIcon
                              icon={getStatusIcon(report.status)}
                              style={{ fontSize: '1.25rem', color: `var(--ion-color-${getStatusColor(report.status)})` }}
                            />
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--app-text-primary)' }}>
                              {report.issue.length > 60 ? `${report.issue.substring(0, 60)}...` : report.issue}
                            </h3>
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--app-text-secondary)', marginBottom: '0.25rem' }}>
                            <strong>Truck No:</strong> {report.truckNo}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--app-text-secondary)' }}>
                            <strong>Barangay:</strong> {report.barangay}
                          </div>
                        </div>
                        <IonBadge color={getStatusColor(report.status)} style={{ marginLeft: '1rem' }}>
                          {getStatusText(report.status)}
                        </IonBadge>
                      </div>

                      <div
                        style={{
                          padding: '0.75rem',
                          background: 'var(--app-surface-elevated)',
                          borderRadius: 8,
                          marginTop: '0.75rem',
                          border: '1px solid var(--app-border)',
                        }}
                      >
                        <div style={{ fontSize: '0.9rem', color: 'var(--app-text-primary)', marginBottom: '0.5rem' }}>
                          <strong>Issue:</strong> {report.issue}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--app-text-secondary)' }}>
                          <div style={{ marginBottom: '0.25rem' }}>
                            <strong>Submitted:</strong> {formatDate(report.createdAt)}
                          </div>
                          {report.updatedAt !== report.createdAt && (
                            <div>
                              <strong>Last Updated:</strong> {formatDate(report.updatedAt)}
                            </div>
                          )}
                        </div>
                      </div>
                    </IonCardContent>
                  </IonCard>
                ))}
              </div>
            )}
          </div>
        </div>
      </IonContent>

      {/* Create Report Modal */}
      <IonModal isOpen={showCreateReportModal} onDidDismiss={() => {
        setShowCreateReportModal(false);
        setReportType(null);
        setSelectedOption('');
        setCustomReport('');
        setTruckNo('');
      }}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Create Report</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => {
                setShowCreateReportModal(false);
                setReportType(null);
                setSelectedOption('');
                setCustomReport('');
                setTruckNo('');
              }}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: '1.5rem', background: 'var(--app-bg-primary)', minHeight: '100%' }}>
            <div style={{ maxWidth: 480, margin: '0 auto' }}>
              <div style={{ 
                padding: '1.5rem 1.4rem',
                background: 'var(--app-surface)',
                borderRadius: '16px',
                border: '1px solid var(--app-border)',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.1)'
              }}>
                {!reportType ? (
                  <div>
                    <h2 style={{ margin: '0 0 1rem', fontSize: '1.2rem', fontWeight: 700, color: 'var(--app-text-primary)' }}>How would you like to report?</h2>
                    
                    <button
                      type="button"
                      onClick={() => setReportType('select')}
                      style={{
                        width: '100%',
                        padding: '1rem',
                        marginBottom: '0.75rem',
                        borderRadius: 16,
                        border: '1px solid var(--app-border)',
                        background: 'var(--app-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.1)',
                        cursor: 'pointer',
                      }}
                    >
                      <IonIcon icon={listOutline} style={{ fontSize: '1.5rem', color: '#22c55e' }} />
                      <div style={{ textAlign: 'left', flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--app-text-primary)' }}>Select from options</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--app-text-secondary)', marginTop: '0.25rem' }}>Choose a predefined issue</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReportType('type')}
                      style={{
                        width: '100%',
                        padding: '1rem',
                        borderRadius: 16,
                        border: '1px solid var(--app-border)',
                        background: 'var(--app-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.1)',
                        cursor: 'pointer',
                      }}
                    >
                      <IonIcon icon={documentTextOutline} style={{ fontSize: '1.5rem', color: '#16a34a' }} />
                      <div style={{ textAlign: 'left', flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--app-text-primary)' }}>Type your report</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--app-text-secondary)', marginTop: '0.25rem' }}>Describe the issue in your own words</div>
                      </div>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReport}>
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
                                style={{ marginBottom: '0.5rem', borderRadius: 12, '--background': 'var(--app-surface-elevated)', border: '1px solid var(--app-border)' } as any}
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
                          style={{ marginBottom: '1rem', borderRadius: 14, '--background': 'var(--app-surface-elevated)', border: '1px solid var(--app-border)' } as any}
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
                      style={{ marginBottom: '1rem', borderRadius: 14, '--background': 'var(--app-surface-elevated)', border: '1px solid var(--app-border)' } as any}
                    >
                      <IonLabel position="stacked">Barangay</IonLabel>
                      <IonInput 
                        required 
                        value={barangay}
                        onIonInput={(e) => setBarangay(e.detail.value!)}
                        placeholder="Enter your barangay" 
                      />
                    </IonItem>

                    <IonItem
                      lines="none"
                      style={{ marginBottom: '1.5rem', borderRadius: 14, '--background': '#f9fafb' } as any}
                    >
                      <IonLabel position="stacked">Truck No</IonLabel>
                      <IonSelect
                        value={truckNo}
                        placeholder="Select truck number"
                        onIonChange={(e) => setTruckNo(e.detail.value)}
                        interface="popover"
                      >
                        {['BCG 12*5', 'BCG 13*6', 'BCG 14*7'].map((truck) => (
                          <IonSelectOption key={truck} value={truck}>
                            {truck}
                          </IonSelectOption>
                        ))}
                      </IonSelect>
                    </IonItem>

                    <IonButton
                      type="submit"
                      expand="block"
                      shape="round"
                      disabled={(reportType === 'select' && !selectedOption) || isSubmittingReport}
                      style={{
                        '--background': '#16a34a',
                        '--background-activated': '#15803d',
                      }}
                    >
                      {isSubmittingReport ? 'Submitting...' : 'Submit Report'}
                    </IonButton>
                  </form>
                )}
              </div>
            </div>
          </div>
        </IonContent>
      </IonModal>

      <IonAlert
        isOpen={showReportAlert}
        onDidDismiss={() => setShowReportAlert(false)}
        header={reportAlertHeader}
        message={reportAlertMessage}
        buttons={['OK']}
      />
    </IonPage>
  );
};

export default ReportsProgressPage;


