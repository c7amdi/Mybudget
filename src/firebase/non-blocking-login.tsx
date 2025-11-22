
'use client';
import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  signInAnonymously(authInstance).catch(error => {
      // Although we don't have a specific error type for auth,
      // we can still log it or handle it in a generic way if needed.
      console.error("Anonymous sign-in failed:", error);
  });
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string, photoURL?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    createUserWithEmailAndPassword(authInstance, email, password)
      .then(async (userCredential) => {
        if (photoURL && userCredential.user) {
            await updateProfile(userCredential.user, { photoURL });
        }
        resolve();
      })
      .catch(error => {
        console.error("Email sign-up failed:", error);
        reject(error);
      });
  });
}

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
        signInWithEmailAndPassword(authInstance, email, password)
            .then(() => resolve())
            .catch(error => {
                if (error.code === 'auth/invalid-credential') {
                  reject(new Error("Invalid credentials. Please check your email and password."));
                } else {
                  console.error("Email sign-in failed:", error);
                  reject(error);
                }
            });
    });
}
