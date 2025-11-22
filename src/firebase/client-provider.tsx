
'use client';

import React, { useMemo, type ReactNode, useEffect, useState, useCallback } from 'react';
import { FirebaseProvider, useFirebase, useFirestore, useAuth } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { allCategories } from '@/lib/data';
import { processRecurringTransactions } from '@/lib/recurring-transactions-service';
import type { RecurringTransaction, Account } from '@/lib/types';
import { usePathname, useRouter } from 'next/navigation';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

const UNPROTECTED_PATHS = ['/login'];

async function initializeUserSession(firestore: any, user: User) {
    if (!firestore || !user) return;

    // Use sessionStorage to check if initialization has already run in this session
    const sessionInitialized = sessionStorage.getItem('sessionInitialized');
    if (sessionInitialized === 'true') {
        return;
    }

    const hasSeededInternalRef = doc(firestore, `users/${user.uid}/_internal/status`);
    const hasSeededSnap = await getDoc(hasSeededInternalRef);

    if (!hasSeededSnap.exists() || !hasSeededSnap.data()?.seeded) {
        console.log("Running initial data seeding for new user.");
        const seedBatch = writeBatch(firestore);
        
        allCategories.forEach((category) => {
            const { id, icon, ...categoryData } = category;
            const categoryRef = doc(firestore, `users/${user.uid}/categories/${id}`);
            seedBatch.set(categoryRef, categoryData);
        });
        
        seedBatch.set(hasSeededInternalRef, { seeded: true }, { merge: true });
        await seedBatch.commit();
    }

    const recurringTransactionsCollectionRef = collection(firestore, `users/${user.uid}/recurring_transactions`);
    const accountsCollectionRef = collection(firestore, `users/${user.uid}/accounts`);
    
    const [recurringTransactionsSnap, accountsSnap] = await Promise.all([
        getDocs(recurringTransactionsCollectionRef),
        getDocs(accountsCollectionRef)
    ]);
    
    const recurringTransactionsData = recurringTransactionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RecurringTransaction[];
    const accountsData = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Account[];

    if (recurringTransactionsData.length > 0 && accountsData.length > 0) {
        await processRecurringTransactions(firestore, user.uid, recurringTransactionsData, accountsData);
    }

    // Set the flag in sessionStorage after successful initialization
    sessionStorage.setItem('sessionInitialized', 'true');
}

function AuthHandler({ children }: { children: ReactNode }) {
  const { user, isSessionInitialized } = useFirebase();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  
  useEffect(() => {
    if (!isSessionInitialized) return;

    if (user) {
        initializeUserSession(firestore, user);
        if (pathname === '/login') {
          router.push('/');
        }
    } else {
      const isProtectedRoute = !UNPROTECTED_PATHS.includes(pathname);
      if (isProtectedRoute) {
        router.push('/login');
      }
    }
  }, [user, isSessionInitialized, firestore, pathname, router]);

  if (!isSessionInitialized) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
          <p>Loading...</p>
      </div>
    );
  }

  // If we are on a protected route and there is no user, show loading while redirect happens
  if (!user && !UNPROTECTED_PATHS.includes(pathname)) {
     return (
      <div className="flex h-screen w-screen items-center justify-center">
          <p>Redirecting to login...</p>
      </div>
    );
  }

  return <>{children}</>;
}


export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [isSessionInitialized, setIsSessionInitialized] = useState(false);

  const firebaseServices = useMemo(() => {
    return initializeFirebase();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseServices.auth, () => {
      if (!isSessionInitialized) {
          setIsSessionInitialized(true);
      }
    });
    
    // Clear session storage on sign out
    const auth = firebaseServices.auth;
    const handleSignOut = () => {
        if (!auth.currentUser) {
            sessionStorage.removeItem('sessionInitialized');
        }
    };
    const unsubscribeSignOut = onAuthStateChanged(auth, handleSignOut);


    return () => {
        unsubscribe();
        unsubscribeSignOut();
    };
  }, [firebaseServices.auth, isSessionInitialized]);

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
      isSessionInitialized={isSessionInitialized}
    >
      <AuthHandler>
        {children}
      </AuthHandler>
    </FirebaseProvider>
  );
}
