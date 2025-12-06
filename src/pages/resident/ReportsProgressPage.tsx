// src/pages/resident/ReportsProgressPage.tsx

import React, { useState, useEffect } from 'react';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons, IonIcon, IonCard, IonCardContent, IonBadge, IonSpinner } from '@ionic/react';
import { arrowBackOutline, checkmarkCircleOutline, timeOutline, alertCircleOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { databaseService } from '../../services/database';
import { getCurrentUserId } from '../../utils/auth';
import { Report } from '../../models/types';

const ReportsProgressPage: React.FC = () => {
  const history = useHistory();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReports = async () => {
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

    loadReports();
  }, []);

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

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': '#16a34a', '--color': '#ecfdf3' }}>
          <IonButtons slot="start">
            <IonButton onClick={() => history.goBack()}>
              <IonIcon icon={arrowBackOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>My Reports</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <div style={{ padding: '1.5rem', background: '#ecfdf3', minHeight: '100%' }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                <IonSpinner />
              </div>
            ) : reports.length === 0 ? (
              <IonCard style={{ margin: '2rem 0', borderRadius: 16 }}>
                <IonCardContent style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                  <IonIcon
                    icon={alertCircleOutline}
                    style={{ fontSize: '4rem', color: '#9ca3af', marginBottom: '1rem' }}
                  />
                  <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 600, color: '#374151' }}>
                    No Reports Yet
                  </h2>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                    You haven't submitted any reports. Submit a report to track its progress here.
                  </p>
                </IonCardContent>
              </IonCard>
            ) : (
              <div>
                <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
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
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#111827' }}>
                              {report.issue.length > 60 ? `${report.issue.substring(0, 60)}...` : report.issue}
                            </h3>
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                            <strong>Truck No:</strong> {report.truckNo}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
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
                          background: '#f9fafb',
                          borderRadius: 8,
                          marginTop: '0.75rem',
                        }}
                      >
                        <div style={{ fontSize: '0.9rem', color: '#374151', marginBottom: '0.5rem' }}>
                          <strong>Issue:</strong> {report.issue}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
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
    </IonPage>
  );
};

export default ReportsProgressPage;


