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
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User } from '../types';

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
        // Fetch user data from Firestore
        const userDoc = await getDoc(doc(db, 'jpc_users', fUser.uid));
        if (userDoc.exists()) {
          setUser(userDoc.data() as User);
        } else {
          // If user doesn't exist in Firestore, create a default user record
          // This is a fallback for the first login
          const newUser: User = {
            id: fUser.uid,
            username: fUser.email?.split('@')[0] || 'user',
            display_name: fUser.displayName || 'User',
            role: fUser.email === 'paramatwork3076@gmail.com' ? 'administrator' : 'jpc_sales',
            created_at: new Date().toISOString()
          };
          await setDoc(doc(db, 'jpc_users', fUser.uid), newUser);
          setUser(newUser);
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
    
    const newUser: User = {
      id: fUser.uid,
      username: email.split('@')[0],
      display_name: displayName,
      role: email === 'paramatwork3076@gmail.com' ? 'administrator' : 'jpc_sales',
      created_at: new Date().toISOString()
    };
    await setDoc(doc(db, 'jpc_users', fUser.uid), newUser);
    setUser(newUser);
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
