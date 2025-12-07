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
  phoneNumber?: string; // Profile field
  createdAt: string;
  updatedAt: string;
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
  updatedAt: string;
  updatedBy: string; // Collector user ID
}
