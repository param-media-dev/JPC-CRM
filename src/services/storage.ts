import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer,
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  writeBatch,
  limit
} from 'firebase/firestore';
import { clearPreviousCalendarEvents } from './calendarService';
import { db, auth } from '../firebase';
import { 
  Candidate, 
  Payment, 
  Promise as PromiseType, 
  QCChecklistItem, 
  FollowUp, 
  ActivityLog, 
  User, 
  Stage, 
  InterviewSupportRequest,
  InterviewRound,
  ProxyAvailability,
  InterviewFeedback,
  BookingLink,
  InterviewNotification,
  InterviewActivityLog,
  Notification as AppNotification,
  FeatureAnnouncement,
  ResumeSubstitutionRequest
} from '../types';

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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
  
  if (errInfo.error.includes('Missing or insufficient permissions')) {
    throw new Error(JSON.stringify(errInfo));
  } else if (errInfo.error.includes('Quota exceeded')) {
    // Only alert once per session to avoid spamming the user
    if (!(window as any).__quotaAlertShown) {
      alert("Uh oh! The database daily quota limit has been exceeded. The application will pause data syncing until midnight Pacific Time. Please try again tomorrow!");
      (window as any).__quotaAlertShown = true;
    }
  } else {
    throw new Error(JSON.stringify(errInfo));
  }
}

// Helper to test connection
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration.");
    }
  }
}

// Generic Data Access
export const subscribeToCollection = <T>(collectionName: string, callback: (data: T[]) => void, limitCount?: number) => {
  let q = query(collection(db, collectionName));
  if (limitCount) {
    q = query(q, limit(limitCount));
  }
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T));
    callback(data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, collectionName);
  });
};

export const subscribeToCollectionWithLimit = <T>(collectionName: string, limitCount: number, callback: (data: T[]) => void) => {
  const q = query(collection(db, collectionName), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T));
    callback(data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, collectionName);
  });
};

export const subscribeToQuery = <T>(q: any, callback: (data: T[]) => void, collectionName: string) => {
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
export const checkDuplicateCandidate = async (phone: string, email: string, whatsapp: string): Promise<string | null> => {
  try {
    const candidatesRef = collection(db, 'jpc_candidates');
    
    // Check Phone
    if (phone && phone.trim() !== '') {
      const pQuery = query(candidatesRef, where('phone', '==', phone.trim()));
      const snap = await getDocs(pQuery);
      if (!snap.empty) return `A candidate with the phone number ${phone} already exists.`;
    }

    // Check Email
    if (email && email.trim() !== '') {
      const eQuery = query(candidatesRef, where('email', '==', email.trim()));
      const snap = await getDocs(eQuery);
      if (!snap.empty) return `A candidate with the email ${email} already exists.`;
    }

    // Check WhatsApp
    if (whatsapp && whatsapp.trim() !== '') {
      const wQuery = query(candidatesRef, where('whatsapp', '==', whatsapp.trim()));
      const snap = await getDocs(wQuery);
      if (!snap.empty) return `A candidate with the WhatsApp number ${whatsapp} already exists.`;
    }

    return null;
  } catch (error) {
    console.error("Error checking for duplicate candidates:", error);
    return null;
  }
};

export const getFaizUserId = async (): Promise<string | null> => {
  try {
    const q = query(
      collection(db, 'jpc_users'),
      where('role', '==', 'jpc_cs')
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const u = d.data();
      if (
        u.username === 'care' || 
        String(u.display_name).toLowerCase().includes('faiz') || 
        String(u.email).toLowerCase() === 'care@auriic.co'
      ) {
        return d.id;
      }
    }
    if (!snap.empty) {
      return snap.docs[0].id;
    }
  } catch (e) {
    console.error('Error finding Faiz Ahmadi user:', e);
  }
  return null;
};

export const autoAssignFaizToCandidates = async () => {
  try {
    const faizId = await getFaizUserId();
    if (!faizId) return;

    const snap = await getDocs(collection(db, 'jpc_candidates'));
    for (const d of snap.docs) {
      const candidate = d.data() as Candidate;
      if (
        (candidate.current_stage === 'marketing_active' || candidate.current_stage === 'interviewing') &&
        !candidate.assigned_cs
      ) {
        console.log(`Auto-assigning CS (Faiz Ahmadi) to candidate: ${candidate.full_name}`);
        await updateDoc(doc(db, 'jpc_candidates', candidate.id), {
          assigned_cs: faizId,
          updated_at: new Date().toISOString()
        });
        try {
          await logActivity(
            candidate.id,
            'CS Assigned Automatically',
            'CS automatically assigned to Faiz Ahmadi (care) for Active Marketing/Interviewing stage.',
            'system'
          );
        } catch (le) {}
      }
    }
  } catch (error) {
    console.error('Error in autoAssignFaizToCandidates:', error);
  }
};

export const saveCandidate = async (candidate: Candidate, userId: string | null) => {
  try {
    let finalCandidate = { ...candidate };
    if (
      (finalCandidate.current_stage === 'marketing_active' || finalCandidate.current_stage === 'interviewing') &&
      !finalCandidate.assigned_cs
    ) {
      const faizId = await getFaizUserId();
      if (faizId) {
        finalCandidate.assigned_cs = faizId;
      }
    }
    const data = { ...finalCandidate, updated_at: new Date().toISOString() };
    await setDoc(doc(db, 'jpc_candidates', finalCandidate.id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jpc_candidates/${candidate.id}`);
  }
};

export const updateCandidate = async (id: string, updates: Partial<Candidate>) => {
  try {
    let finalUpdates = { ...updates };
    let currentStage = updates.current_stage;
    let assignedCs = updates.assigned_cs;
    
    if (currentStage === undefined || assignedCs === undefined) {
      const docSnap = await getDoc(doc(db, 'jpc_candidates', id));
      if (docSnap.exists()) {
        const currentData = docSnap.data() as Candidate;
        if (currentStage === undefined) currentStage = currentData.current_stage;
        if (assignedCs === undefined) assignedCs = currentData.assigned_cs;
      }
    }
    
    if (
      (currentStage === 'marketing_active' || currentStage === 'interviewing') &&
      !assignedCs
    ) {
      const faizId = await getFaizUserId();
      if (faizId) {
        finalUpdates.assigned_cs = faizId;
      }
    }

    const data = { ...finalUpdates, updated_at: new Date().toISOString() };
    await updateDoc(doc(db, 'jpc_candidates', id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `jpc_candidates/${id}`);
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
    const batch = writeBatch(db);
    batch.delete(doc(db, 'jpc_candidates', id));
    
    const collectionsWithCandidateId = [
      'jpc_payments',
      'jpc_promises',
      'jpc_qc_checklist',
      'jpc_followups',
      'jpc_activity_logs',
      'jpc_applications',
      'jpc_resume_requests',
      'jpc_interview_requests', // Updated
      'jpc_users',
      'jpc_report_logs'
    ];

    for (const collName of collectionsWithCandidateId) {
      const q = query(collection(db, collName), where('candidate_id', '==', id));
      const snapshot = await getDocs(q);
      snapshot.forEach(d => {
        batch.delete(d.ref);
      });
    }

    await batch.commit();
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
    { label: 'Candidate indidity Verification', hasTextBox: false },
    { label: 'Educational Verification', hasTextBox: false },
    { label: 'Visa Verification', hasTextBox: false },
    { label: 'Exprince Verification', hasTextBox: false },
    { label: 'Location Verification', hasTextBox: true },
    { label: 'Experirnce Verification', hasTextBox: false },
    { label: 'Domain Suggection By Candidatte', hasTextBox: true },
    { label: 'EAD Verification', hasTextBox: false }
  ];
  
  for (const item of items) {
    const id = generateId();
    const data = {
      id,
      candidate_id: candidateId,
      item_key: item.label.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '_'),
      item_label: item.label,
      checked: false,
      value: '',
      has_text_box: item.hasTextBox,
      created_at: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, 'jpc_qc_checklist', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `jpc_qc_checklist/${id}`);
    }
  }
};

export const resetQCChecklist = async (candidateId: string) => {
  try {
    const q = query(collection(db, 'jpc_qc_checklist'), where('candidate_id', '==', candidateId));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(doc(db, 'jpc_qc_checklist', d.id));
    }
    await seedQCChecklist(candidateId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `jpc_qc_checklist reset for ${candidateId}`);
  }
};

export const migrateAllChecklists = async () => {
  try {
    const candidatesSnap = await getDocs(collection(db, 'jpc_candidates'));
    for (const candidateDoc of candidatesSnap.docs) {
      const candidateId = candidateDoc.id;
      const q = query(collection(db, 'jpc_qc_checklist'), where('candidate_id', '==', candidateId));
      const checklistSnap = await getDocs(q);
      
      const checklist = checklistSnap.docs.map(d => d.data() as QCChecklistItem);
      const isOld = checklist.length > 0 && (checklist.length !== 8 || !checklist.some(item => item.item_label === 'Candidate indidity Verification'));
      
      if (isOld) {
        console.log(`Migrating checklist for candidate ${candidateId}...`);
        for (const d of checklistSnap.docs) {
          await deleteDoc(doc(db, 'jpc_qc_checklist', d.id));
        }
        await seedQCChecklist(candidateId);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'jpc_candidates during migration');
  }
};

// Notifications
export const addNotification = async (notification: Omit<AppNotification, 'id' | 'created_at' | 'read'>) => {
  const id = generateId();
  const data = { 
    ...notification, 
    id, 
    read: false, 
    created_at: new Date().toISOString() 
  };
  try {
    await setDoc(doc(db, 'jpc_notifications', id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jpc_notifications/${id}`);
  }
};

export const markNotificationAsRead = async (id: string) => {
  try {
    await updateDoc(doc(db, 'jpc_notifications', id), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `jpc_notifications/${id}`);
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

// Interview Support System
export const addInterviewSupportRequest = async (request: Omit<InterviewSupportRequest, 'id' | 'created_at' | 'updated_at'>) => {
  const id = generateId();
  const data = { 
    ...request, 
    id, 
    created_at: now(),
    updated_at: now()
  };
  try {
    await setDoc(doc(db, 'jpc_interview_requests', id), data);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jpc_interview_requests/${id}`);
  }
};

export const updateInterviewSupportRequest = async (id: string, updates: Partial<InterviewSupportRequest>) => {
  try {
    const data = { ...updates, updated_at: now() };
    await updateDoc(doc(db, 'jpc_interview_requests', id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `jpc_interview_requests/${id}`);
  }
};

export const deleteInterviewSupportRequest = async (id: string) => {
  try {
    // 1. Find all rounds for this request to clear calendar events first
    const roundsQ = query(collection(db, 'jpc_interview_rounds'), where('request_id', '==', id));
    const roundsSnap = await getDocs(roundsQ);
    
    for (const roundDoc of roundsSnap.docs) {
      await clearPreviousCalendarEvents(roundDoc.id);
    }

    const batch = writeBatch(db);
    
    // 2. Delete the request
    batch.delete(doc(db, 'jpc_interview_requests', id));
    
    for (const roundDoc of roundsSnap.docs) {
      const roundId = roundDoc.id;
      
      // Delete the round
      batch.delete(roundDoc.ref);
      
      // Delete associated booking links
      const linksQ = query(collection(db, 'jpc_interview_booking_links'), where('interview_round_id', '==', roundId));
      const linksSnap = await getDocs(linksQ);
      linksSnap.forEach(d => batch.delete(d.ref));
      
      // Delete associated feedback
      const feedbackQ = query(collection(db, 'jpc_interview_feedback'), where('interview_round_id', '==', roundId));
      const feedbackSnap = await getDocs(feedbackQ);
      feedbackSnap.forEach(d => batch.delete(d.ref));
      
      // Delete associated notifications
      const notifQ = query(collection(db, 'jpc_interview_notifications'), where('interview_round_id', '==', roundId));
      const notifSnap = await getDocs(notifQ);
      notifSnap.forEach(d => batch.delete(d.ref));
      
      // Delete associated logs
      const logsQ = query(collection(db, 'jpc_interview_activity_logs'), where('interview_round_id', '==', roundId));
      const logsSnap = await getDocs(logsQ);
      logsSnap.forEach(d => batch.delete(d.ref));
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `jpc_interview_requests/${id} and its rounds`);
  }
};

export const addInterviewRound = async (round: Omit<InterviewRound, 'id' | 'created_at' | 'updated_at'>) => {
  const id = generateId();
  const data = { ...round, id, created_at: now(), updated_at: now() };
  try {
    await setDoc(doc(db, 'jpc_interview_rounds', id), data);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jpc_interview_rounds/${id}`);
  }
};

export const updateInterviewRound = async (id: string, updates: Partial<InterviewRound>) => {
  try {
    const data = { ...updates, updated_at: now() };
    await updateDoc(doc(db, 'jpc_interview_rounds', id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `jpc_interview_rounds/${id}`);
  }
};

export const addProxyAvailability = async (availability: Omit<ProxyAvailability, 'id' | 'created_at' | 'updated_at'>) => {
  const id = generateId();
  const data = { ...availability, id, created_at: now(), updated_at: now() };
  try {
    await setDoc(doc(db, 'jpc_proxy_availability', id), data);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jpc_proxy_availability/${id}`);
  }
};

export const updateProxyAvailability = async (id: string, updates: Partial<ProxyAvailability>) => {
  try {
    const data = { ...updates, updated_at: now() };
    await updateDoc(doc(db, 'jpc_proxy_availability', id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `jpc_proxy_availability/${id}`);
  }
};

export const deleteProxyAvailability = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'jpc_proxy_availability', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `jpc_proxy_availability/${id}`);
  }
};

export const addInterviewFeedback = async (feedback: Omit<InterviewFeedback, 'id' | 'created_at'>) => {
  const id = generateId();
  const data = { ...feedback, id, created_at: now() };
  try {
    await setDoc(doc(db, 'jpc_interview_feedback', id), data);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jpc_interview_feedback/${id}`);
  }
};

export const addBookingLink = async (link: Omit<BookingLink, 'id' | 'created_at'>) => {
  const id = generateId();
  const data = { ...link, id, created_at: now() };
  try {
    await setDoc(doc(db, 'jpc_interview_booking_links', id), data);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jpc_interview_booking_links/${id}`);
  }
};

export const updateBookingLink = async (id: string, updates: Partial<BookingLink>) => {
  try {
    await updateDoc(doc(db, 'jpc_interview_booking_links', id), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `jpc_interview_booking_links/${id}`);
  }
};

export const logInterviewActivity = async (roundId: string, action: string, details: any, userId: string) => {
  const id = generateId();
  const data: InterviewActivityLog = {
    id,
    interview_round_id: roundId,
    action,
    action_by: userId,
    meta_data: details,
    created_at: now()
  };
  try {
    await setDoc(doc(db, 'jpc_interview_activity_logs', id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jpc_interview_activity_logs/${id}`);
  }
};

export const addInterviewNotification = async (notification: Omit<InterviewNotification, 'id' | 'created_at' | 'is_read'>) => {
  const id = generateId();
  const data: InterviewNotification = {
    ...notification,
    id,
    is_read: false,
    created_at: now()
  };
  try {
    await setDoc(doc(db, 'jpc_interview_notifications', id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jpc_interview_notifications/${id}`);
  }
};

// Target Reduction Requests
export const addTargetReductionRequest = async (request: Omit<any, 'id' | 'created_at' | 'updated_at'>) => {
  const id = generateId();
  const data = { 
    ...request, 
    id, 
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  try {
    await setDoc(doc(db, 'jpc_target_reductions', id), data);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jpc_target_reductions/${id}`);
  }
};

export const updateTargetReductionRequest = async (id: string, updates: Partial<any>) => {
  try {
    const data = { ...updates, updated_at: new Date().toISOString() };
    await updateDoc(doc(db, 'jpc_target_reductions', id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `jpc_target_reductions/${id}`);
  }
};

// Feature Announcements
export const addFeatureAnnouncement = async (announcement: Omit<FeatureAnnouncement, 'id' | 'created_at' | 'is_active'>) => {
  const id = generateId();
  const data = { 
    ...announcement, 
    id, 
    is_active: true,
    created_at: now() 
  };
  try {
    await setDoc(doc(db, 'jpc_feature_announcements', id), data);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jpc_feature_announcements/${id}`);
  }
};

export const addResumeSubstitutionRequest = async (request: Omit<ResumeSubstitutionRequest, 'id' | 'created_at' | 'updated_at'>) => {
  const id = generateId();
  const data = { 
    ...request, 
    id, 
    created_at: now(),
    updated_at: now()
  };
  try {
    await setDoc(doc(db, 'jpc_resume_substitutions', id), data);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `jpc_resume_substitutions/${id}`);
  }
};

export const updateFeatureAnnouncement = async (id: string, updates: Partial<FeatureAnnouncement>) => {
  try {
    await updateDoc(doc(db, 'jpc_feature_announcements', id), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `jpc_feature_announcements/${id}`);
  }
};

export const deleteFeatureAnnouncement = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'jpc_feature_announcements', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `jpc_feature_announcements/${id}`);
  }
};

// Utils
export const generateId = () => Math.random().toString(36).slice(2, 11);
export const now = () => new Date().toISOString();
