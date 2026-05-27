import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User as AppUser } from '../types';

interface AuthContextType {
  user: (FirebaseUser & { appData?: AppUser }) | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string, role: string, department: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<(FirebaseUser & { appData?: AppUser }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubUser: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          
          // Use getDoc with a timeout or just rely on onSnapshot for initial data
          // to avoid "client is offline" throwing uncaught errors if persistent cache is used
          const userDoc = await getDoc(userRef).catch(err => {
            console.warn("Initial getDoc failed (may be offline):", err);
            return null;
          });
          
          if (userDoc && userDoc.exists()) {
            const data = userDoc.data() as AppUser;
            if (firebaseUser.email?.toLowerCase() === 'rajesh.myphoneme@gmail.com' && data.role !== 'super_admin') {
              data.role = 'super_admin';
              data.department = 'Executive Command';
              await setDoc(userRef, { role: 'super_admin', department: 'Executive Command' }, { merge: true }).catch(err => {
                console.warn("Autopromotion failed in setDoc:", err);
              });
            }
            setUser({ ...firebaseUser, appData: data });
          } else {
            // Initial setup for new user
            // If they login via Google, set role as normal
            const isGoogle = firebaseUser.providerData.some(p => p.providerId === 'google.com');
            const isRajesh = firebaseUser.email?.toLowerCase() === 'rajesh.myphoneme@gmail.com';
            const defaultRole = isRajesh ? 'super_admin' : (isGoogle ? 'normal' : 'manager');

            const appData: AppUser = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Anonymous',
              email: firebaseUser.email || '',
              role: defaultRole as any, 
              department: isRajesh ? 'Executive Command' : 'Operations Control',
              createdAt: new Date().toISOString(),
            };
            await setDoc(userRef, appData).catch(e => console.warn("Failed to set initial user doc:", e));
            setUser({ ...firebaseUser, appData });
          }

          // Subscribe to changes
          if (unsubUser) unsubUser();
          unsubUser = onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data() as AppUser;
              if (firebaseUser.email?.toLowerCase() === 'rajesh.myphoneme@gmail.com' && data.role !== 'super_admin') {
                data.role = 'super_admin';
                data.department = 'Executive Command';
              }
              setUser(prev => prev ? { ...prev, appData: data } : null);
            }
          }, (error) => {
            // This happens frequently when offline or permissions change
            if (error.code !== 'permission-denied') {
              console.warn("User data snapshot error:", error);
            }
          });

          setLoading(false);
        } catch (error) {
          console.error("Error in AuthProvider sync:", error);
          setUser({ ...firebaseUser } as any);
          setLoading(false);
        }
      } else {
        if (unsubUser) unsubUser();
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubUser) unsubUser();
    };
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string, name: string, role: string, department: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (result.user) {
      const appData: AppUser = {
        uid: result.user.uid,
        name,
        email,
        role: role.toLowerCase() as any,
        department,
        createdAt: new Date().toISOString(),
      };
      const userRef = doc(db, 'users', result.user.uid);
      await setDoc(userRef, appData);
      setUser({ ...result.user, appData });
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInWithEmail, signUpWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
