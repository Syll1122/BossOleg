import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Account } from './types';
import { getAdminSession, clearAdminSession } from './services/auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Registrations from './pages/Registrations';
import Users from './pages/Users';
import CreateUser from './pages/CreateUser';
import Schedules from './pages/Schedules';
import Reports from './pages/Reports';
import Trucks from './pages/Trucks';
import Layout from './components/Layout';

// Redirect component using useNavigate hook
function Redirect({ to }: { to: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);
  return null;
}

function App() {
  const [admin, setAdmin] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getAdminSession();
    setAdmin(session);
    setLoading(false);
  }, []);

  const handleLogin = (account: Account) => {
    setAdmin(account);
  };

  const handleLogout = () => {
    clearAdminSession();
    setAdmin(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={admin ? <Redirect to="/" /> : <Login onLogin={handleLogin} />}
        />
        <Route
          path="/*"
          element={
            admin ? (
              <Layout admin={admin} onLogout={handleLogout}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/registrations" element={<Registrations />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/create-user" element={<CreateUser />} />
                  <Route path="/schedules" element={<Schedules />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/trucks" element={<Trucks />} />
                </Routes>
              </Layout>
            ) : (
              <Redirect to="/login" />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
