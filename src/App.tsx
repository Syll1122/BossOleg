// src/App.tsx

import React, { useState, useEffect } from 'react';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route } from 'react-router-dom';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

import './theme/variables.css';
import './theme/global.css';
import Home from './pages/Home';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import CollectorStack from './pages/collector/CollectorStack';
import AdminTabs from './pages/admin/AdminTabs';
import ResidentTruckView from './pages/resident/ResidentTruckView';
import ProfilePage from './pages/resident/ProfilePage';
import ReportPage from './pages/resident/ReportPage';
import ReportsProgressPage from './pages/resident/ReportsProgressPage';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import SchedulePanel from './components/SchedulePanel';

setupIonicReact();

const App: React.FC = () => {
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);

  // Listen for custom event to open schedule panel from any page
  useEffect(() => {
    const handleOpenSchedulePanel = () => {
      setShowSchedulePanel(true);
    };

    window.addEventListener('openSchedulePanel', handleOpenSchedulePanel);
    
    return () => {
      window.removeEventListener('openSchedulePanel', handleOpenSchedulePanel);
    };
  }, []);

  return (
    <ThemeProvider>
      <NotificationProvider>
        <IonApp>
          <IonReactRouter>
            <IonRouterOutlet>
              <Route path="/" component={Home} exact />
              <Route path="/login" component={LoginPage} exact />
              <Route path="/signup" component={SignUpPage} exact />
              <Route path="/collector" component={CollectorStack} />
              <Route path="/collector/profile" component={ProfilePage} exact />
              <Route path="/admin" component={AdminTabs} />
              <Route path="/resident/truck" component={ResidentTruckView} exact />
              <Route path="/resident/profile" component={ProfilePage} exact />
              <Route path="/resident/report" component={ReportPage} exact />
              <Route path="/resident/reports" component={ReportsProgressPage} exact />
            </IonRouterOutlet>
          </IonReactRouter>
          
          {/* Global Schedule Panel - available from any page */}
          <SchedulePanel
            isOpen={showSchedulePanel}
            onClose={() => setShowSchedulePanel(false)}
          />
        </IonApp>
      </NotificationProvider>
    </ThemeProvider>
  );
};

export default App;
