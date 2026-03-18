/**
 * Firebase Authentication Context
 * Manages user authentication and session state
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  setPersistence,
  browserLocalPersistence,
  User,
  UserCredential,
} from 'firebase/auth';
import app from './firebase';
import { initObservability } from './observability';
import { logError, logInfo } from './logger';
import { clearRoleCookie } from './role-cookie';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isSignedIn: boolean;
  signUp: (email: string, password: string) => Promise<UserCredential>;
  signIn: (email: string, password: string) => Promise<UserCredential>;
  signOut: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const isBrowser = typeof window !== 'undefined';
  const [isLoading, setIsLoading] = useState(isBrowser);
  const [error, setError] = useState<string | null>(null);
  const auth = isBrowser && app ? getAuth(app) : null;

  // Set persistence to local
  useEffect(() => {
    initObservability();
    if (!auth) return;
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      logError('auth.persistence.error', err, {});
    });
  }, [auth]);

  // Listen for auth state changes
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setIsLoading(false);
        if (!currentUser) {
          clearRoleCookie();
        }
        logInfo('auth.state.changed', { isSignedIn: Boolean(currentUser), uid: currentUser?.uid });
      },
      (err) => {
        logError('auth.state.error', err, {});
        setError(err.message);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [auth]);

  const signUp = async (email: string, password: string): Promise<UserCredential> => {
    setError(null);
    if (!auth) {
      const err = new Error('Auth is not initialized');
      setError(err.message);
      throw err;
    }
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      setUser(result.user);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setError(message);
      logError('auth.signup.error', err, { email });
      throw err;
    }
  };

  const signIn = async (email: string, password: string): Promise<UserCredential> => {
    setError(null);
    if (!auth) {
      const err = new Error('Auth is not initialized');
      setError(err.message);
      throw err;
    }
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      setUser(result.user);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      logError('auth.signin.error', err, { email });
      throw err;
    }
  };

  const signOut = async (): Promise<void> => {
    setError(null);
    if (!auth) {
      const err = new Error('Auth is not initialized');
      setError(err.message);
      throw err;
    }
    try {
      await firebaseSignOut(auth);
      setUser(null);
      clearRoleCookie();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Logout failed';
      setError(message);
      logError('auth.signout.error', err, { uid: user?.uid });
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isSignedIn: !!user,
        signUp,
        signIn,
        signOut,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
