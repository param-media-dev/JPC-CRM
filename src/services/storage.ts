import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Candidate, Payment, Promise as PromiseType, QCChecklistItem, FollowUp, ActivityLog, User, Stage } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helper to test connection
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}

// Generic Data Access
export const subscribeToCollection = <T>(collectionName: string, callback: (data: T[]) => void) => {
  const q = query(collection(db, collectionName));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T));
    callback(data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, collectionName);
  });
};

// Users
export const saveUser = async (user: User) => {
  try {
    await setDoc(doc(db, 'jpc_users', String(user.id)), user);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jpc_users/${user.id}`);
  }
};

export const getUserById = async (id: string | number): Promise<User | null> => {
  try {
    const docSnap = await getDoc(doc(db, 'jpc_users', String(id)));
    return docSnap.exists() ? (docSnap.data() as User) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `jpc_users/${id}`);
    return null;
  }
};

export const getUsers = async (): Promise<User[]> => {
  try {
    const snap = await getDocs(collection(db, 'jpc_users'));
    return snap.docs.map(d => d.data() as User);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'jpc_users');
    return [];
  }
};

// Candidates
export const saveCandidate = async (candidate: Candidate, userId: string | null) => {
  try {
    const data = { ...candidate, updated_at: new Date().toISOString() };
    await setDoc(doc(db, 'jpc_candidates', candidate.id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jpc_candidates/${candidate.id}`);
  }
};

export const getCandidateById = async (id: string): Promise<Candidate | null> => {
  try {
    const docSnap = await getDoc(doc(db, 'jpc_candidates', id));
    return docSnap.exists() ? (docSnap.data() as Candidate) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `jpc_candidates/${id}`);
    return null;
  }
};

export const deleteCandidate = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'jpc_candidates', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `jpc_candidates/${id}`);
  }
};

// Payments
export const addPayment = async (payment: Omit<Payment, 'id' | 'created_at'>) => {
  const id = generateId();
  const data = { ...payment, id, created_at: new Date().toISOString() };
  try {
    await setDoc(doc(db, 'jpc_payments', id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jpc_payments/${id}`);
  }
};

export const updatePayment = async (payment: Payment) => {
  try {
    await updateDoc(doc(db, 'jpc_payments', payment.id), { ...payment });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `jpc_payments/${payment.id}`);
  }
};

// Promises
export const addPromise = async (promise: Omit<PromiseType, 'id' | 'created_at'>) => {
  const id = generateId();
  const data = { ...promise, id, created_at: new Date().toISOString() };
  try {
    await setDoc(doc(db, 'jpc_promises', id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jpc_promises/${id}`);
  }
};

export const updatePromise = async (promise: PromiseType) => {
  try {
    await updateDoc(doc(db, 'jpc_promises', promise.id), { ...promise });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `jpc_promises/${promise.id}`);
  }
};

// QC Checklist
export const updateQCChecklistItem = async (item: QCChecklistItem) => {
  try {
    await updateDoc(doc(db, 'jpc_qc_checklist', item.id), { ...item });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `jpc_qc_checklist/${item.id}`);
  }
};

export const seedQCChecklist = async (candidateId: string) => {
  const items = [
    'Candidate verified identity',
    'Education documents checked',
    'Experience verified',
    'Package terms explained',
    'Payment schedule agreed',
    'Training requirements discussed'
  ];
  
  for (const label of items) {
    const id = generateId();
    const data = {
      id,
      candidate_id: candidateId,
      item_key: label.toLowerCase().replace(/\s+/g, '_'),
      item_label: label,
      checked: false,
      created_at: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, 'jpc_qc_checklist', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `jpc_qc_checklist/${id}`);
    }
  }
};

// Follow-ups
export const addFollowUp = async (followUp: Omit<FollowUp, 'id' | 'created_at'>) => {
  const id = generateId();
  const data = { ...followUp, id, created_at: new Date().toISOString() };
  try {
    await setDoc(doc(db, 'jpc_followups', id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jpc_followups/${id}`);
  }
};

export const updateFollowUp = async (followUp: FollowUp) => {
  try {
    await updateDoc(doc(db, 'jpc_followups', followUp.id), { ...followUp });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `jpc_followups/${followUp.id}`);
  }
};

// Activity Logs
export const logActivity = async (candidateId: string, action: string, details: string, userId: string | number | null) => {
  const id = generateId();
  const data = {
    id,
    candidate_id: candidateId,
    action,
    details,
    user_id: userId,
    created_at: new Date().toISOString()
  };
  try {
    await setDoc(doc(db, 'jpc_activity_logs', id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jpc_activity_logs/${id}`);
  }
};

// Utils
export const generateId = () => Math.random().toString(36).slice(2, 11);
export const now = () => new Date().toISOString();
