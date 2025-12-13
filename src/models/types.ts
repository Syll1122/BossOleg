// src/models/types.ts

export type UserRole = 'resident' | 'collector' | 'admin';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export interface Account {
  id: string;
  email: string;
  username: string;
  password: string; // In production, this should be hashed
  name: string;
  role: UserRole;
  truckNo?: string; // Truck number for collectors
  address?: string; // Profile field
  barangay?: string; // Barangay in Quezon City
  phoneNumber?: string; // Profile field
  createdAt: string;
  updatedAt: string;
  isOnline?: boolean; // Whether the user is currently online
  lastLoginAt?: string;
  lastLogoutAt?: string;
  registrationStatus?: 'pending' | 'approved' | 'rejected';
}

export interface Report {
  id: string;
  userId: string; // Resident who created the report
  userName: string;
  userEmail: string;
  reportType: 'select' | 'type';
  issue: string; // Selected option or custom text
  barangay: string;
  truckNo: string; // Truck number (for backward compatibility)
  collectorId?: string; // Direct link to collector account (optional for now)
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt: string;
  updatedAt: string;
}

export interface TruckStatus {
  id: string; // Truck ID (e.g., 'BCG 11*4')
  isFull: boolean;
  isCollecting: boolean; // Whether the truck is currently collecting
  latitude?: number; // GPS latitude
  longitude?: number; // GPS longitude
  updatedAt: string;
  updatedBy: string; // Collector user ID
}

export interface Notification {
  id: string;
  userId: string; // User who should receive this notification
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  link?: string; // Optional link to navigate to when clicked
  createdAt: string;
}

export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
}
