import { FirebaseError, getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

type FirebaseEnv = {
  VITE_FIREBASE_API_KEY?: string
  VITE_FIREBASE_AUTH_DOMAIN?: string
  VITE_FIREBASE_PROJECT_ID?: string
  VITE_FIREBASE_STORAGE_BUCKET?: string
  VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  VITE_FIREBASE_APP_ID?: string
}

const env = import.meta.env as ImportMetaEnv & FirebaseEnv

const firebaseConfig: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

const requiredFirebaseConfigEntries = [
  ['VITE_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['VITE_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
  ['VITE_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
  ['VITE_FIREBASE_STORAGE_BUCKET', firebaseConfig.storageBucket],
  ['VITE_FIREBASE_MESSAGING_SENDER_ID', firebaseConfig.messagingSenderId],
  ['VITE_FIREBASE_APP_ID', firebaseConfig.appId],
] as const

export const missingFirebaseConfigKeys = requiredFirebaseConfigEntries
  .filter(([, value]) => !value)
  .map(([name]) => name)

export const isFirebaseConfigured = missingFirebaseConfigKeys.length === 0

let firebaseAuth: Auth | undefined
let firebaseDb: Firestore | undefined
let firebaseStorage: FirebaseStorage | undefined

if (isFirebaseConfigured) {
  const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
  firebaseAuth = getAuth(firebaseApp)
  firebaseDb = getFirestore(firebaseApp)
  firebaseStorage = getStorage(firebaseApp)
}

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export type FirebaseServices = {
  auth: Auth
  db: Firestore
  storage: FirebaseStorage
  googleProvider: GoogleAuthProvider
}

function resolveMissingConfigMessage(): string {
  if (missingFirebaseConfigKeys.length === 0) {
    return 'Firebase 配置不完整，请检查 VITE_FIREBASE_* 环境变量。'
  }

  return `Firebase 配置不完整，缺少：${missingFirebaseConfigKeys.join(', ')}。`
}

export function getFirebaseServices(): FirebaseServices {
  if (!isFirebaseConfigured || !firebaseAuth || !firebaseDb || !firebaseStorage) {
    throw new FirebaseError('app/firebase-config-missing', resolveMissingConfigMessage())
  }

  return {
    auth: firebaseAuth,
    db: firebaseDb,
    storage: firebaseStorage,
    googleProvider,
  }
}
