import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, collection, doc, setDoc, getDoc, updateDoc, onSnapshot, query, where, orderBy, addDoc, serverTimestamp, getDocFromServer, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// We'll try to import the config, but fallback to empty if it doesn't exist yet
// The AIS environment will provide this file.
import firebaseConfig from '../../firebase-applet-config.json';
import { safeStringify } from './utils';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore. We'll use default settings but keep experimental ignoreUndefined for clean payloads.
// experimentalForceLongPolling is often required in proxied or restricted environments (like Cloud Run/AIS)
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId || '(default)');

// Persistence disabled to resolve internal assertion errors in restricted environments
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Error handler as per guidelines
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
  const stringified = safeStringify(errInfo);
  console.error('Firestore Error: ', stringified);
  throw new Error(stringified);
}

// Connection test with a small delay to ensure network readiness
async function testConnection() {
  await new Promise(resolve => setTimeout(resolve, 2000));
  try {
    console.log("Firebase Config Status:", {
      hasProjectId: !!firebaseConfig.projectId,
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId
    });
    console.log("Testing Firestore connection...");
    const testDoc = await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful. Data exists:", testDoc.exists());
  } catch (error: any) {
    console.error("Firestore connection test failed:", {
      code: error.code,
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    if(error.code === 'unavailable') {
      console.error("The Firestore backend is unavailable. Switching to default database fallback is not possible at runtime for individual exports, but please verify service status.");
    }
  }
}
testConnection();
