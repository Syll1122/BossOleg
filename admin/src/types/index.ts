export type UserRole = 'resident' | 'collector' | 'admin';

export interface Account {
  id: string;
  email: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  truckNo?: string;
  address?: string;
  barangay?: string;
  phoneNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Report {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  reportType: 'select' | 'type';
  issue: string;
  barangay: string;
  truckNo: string;
  collectorId?: string;
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt: string;
  updatedAt: string;
}

export interface TruckStatus {
  id: string;
  isFull: boolean;
  isCollecting: boolean;
  latitude?: number;
  longitude?: number;
  updatedAt: string;
  updatedBy: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  link?: string;
  createdAt: string;
}




