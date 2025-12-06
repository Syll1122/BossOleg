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
  address?: string; // Profile field
  phoneNumber?: string; // Profile field
  createdAt: string;
  updatedAt: string;
}

export interface Report {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  reportType: 'select' | 'type';
  issue: string; // Selected option or custom text
  barangay: string;
  truckNo: string;
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt: string;
  updatedAt: string;
}
