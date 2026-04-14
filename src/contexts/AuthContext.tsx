import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, getDocs, query, collection, where, deleteDoc, getDocFromServer } from 'firebase/firestore';
import { User, Candidate } from '../types';
import { handleFirestoreError, OperationType } from '../services/storage';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, displayName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      
      if (fUser) {
        try {
          // Fetch user data from Firestore
          console.log('AuthContext: Fetching user doc for UID:', fUser.uid);
          const userDoc = await getDocFromServer(doc(db, 'jpc_users', fUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data() as User);
          } else {
            // Check if this email belongs to a candidate
            console.log('AuthContext: User doc not found, checking candidates for email:', fUser.email);
            const candidatesSnap = await getDocs(query(collection(db, 'jpc_candidates'), where('email', '==', fUser.email)));
            const candidateData = candidatesSnap.docs[0]?.data() as Candidate | undefined;

            const newUser: User = {
              id: fUser.uid,
              username: fUser.email?.split('@')[0] || 'user',
              display_name: fUser.displayName || candidateData?.full_name || 'User',
              role: fUser.email === 'paramatwork3076@gmail.com' ? 'administrator' : (candidateData ? 'candidate' : 'jpc_sales'),
              candidate_id: candidateData?.id,
              created_at: new Date().toISOString()
            };
            try {
              console.log('AuthContext: Creating new user doc:', newUser);
              await setDoc(doc(db, 'jpc_users', fUser.uid), newUser);
              setUser(newUser);
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, `jpc_users/${fUser.uid}`);
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `jpc_users/${fUser.uid} or jpc_candidates query`);
        }
      } else {
        setUser(null);
      }
      
      setIsLoading(false);
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  const login = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signup = async (email: string, pass: string, displayName: string) => {
    const { user: fUser } = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(fUser, { displayName });
    
    // Check if a user record already exists (created via Generate Access)
    const userDoc = await getDocFromServer(doc(db, 'jpc_users', fUser.uid));
    
    if (!userDoc.exists()) {
      const newUser: User = {
        id: fUser.uid,
        username: email.split('@')[0],
        display_name: displayName,
        role: email === 'paramatwork3076@gmail.com' ? 'administrator' : 'jpc_sales',
        email: email,
        created_at: new Date().toISOString()
      };
      try {
        await setDoc(doc(db, 'jpc_users', fUser.uid), newUser);
        setUser(newUser);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `jpc_users/${fUser.uid}`);
      }
    } else {
      setUser(userDoc.data() as User);
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, isLoading, login, signup, resetPassword, logout, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
