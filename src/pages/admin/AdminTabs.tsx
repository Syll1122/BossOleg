// src/pages/admin/AdminTabs.tsx

import React from 'react';
import {
  IonTabs,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
} from '@ionic/react';
import { Route, Redirect } from 'react-router-dom';
import { mapOutline, listOutline, busOutline, alertCircleOutline } from 'ionicons/icons';

// Placeholder admin pages – implement real content later
const AdminLiveMapPage: React.FC = () => <div>Admin Live Map</div>;
const AdminRoutesPage: React.FC = () => <div>Admin Routes</div>;
const AdminStreetSchedulesPage: React.FC = () => <div>Admin Street Schedules</div>;
const AdminTrucksPage: React.FC = () => <div>Admin Trucks</div>;
const AdminReportsPage: React.FC = () => <div>Admin Reports</div>;

const AdminTabs: React.FC = () => {
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route path="/admin/live-map" component={AdminLiveMapPage} exact />
        <Route path="/admin/routes" component={AdminRoutesPage} exact />
        <Route path="/admin/street-schedules" component={AdminStreetSchedulesPage} exact />
        <Route path="/admin/trucks" component={AdminTrucksPage} exact />
        <Route path="/admin/reports" component={AdminReportsPage} exact />
        <Route exact path="/admin">
          <Redirect to="/admin/live-map" />
        </Route>
      </IonRouterOutlet>

      <IonTabBar slot="bottom">
        <IonTabButton tab="live-map" href="/admin/live-map">
          <IonIcon icon={mapOutline} />
          <IonLabel>Live Map</IonLabel>
        </IonTabButton>

        <IonTabButton tab="routes" href="/admin/routes">
          <IonIcon icon={listOutline} />
          <IonLabel>Routes</IonLabel>
        </IonTabButton>

        <IonTabButton tab="street-schedules" href="/admin/street-schedules">
          <IonIcon icon={listOutline} />
          <IonLabel>Schedules</IonLabel>
        </IonTabButton>

        <IonTabButton tab="trucks" href="/admin/trucks">
          <IonIcon icon={busOutline} />
          <IonLabel>Trucks</IonLabel>
        </IonTabButton>

        <IonTabButton tab="reports" href="/admin/reports">
          <IonIcon icon={alertCircleOutline} />
          <IonLabel>Reports</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
};

export default AdminTabs;


