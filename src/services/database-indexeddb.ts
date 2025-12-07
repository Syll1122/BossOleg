// src/services/database-indexeddb.ts
// Local database service using IndexedDB (works on web and mobile)
// BACKUP: Original implementation before Supabase migration

import { Account, UserRole, Report, TruckStatus } from '../models/types';

const DB_NAME = 'WatchAppDB';
const DB_VERSION = 4; // Incremented to add truckNo index
const STORE_NAME = 'accounts';
const REPORTS_STORE_NAME = 'reports';
const TRUCK_STATUS_STORE_NAME = 'truckStatus';

class DatabaseService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    if (this.db) {
      return Promise.resolve();
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Database initialization failed:', request.error);
        this.initPromise = null; // Clear cached promise to allow retries
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.initPromise = null; // Clear cached promise after successful initialization
        resolve();
      };

      request.onblocked = () => {
        console.warn('Database upgrade blocked. Please close other tabs with this app open.');
        // Note: We don't clear initPromise here as the request is still pending
        // The user needs to close other tabs for the upgrade to proceed
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = (event.target as IDBOpenDBRequest).transaction;

        // Create accounts store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: false });
          objectStore.createIndex('email', 'email', { unique: true });
          objectStore.createIndex('username', 'username', { unique: true });
          objectStore.createIndex('role', 'role', { unique: false });
          objectStore.createIndex('truckNo', 'truckNo', { unique: true });
        } else if (transaction) {
          // Add truckNo index if it doesn't exist (for existing databases)
          const objectStore = transaction.objectStore(STORE_NAME);
          if (objectStore && !objectStore.indexNames.contains('truckNo')) {
            try {
              objectStore.createIndex('truckNo', 'truckNo', { unique: true });
            } catch (error) {
              console.warn('Could not create truckNo index:', error);
            }
          }
        }

        // Create reports store if it doesn't exist
        if (!db.objectStoreNames.contains(REPORTS_STORE_NAME)) {
          const reportsStore = db.createObjectStore(REPORTS_STORE_NAME, { keyPath: 'id', autoIncrement: false });
          reportsStore.createIndex('userId', 'userId', { unique: false });
          reportsStore.createIndex('status', 'status', { unique: false });
          reportsStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Create truck status store if it doesn't exist
        if (!db.objectStoreNames.contains(TRUCK_STATUS_STORE_NAME)) {
          const truckStatusStore = db.createObjectStore(TRUCK_STATUS_STORE_NAME, { keyPath: 'id', autoIncrement: false });
          truckStatusStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInit(): Promise<void> {
    if (!this.db) {
      await this.init();
    }
  }

  /**
   * Create a new account
   */
  async createAccount(account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Promise<Account> {
    await this.ensureInit();

    const newAccount: Account = {
      ...account,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Check if email or username already exists
      const emailIndex = store.index('email');
      const usernameIndex = store.index('username');

      const emailRequest = emailIndex.get(account.email);
      const usernameRequest = usernameIndex.get(account.username);

      Promise.all([
        new Promise<boolean>((res) => {
          emailRequest.onsuccess = () => res(emailRequest.result !== undefined);
          emailRequest.onerror = () => res(false);
        }),
        new Promise<boolean>((res) => {
          usernameRequest.onsuccess = () => res(usernameRequest.result !== undefined);
          usernameRequest.onerror = () => res(false);
        }),
      ]).then(([emailExists, usernameExists]) => {
        if (emailExists) {
          reject(new Error('Email already exists'));
          return;
        }
        if (usernameExists) {
          reject(new Error('Username already exists'));
          return;
        }

        const addRequest = store.add(newAccount);
        addRequest.onsuccess = () => resolve(newAccount);
        addRequest.onerror = () => reject(addRequest.error);
      });
    });
  }

  /**
   * Get account by email
   */
  async getAccountByEmail(email: string): Promise<Account | null> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('email');
      const request = index.get(email);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get account by username
   */
  async getAccountByUsername(username: string): Promise<Account | null> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('username');
      const request = index.get(username);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get account by ID
   */
  async getAccountById(id: string): Promise<Account | null> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Authenticate user (check username/email and password)
   */
  async authenticate(identifier: string, password: string): Promise<Account | null> {
    await this.ensureInit();

    // Try to find by email first, then by username
    let account = await this.getAccountByEmail(identifier);
    if (!account) {
      account = await this.getAccountByUsername(identifier);
    }

    if (!account) {
      return null;
    }

    // In production, use proper password hashing (bcrypt, etc.)
    if (account.password === password) {
      return account;
    }

    return null;
  }

  /**
   * Get all accounts (for admin purposes)
   */
  async getAllAccounts(): Promise<Account[]> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Update account
   */
  async updateAccount(id: string, updates: Partial<Omit<Account, 'id' | 'createdAt'>>): Promise<Account> {
    await this.ensureInit();

    return new Promise(async (resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      // First get the existing account
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const existingAccount = getRequest.result;
        if (!existingAccount) {
          reject(new Error('Account not found'));
          return;
        }

        const updatedAccount: Account = {
          ...existingAccount,
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        const updateRequest = store.put(updatedAccount);
        updateRequest.onsuccess = () => resolve(updatedAccount);
        updateRequest.onerror = () => reject(updateRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Delete account
   */
  async deleteAccount(id: string): Promise<void> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all accounts (for testing/reset)
   */
  async clearAllAccounts(): Promise<void> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========== REPORTS METHODS ==========

  /**
   * Create a new report
   */
  async createReport(report: Omit<Report, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<Report> {
    await this.ensureInit();

    const newReport: Report = {
      ...report,
      id: this.generateId(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([REPORTS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(REPORTS_STORE_NAME);

      const addRequest = store.add(newReport);
      addRequest.onsuccess = () => resolve(newReport);
      addRequest.onerror = () => reject(addRequest.error);
    });
  }

  /**
   * Get all reports (for admin)
   */
  async getAllReports(): Promise<Report[]> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([REPORTS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(REPORTS_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const reports = request.result || [];
        // Sort by createdAt descending (newest first)
        reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(reports);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get reports by user ID
   */
  async getReportsByUserId(userId: string): Promise<Report[]> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([REPORTS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(REPORTS_STORE_NAME);
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        const reports = request.result || [];
        reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(reports);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Update report status (for admin)
   */
  async updateReportStatus(id: string, status: Report['status']): Promise<Report> {
    await this.ensureInit();

    return new Promise(async (resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([REPORTS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(REPORTS_STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const existingReport = getRequest.result;
        if (!existingReport) {
          reject(new Error('Report not found'));
          return;
        }

        const updatedReport: Report = {
          ...existingReport,
          status,
          updatedAt: new Date().toISOString(),
        };

        const updateRequest = store.put(updatedReport);
        updateRequest.onsuccess = () => resolve(updatedReport);
        updateRequest.onerror = () => reject(updateRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Update or create truck status
   */
  async updateTruckStatus(truckId: string, isFull: boolean, updatedBy: string): Promise<TruckStatus> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TRUCK_STATUS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(TRUCK_STATUS_STORE_NAME);

      const status: TruckStatus = {
        id: truckId,
        isFull,
        updatedAt: new Date().toISOString(),
        updatedBy,
      };

      const request = store.put(status);
      request.onsuccess = () => resolve(status);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get truck status by truck ID
   */
  async getTruckStatus(truckId: string): Promise<TruckStatus | null> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TRUCK_STATUS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(TRUCK_STATUS_STORE_NAME);

      const request = store.get(truckId);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all truck statuses
   */
  async getAllTruckStatuses(): Promise<TruckStatus[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TRUCK_STATUS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(TRUCK_STATUS_STORE_NAME);

      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get accounts by role
   */
  async getAccountsByRole(role: UserRole): Promise<Account[]> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('role');
      const request = index.getAll(role);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get account by truck number
   */
  async getAccountByTruckNo(truckNo: string): Promise<Account | null> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      // Try to use truckNo index if it exists
      if (store.indexNames.contains('truckNo')) {
        const index = store.index('truckNo');
        const request = index.get(truckNo);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      } else {
        // Fallback: get all accounts and filter
        const request = store.getAll();
        request.onsuccess = () => {
          const accounts = request.result || [];
          const account = accounts.find((acc: Account) => acc.truckNo === truckNo);
          resolve(account || null);
        };
        request.onerror = () => reject(request.error);
      }
    });
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();

// Initialize database on module load
databaseService.init().catch((error) => {
  console.error('Failed to initialize database:', error);
});

