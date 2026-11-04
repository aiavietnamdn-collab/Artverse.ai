import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithCustomToken, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};

export const resolvedFirebaseConfig = {
  ...firebaseConfig,
  projectId: (metaEnv.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId).trim(),
  appId: (metaEnv.VITE_FIREBASE_APP_ID || firebaseConfig.appId).trim(),
  apiKey: (metaEnv.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey).trim(),
  authDomain: (metaEnv.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain).trim(),
  firestoreDatabaseId: (
    metaEnv.VITE_FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId
  ).trim(),
  storageBucket: (metaEnv.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket).trim(),
  messagingSenderId: (
    metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId
  ).trim(),
};

// Initialize Firebase
const app = initializeApp(resolvedFirebaseConfig);

// Initialize Firestore with the specific database ID (CRITICAL)
export const db = getFirestore(app, resolvedFirebaseConfig.firestoreDatabaseId);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Cloud Storage with bounded retry timeouts so failed/unreachable buckets never hang at 95%
export const storage = getStorage(app);
storage.maxUploadRetryTime = 10000; // 10s max retry instead of 10-minute default
storage.maxOperationRetryTime = 8000; // 8s max operation retry instead of 2-minute default

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
  };
}

export function isOfflineOrTokenServiceError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('the client is offline') ||
    msg.includes('client is offline') ||
    msg.includes('token-service-api') ||
    msg.includes('securetoken.googleapis.com') ||
    msg.includes('Fetching auth token failed') ||
    msg.includes('unavailable')
  );
}

/**
 * Standard Firestore Error Handler conforming to specification
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  if (isOfflineOrTokenServiceError(error)) {
    console.warn('Firestore đang ở chế độ ngoại tuyến hoặc đồng bộ cục bộ:', errInfo.path);
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validates connection to Firestore at startup
 */
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (isOfflineOrTokenServiceError(error)) {
      console.warn('Firebase client is offline or database initializing.');
      return false;
    }
    // Permissions error on non-existent test doc is expected and indicates server responded
    return true;
  }
}

export const signInWithGoogle = async () => {
  return signInWithPopup(auth, googleProvider);
};

export const logOut = async () => {
  return signOut(auth);
};

export { signInWithPopup, signInWithCustomToken, signOut };


