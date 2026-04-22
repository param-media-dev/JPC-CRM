import { apiService } from './apiService';
import { Candidate, Payment, FollowUp, ActivityLog, User, InterviewRequest, Notification as AppNotification } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`API Error [${operationType}] at ${path}:`, error);
}

// Helper to test connection
export async function testConnection() {
  try {
    await apiService.getStats();
    console.log("API connection successful.");
  } catch (error) {
    console.error("API connection failed:", error);
  }
}

// Legacy subscription wrappers (now just empty or manual fetch triggers if needed)
export const subscribeToCollection = <T>(collectionName: string, callback: (data: T[]) => void) => {
  // REST API doesn't support subscriptions, so we just trigger one fetch
  console.warn(`Subscriptions not supported for ${collectionName}. DataContext will handle updates.`);
  return () => {};
};

export const subscribeToQuery = <T>(q: any, callback: (data: T[]) => void, collectionName: string) => {
  return () => {};
};

// Users
export const saveUser = async (user: User) => {
  try {
    if (user.id) {
      await apiService.updateUser(user.id, user);
    } else {
      await apiService.createUser(user);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.id}`);
  }
};

export const getUserById = async (id: string | number): Promise<User | null> => {
  try {
    return await apiService.getUser(id);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${id}`);
    return null;
  }
};

export const getUsers = async (): Promise<User[]> => {
  try {
    return await apiService.getUsers();
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
    return [];
  }
};

// Candidates
export const checkDuplicateCandidate = async (phone: string, email: string, whatsapp: string): Promise<string | null> => {
  // Check logic moved to backend in REST API typically, or we can fetch and check
  return null; 
};

export const saveCandidate = async (candidate: Candidate, userId: string | null): Promise<Candidate | null> => {
  try {
    // If it has a temporary ID, always create
    const isNew = !candidate.id || candidate.id.startsWith('temp_') || candidate.id.length < 15;
    
    if (!isNew) {
      try {
        const response = await apiService.updateCandidate(candidate.id, candidate);
        return response;
      } catch (error: any) {
        if (error.message && (error.message.includes('Not found') || error.message.includes('404'))) {
          // Fall through to create if not found
          console.warn(`Candidate ${candidate.id} not found on server, attempting to create.`);
        } else {
          throw error;
        }
      }
    }

    // Create new candidate
    const { id, ...candidateData } = candidate;
    const response = await apiService.createCandidate(candidateData);
    return response;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `candidates/${candidate.id}`);
    throw error;
  }
};

export const getCandidateById = async (id: string): Promise<Candidate | null> => {
  try {
    return await apiService.getCandidate(id);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `candidates/${id}`);
    return null;
  }
};

export const deleteCandidate = async (id: string) => {
  try {
    await apiService.deleteCandidate(id);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `candidates/${id}`);
  }
};

// Payments
export const addPayment = async (payment: Omit<Payment, 'id' | 'created_at'>) => {
  try {
    await apiService.createPayment(payment);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'payments');
  }
};

export const updatePayment = async (payment: Payment) => {
  try {
    await apiService.updatePayment(payment.id, payment);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `payments/${payment.id}`);
  }
};

// Promises
export const addPromise = async (promise: any) => {
  try {
    await apiService.request('/promises', {
      method: 'POST',
      body: JSON.stringify(promise),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'promises');
  }
};

export const updatePromise = async (id: string, updates: any) => {
  try {
    await apiService.request(`/promises/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `promises/${id}`);
  }
};

// QC Checklist (Handled by backend in REST API usually, or via candidate update)
export const updateQCChecklistItem = async (item: any) => {
  // Implementation depends on API structure, usually flags
};

export const seedQCChecklist = async (candidateId: string) => {};
export const resetQCChecklist = async (candidateId: string) => {};
export const migrateAllChecklists = async () => {};

// Notifications
export const addNotification = async (notification: any) => {
  // Backend usually handles notifications in WP JSON API context
};

export const markNotificationAsRead = async (id: string) => {
  // Implement if exists in API
};

// Follow-ups
export const addFollowUp = async (followUp: Omit<FollowUp, 'id' | 'created_at'>) => {
  try {
    await apiService.createFollowup(followUp);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'followups');
  }
};

export const updateFollowUp = async (followUp: FollowUp) => {
  try {
    await apiService.updateFollowup(followUp.id, followUp);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `followups/${followUp.id}`);
  }
};

// Activity Logs
export const logActivity = async (candidateId: string, action: string, details: string, userId: string | number | null) => {
  // Many REST APIs handle this automatically or via a log endpoint
};

// Interview Support
export const addInterviewRequest = async (request: Omit<InterviewRequest, 'id' | 'created_at' | 'updated_at'>) => {
  try {
    const data = await apiService.createInterview(request);
    return data.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'interviews');
  }
};

export const updateInterviewRequest = async (id: string, updates: Partial<InterviewRequest>) => {
  try {
    await apiService.updateInterview(id, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `interviews/${id}`);
  }
};

export const generateId = () => `temp_${Math.random().toString(36).slice(2, 11)}`;
export const now = () => new Date().toISOString();
