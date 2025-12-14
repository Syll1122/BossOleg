import { IonButton, IonIcon } from '@ionic/react';
import { moonOutline, sunnyOutline } from 'ionicons/icons';
import { useTheme } from '../contexts/ThemeContext';
import './ThemeToggle.css';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <IonButton
      fill="clear"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      className="theme-toggle-button"
    >
      <IonIcon 
        icon={theme === 'light' ? moonOutline : sunnyOutline} 
        style={{ fontSize: '1.5rem' }}
      />
    </IonButton>
  );
}

