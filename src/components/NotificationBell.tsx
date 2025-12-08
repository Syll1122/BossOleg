// src/components/NotificationBell.tsx
// Notification bell icon component with dropdown

import React, { useState, useRef, useEffect } from 'react';
import {
  IonButton,
  IonIcon,
  IonPopover,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSpinner,
} from '@ionic/react';
import { notificationsOutline, notifications, checkmarkDoneOutline, trashOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';
import './NotificationBell.css';

const NotificationBell: React.FC = () => {
  const history = useHistory();
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const [showPopover, setShowPopover] = useState(false);
  const popover = useRef<HTMLIonPopoverElement>(null);

  const handleNotificationClick = async (notification: any) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    if (notification.link) {
      history.push(notification.link);
    }

    setShowPopover(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return '#16a34a';
      case 'warning':
        return '#f59e0b';
      case 'error':
        return '#ef4444';
      default:
        return '#3b82f6';
    }
  };

  return (
    <>
      <IonButton
        id="notification-trigger"
        fill="clear"
        onClick={() => setShowPopover(true)}
        style={{ position: 'relative' }}
      >
        <IonIcon
          icon={unreadCount > 0 ? notifications : notificationsOutline}
          style={{ fontSize: '1.5rem' }}
        />
        {unreadCount > 0 && (
          <IonBadge
            color="danger"
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              fontSize: '0.7rem',
              minWidth: '18px',
              height: '18px',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </IonBadge>
        )}
      </IonButton>

      <IonPopover
        ref={popover}
        isOpen={showPopover}
        onDidDismiss={() => setShowPopover(false)}
        trigger="notification-trigger"
        side="bottom"
        alignment="center"
        style={{ '--width': '320px', '--max-height': '500px' }}
      >
        <div style={{ width: '100%', maxHeight: '500px', display: 'flex', flexDirection: 'column', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Notifications</h3>
            {unreadCount > 0 && (
              <IonButton
                fill="clear"
                size="small"
                onClick={markAllAsRead}
                style={{ '--padding-start': '8px', '--padding-end': '8px' }}
              >
                <IonIcon icon={checkmarkDoneOutline} slot="icon-only" />
              </IonButton>
            )}
          </div>

          <div 
            className="notification-scroll-container"
            style={{ 
              maxHeight: '400px', 
              overflowY: 'auto', 
              overflowX: 'hidden',
              flex: 1,
            }}
          >
            {isLoading ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <IonSpinner />
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6b7280' }}>
                <IonIcon
                  icon={notificationsOutline}
                  style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.5 }}
                />
                <p style={{ margin: 0 }}>No notifications</p>
              </div>
            ) : (
              <IonList>
                {notifications.map((notification) => (
                  <IonItem
                    key={notification.id}
                    button
                    onClick={() => handleNotificationClick(notification)}
                    style={{
                      '--background': notification.read ? '#ffffff' : '#f0f9ff',
                      borderLeft: `3px solid ${getTypeColor(notification.type)}`,
                    }}
                  >
                    <IonLabel>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <h3
                            style={{
                              margin: '0 0 4px 0',
                              fontSize: '0.9rem',
                              fontWeight: notification.read ? 400 : 600,
                              color: notification.read ? '#6b7280' : '#111827',
                            }}
                          >
                            {notification.title}
                          </h3>
                          <p
                            style={{
                              margin: '0 0 4px 0',
                              fontSize: '0.85rem',
                              color: '#6b7280',
                              lineHeight: '1.4',
                            }}
                          >
                            {notification.message}
                          </p>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>
                            {formatTime(notification.createdAt)}
                          </p>
                        </div>
                        {!notification.read && (
                          <div
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: getTypeColor(notification.type),
                              marginLeft: '8px',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                    </IonLabel>
                    <IonButton
                      fill="clear"
                      size="small"
                      slot="end"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      style={{ '--padding-start': '4px', '--padding-end': '4px' }}
                    >
                      <IonIcon icon={trashOutline} slot="icon-only" style={{ fontSize: '1rem' }} />
                    </IonButton>
                  </IonItem>
                ))}
              </IonList>
            )}
          </div>
        </div>
      </IonPopover>
    </>
  );
};

export default NotificationBell;

