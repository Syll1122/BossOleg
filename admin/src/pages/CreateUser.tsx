import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAccount, createRegistrationHistory, getAllAccounts } from '../services/api';
import { sendApprovalEmail } from '../services/emailService';
import { getAdminSession } from '../services/auth';
import { supabase } from '../lib/supabase';
import './CreateUser.css';

// Available trucks in the system (same as signup page)
const ALL_TRUCKS = ['BCG 12*5', 'BCG 13*6', 'BCG 14*7'];

export default function CreateUser() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [availableTrucks, setAvailableTrucks] = useState<string[]>([]);
  const [isLoadingTrucks, setIsLoadingTrucks] = useState(false);
  const [barangays, setBarangays] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingBarangays, setIsLoadingBarangays] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'resident' as 'resident' | 'collector',
    truckNo: '',
    address: '',
    barangay: '',
    phoneNumber: '',
  });

  // Load barangays from database on component mount
  useEffect(() => {
    const loadBarangays = async () => {
      setIsLoadingBarangays(true);
      try {
        const { data, error } = await supabase
          .from('barangays')
          .select('id, name')
          .order('name', { ascending: true });

        if (error) {
          console.error('Error loading barangays:', error);
          // Fallback to empty array - will allow manual entry
          setBarangays([]);
        } else {
          setBarangays((data || []) as Array<{ id: string; name: string }>);
        }
      } catch (error) {
        console.error('Error loading barangays:', error);
        setBarangays([]);
      } finally {
        setIsLoadingBarangays(false);
      }
    };

    loadBarangays();
  }, []);

  // Load available trucks when role changes to collector
  useEffect(() => {
    const loadAvailableTrucks = async () => {
      if (formData.role === 'collector') {
        setIsLoadingTrucks(true);
        try {
          const collectors = await getAllAccounts();
          const assignedTrucks = collectors
            .filter(c => c.role === 'collector')
            .map((c) => c.truckNo)
            .filter((truck): truck is string => !!truck);
          const available = ALL_TRUCKS.filter((truck) => !assignedTrucks.includes(truck));
          setAvailableTrucks(available);
        } catch (error) {
          console.error('Error loading available trucks:', error);
          setAvailableTrucks(ALL_TRUCKS); // Fallback to all trucks
        } finally {
          setIsLoadingTrucks(false);
        }
      } else {
        setAvailableTrucks([]);
        setFormData(prev => ({ ...prev, truckNo: '' }));
      }
    };

    loadAvailableTrucks();
  }, [formData.role]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create account
      const account = await createAccount({
        email: formData.email.toLowerCase().trim(),
        username: formData.username.trim(),
        password: formData.password,
        name: formData.name.trim(),
        role: formData.role,
        truckNo: formData.role === 'collector' ? formData.truckNo.trim() : undefined,
        address: formData.address.trim(),
        barangay: formData.barangay.trim(),
        phoneNumber: '09' + formData.phoneNumber.replace(/\D/g, '').slice(0, 9), // Prepend "09" to the 9 digits
        registrationStatus: formData.role === 'collector' ? 'approved' : 'approved',
      });

      // If collector, create history entry and send approval email
      if (formData.role === 'collector') {
        const admin = getAdminSession();
        if (admin) {
          try {
            // Create history entry for approved collector
            await createRegistrationHistory(
              account.id,
              'approved',
              admin.id,
              'Account created by admin',
              account
            );
          } catch (historyError) {
            console.warn('Failed to create history entry:', historyError);
            // Continue even if history fails
          }
        }

        try {
          await sendApprovalEmail({
            toEmail: account.email,
            userName: account.name,
            collectorName: account.name,
          });
        } catch (emailError) {
          console.warn('Failed to send approval email:', emailError);
          // Continue even if email fails
        }
      }

      alert(`Account created successfully!${formData.role === 'collector' ? ' Approval email sent.' : ''}`);
      navigate('/users');
    } catch (error: any) {
      console.error('Failed to create account:', error);
      alert(error.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-user-page">
      <div className="page-header">
        <h1>Create New Account</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/users')}>
          ← Back to Users
        </button>
      </div>

      <div className="form-container">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Full name"
            />
          </div>

          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="user@example.com"
            />
          </div>

          <div className="form-group">
            <label>Username *</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="username"
            />
          </div>

          <div className="form-group">
            <label>Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={4}
                placeholder="Minimum 4 characters"
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#111827';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#6b7280';
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Role *</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
            >
              <option value="resident">Resident</option>
              <option value="collector">Collector</option>
            </select>
          </div>

          {formData.role === 'collector' && (
            <>
              <div className="form-group">
                <label>Truck No *</label>
                {isLoadingTrucks ? (
                  <div style={{ padding: '0.75rem', color: '#6b7280' }}>
                    Loading available trucks...
                  </div>
                ) : availableTrucks.length > 0 ? (
                  <select
                    name="truckNo"
                    value={formData.truckNo}
                    onChange={handleChange}
                    required={formData.role === 'collector'}
                    className="form-select"
                  >
                    <option value="">Choose truck number</option>
                    {availableTrucks.map((truck) => (
                      <option key={truck} value={truck}>
                        {truck}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ padding: '0.75rem', color: '#ef4444' }}>
                    No trucks available. All trucks are assigned.
                  </div>
                )}
              </div>
            </>
          )}

          <div className="form-group">
            <label>Address</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Street address"
            />
          </div>

          <div className="form-group">
            <label>Barangay</label>
            {isLoadingBarangays ? (
              <div style={{ padding: '0.75rem', color: '#6b7280' }}>
                Loading barangays...
              </div>
            ) : barangays.length > 0 ? (
              <select
                name="barangay"
                value={formData.barangay}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">Select barangay</option>
                {barangays.map((bg) => (
                  <option key={bg.id} value={bg.name}>
                    {bg.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                name="barangay"
                value={formData.barangay}
                onChange={handleChange}
                placeholder="Barangay name"
              />
            )}
          </div>

          <div className="form-group">
            <label>Phone Number</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#111827',
                fontWeight: '500',
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: 1,
                fontSize: '1rem'
              }}>
                09
              </span>
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => {
                  // Only allow digits, max 9 characters (after "09")
                  const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                  setFormData(prev => ({ ...prev, phoneNumber: value }));
                }}
                placeholder="XXXXXXXXX"
                maxLength={9}
                style={{
                  paddingLeft: '2.5rem'
                }}
              />
            </div>
            {formData.phoneNumber && formData.phoneNumber.length < 9 && (
              <div style={{ fontSize: '0.875rem', color: '#ef4444', marginTop: '0.25rem' }}>
                Phone number must be 11 digits
              </div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/users')}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

