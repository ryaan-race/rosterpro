import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, onSnapshot, Query, DocumentReference, QuerySnapshot, DocumentSnapshot } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const isFramed = typeof window !== 'undefined' && (window.parent !== window || window.location.hostname.includes('run.app'));

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, isFramed ? {
  experimentalForceLongPolling: true,
} : {}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// EXPOSE GLOBAL QUOTA INDICATORS
let isQuotaExceeded = false;
const quotaCallbacks = new Set<(exceeded: boolean) => void>();

export function onQuotaExceededChange(callback: (exceeded: boolean) => void) {
  quotaCallbacks.add(callback);
  callback(isQuotaExceeded);
  return () => {
    quotaCallbacks.delete(callback);
  };
}

export function setQuotaExceeded(exceeded: boolean) {
  if (isQuotaExceeded !== exceeded) {
    isQuotaExceeded = exceeded;
    quotaCallbacks.forEach(cb => cb(isQuotaExceeded));
  }
}

/**
 * Robust wrapper over Firestore’s onSnapshot with local storage fallback caching
 * to protect the application from raw Firebase console failures when free tier daily reads quotas are exhausted.
 */
export function onSnapshotSafe<T = any>(
  refTarget: Query | DocumentReference,
  onNext: (data: T[]) => void,
  onError?: (error: any) => void,
  cacheKey?: string
): () => void {
  // 1. Optimistic Offline Cache Read (immediate rendering, 0ms latency)
  if (cacheKey) {
    try {
      const serialized = localStorage.getItem(`shiftsync_cache_${cacheKey}`);
      if (serialized) {
        const parsed = JSON.parse(serialized);
        onNext(parsed);
      }
    } catch (cacheReadErr) {
      console.warn("Optimistic local cache fetch skipped:", cacheReadErr);
    }
  }

  // 2. Setup standard onSnapshot subscription
  const unsub = onSnapshot(
    refTarget as any,
    (snapshot: any) => {
      let dataset: T[] = [];
      
      // Determine if snapshot is query or document
      if (snapshot.docs) {
        // QuerySnapshot
        dataset = (snapshot as QuerySnapshot).docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any;
      } else if (snapshot.exists) {
        // DocumentSnapshot
        dataset = [{
          id: (snapshot as DocumentSnapshot).id,
          ...(snapshot as DocumentSnapshot).data()
        }] as any;
      }

      // Safe update
      onNext(dataset);

      // Write-through local cache update
      if (cacheKey && dataset.length > 0) {
        try {
          localStorage.setItem(`shiftsync_cache_${cacheKey}`, JSON.stringify(dataset));
        } catch (cacheWriteErr) {
          console.warn("Write-through cache update failed:", cacheWriteErr);
        }
      }
    },
    (firebaseError: any) => {
      // 3. Catch Quota Rules beautifully to notify client
      const errMsg = firebaseError?.message || '';
      const isQuota = firebaseError?.code === 'resource-exhausted' || errMsg.includes('Quota') || errMsg.includes('exceeded') || errMsg.includes('quota');
      
      if (isQuota) {
        setQuotaExceeded(true);
        console.warn(`[Firestore Safe Fallback Cache Active]: Daily reads quota exceeded. Local cached copy is active for target key: "${cacheKey || 'anonymous'}".`);
        return; // Suppress standard query error bubble to clear console traces
      }

      if (onError) {
        onError(firebaseError);
      } else {
        console.warn(`Safe subscription error skipped (${cacheKey}):`, firebaseError);
      }
    }
  );

  return unsub;
}

/**
 * Single document version of onSnapshotSafe with local storage fallback caching.
 */
export function onSnapshotDocSafe<T = any>(
  docRef: DocumentReference,
  onNext: (data: T) => void,
  onError?: (error: any) => void,
  cacheKey?: string
): () => void {
  if (cacheKey) {
    try {
      const serialized = localStorage.getItem(`shiftsync_doc_cache_${cacheKey}`);
      if (serialized) {
        onNext(JSON.parse(serialized));
      }
    } catch (e) {
      console.warn("Doc local cache read skipped:", e);
    }
  }

  const unsub = onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as T;
        onNext(data);
        if (cacheKey) {
          try {
            localStorage.setItem(`shiftsync_doc_cache_${cacheKey}`, JSON.stringify(data));
          } catch (e) {
            console.warn("Doc local cache write failed:", e);
          }
        }
      }
    },
    (error: any) => {
      const errMsg = error?.message || '';
      const isQuota = error?.code === 'resource-exhausted' || errMsg.includes('Quota') || errMsg.includes('exceeded') || errMsg.includes('quota');
      if (isQuota) {
        setQuotaExceeded(true);
        console.warn(`[Firestore Safe Fallback Cache Active]: Document read quota exceeded. Local cached copy is active for target key: "${cacheKey || 'anonymous'}".`);
        return; // Suppress standard error to avoid console warn/error traces
      }
      if (onError) onError(error);
    }
  );

  return unsub;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
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
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Removed testConnection diagnostic as it causes noise in console when offline
