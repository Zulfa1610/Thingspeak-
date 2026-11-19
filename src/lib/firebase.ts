import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  type Firestore,
} from 'firebase/firestore';
import { getDatabase, type Database } from 'firebase/database';
import firebaseConfig from '../../firebase-applet-config.json';

const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const provisionedProjectInfo = {
  projectId: firebaseConfig.projectId,
  firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
  authDomain: firebaseConfig.authDomain,
};

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

export function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): FirestoreErrorInfo {
  return {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<{ ok: boolean; offline: boolean; message: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true, offline: false, message: 'Firestore reachable' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const offline = message.toLowerCase().includes('the client is offline');
    if (offline) {
      console.error('Please check your Firebase configuration.');
      return { ok: false, offline: true, message: 'Client is offline' };
    }
    // Permission error when unauthenticated still proves Firestore server is reachable
    if (message.toLowerCase().includes('permission') || message.toLowerCase().includes('insufficient')) {
      return { ok: true, offline: false, message: 'Firestore server reachable (authentication required for protected reads)' };
    }
    return { ok: false, offline: false, message };
  }
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutOperator(): Promise<void> {
  await signOut(auth);
}

const rtdbAppsCache = new Map<string, Database>();

export function getRealtimeDbForUrl(databaseUrl: string): Database {
  const trimmed = databaseUrl.trim();
  if (!trimmed) {
    throw new Error('Firebase Realtime Database URL is required.');
  }
  const existing = rtdbAppsCache.get(trimmed);
  if (existing) {
    return existing;
  }
  const safeName = `rtdb-${trimmed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}`;
  const existingApp = getApps().find((a) => a.name === safeName);
  const rtdbApp =
    existingApp ||
    initializeApp(
      {
        ...firebaseConfig,
        databaseURL: trimmed,
      },
      safeName,
    );
  const rtdb = getDatabase(rtdbApp, trimmed);
  rtdbAppsCache.set(trimmed, rtdb);
  return rtdb;
}
