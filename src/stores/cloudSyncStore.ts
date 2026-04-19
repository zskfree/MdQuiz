import { FirebaseError } from 'firebase/app'
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, type User } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getBytes, ref, uploadString } from 'firebase/storage'
import { create } from 'zustand'
import { type BackupPayload, createBackupPayload, parseBackupPayload } from '../core/import-export'
import {
    getFirebaseServices,
    isFirebaseConfigured,
    missingFirebaseConfigKeys,
    type FirebaseServices,
} from '../core/cloud/firebase'
import { useExamStore } from './examStore'
import { useLibraryStore } from './libraryStore'
import { useReviewStore } from './reviewStore'
import { useSessionStore } from './sessionStore'

type CloudUser = {
    uid: string
    displayName?: string
    email?: string
    photoURL?: string
}

type CloudSyncState = {
    initialized: boolean
    user?: CloudUser
    isSyncing: boolean
    autoSyncEnabled: boolean
    lastSyncedAt?: number
    lastCloudUpdatedAt?: number
    lastError?: string
    initialize: () => void
    setAutoSyncEnabled: (enabled: boolean) => void
    signInWithGoogle: () => Promise<void>
    signOut: () => Promise<void>
    uploadNow: () => Promise<void>
    downloadNow: () => Promise<void>
}

const AUTO_SYNC_STORAGE_KEY = 'mdquiz.cloud.autoSyncEnabled'
const CLOUD_SYNC_META_COLLECTION = 'sync'
const CLOUD_SYNC_META_DOC_ID = 'meta'
const CLOUD_BACKUP_FILE_PATH = 'backups/latest.json'

let hasInitializedAuthListener = false

function readAutoSyncSetting(): boolean {
    if (typeof window === 'undefined') {
        return false
    }

    return window.localStorage.getItem(AUTO_SYNC_STORAGE_KEY) === '1'
}

function persistAutoSyncSetting(enabled: boolean): void {
    if (typeof window === 'undefined') {
        return
    }

    if (enabled) {
        window.localStorage.setItem(AUTO_SYNC_STORAGE_KEY, '1')
        return
    }

    window.localStorage.removeItem(AUTO_SYNC_STORAGE_KEY)
}

function mapAuthUser(user: User): CloudUser {
    return {
        uid: user.uid,
        displayName: user.displayName ?? undefined,
        email: user.email ?? undefined,
        photoURL: user.photoURL ?? undefined,
    }
}

function resolveVisibleError(error: unknown, fallbackMessage: string): string {
    if (error instanceof FirebaseError) {
        if (error.code === 'auth/popup-closed-by-user') {
            return '你已取消 Google 登录。'
        }

        if (error.code === 'auth/cancelled-popup-request') {
            return '登录窗口已被新的请求替换，请重试。'
        }

        if (error.code === 'storage/object-not-found') {
            return '云端还没有可恢复的备份，请先执行一次上传同步。'
        }

        if (error.code === 'storage/unauthorized') {
            return '云端同步权限不足，请确认 Storage 规则是否仅允许当前用户访问。'
        }

        if (error.code === 'permission-denied') {
            return 'Firestore 权限不足，请确认规则是否允许当前用户写入同步元数据。'
        }

        if (error.message && /[\u4e00-\u9fa5]/.test(error.message)) {
            return error.message
        }
    }

    if (error instanceof Error && /[\u4e00-\u9fa5]/.test(error.message)) {
        return error.message
    }

    return fallbackMessage
}

function resolveMissingConfigMessage(): string {
    if (missingFirebaseConfigKeys.length === 0) {
        return 'Firebase 配置不完整，云同步不可用。'
    }

    return `Firebase 配置不完整，缺少：${missingFirebaseConfigKeys.join(', ')}。`
}

function getCloudMetaRef(uid: string, services: FirebaseServices) {
    return doc(services.db, 'users', uid, CLOUD_SYNC_META_COLLECTION, CLOUD_SYNC_META_DOC_ID)
}

function getCloudBackupRef(uid: string, services: FirebaseServices) {
    return ref(services.storage, `users/${uid}/${CLOUD_BACKUP_FILE_PATH}`)
}

function createCurrentBackupPayload(): BackupPayload {
    const libraryState = useLibraryStore.getState()
    const reviewState = useReviewStore.getState()
    const sessionState = useSessionStore.getState()
    const examState = useExamStore.getState()
    const activeLibrary = libraryState.getActiveLibrary()

    return createBackupPayload({
        activeLibraryId: activeLibrary?.id,
        libraries: libraryState.getAllLibraries(),
        questions: Object.values(libraryState.questions),
        diagnostics: Object.values(libraryState.diagnostics).flat(),
        memoryRecords: Object.values(reviewState.memoryRecords),
        sessions: sessionState.currentSession ? [sessionState.currentSession] : [],
        examResults: Object.values(examState.results),
    })
}

async function restoreFromBackupPayload(payload: BackupPayload): Promise<void> {
    const libraryState = useLibraryStore.getState()
    const reviewState = useReviewStore.getState()
    const sessionState = useSessionStore.getState()
    const examState = useExamStore.getState()

    await libraryState.restoreBackup({
        libraries: payload.data.libraries,
        questions: payload.data.questions,
        diagnostics: payload.data.diagnostics,
        activeLibraryId: payload.meta.activeLibraryId,
    })
    await reviewState.restoreBackup(payload.data.memoryRecords)
    await sessionState.restoreBackup(payload.data.sessions)
    await examState.restoreBackup(payload.data.examResults)
}

async function uploadBackup(uid: string, payload: BackupPayload, services: FirebaseServices): Promise<void> {
    const backupRef = getCloudBackupRef(uid, services)
    const jsonContent = JSON.stringify(payload)

    await uploadString(backupRef, jsonContent, 'raw', {
        contentType: 'application/json; charset=utf-8',
    })

    await setDoc(
        getCloudMetaRef(uid, services),
        {
            app: 'mdquiz',
            version: payload.version,
            exportedAt: payload.exportedAt,
            updatedAt: Date.now(),
            serverUpdatedAt: serverTimestamp(),
            backupPath: backupRef.fullPath,
        },
        { merge: true },
    )
}

async function downloadBackup(
    uid: string,
    services: FirebaseServices,
): Promise<{ payload: BackupPayload; cloudUpdatedAt?: number }> {
    const [backupBytes, metaSnapshot] = await Promise.all([
        getBytes(getCloudBackupRef(uid, services)),
        getDoc(getCloudMetaRef(uid, services)),
    ])

    const backupContent = new TextDecoder().decode(backupBytes)
    const payload = parseBackupPayload(backupContent)

    const metaData = metaSnapshot.data()
    const cloudUpdatedAt = typeof metaData?.updatedAt === 'number' ? metaData.updatedAt : payload.exportedAt

    return { payload, cloudUpdatedAt }
}

export const useCloudSyncStore = create<CloudSyncState>((set, get) => ({
    initialized: false,
    user: undefined,
    isSyncing: false,
    autoSyncEnabled: readAutoSyncSetting(),
    lastSyncedAt: undefined,
    lastCloudUpdatedAt: undefined,
    lastError: undefined,

    initialize: () => {
        if (!isFirebaseConfigured) {
            set({
                initialized: true,
                lastError: resolveMissingConfigMessage(),
            })
            return
        }

        if (hasInitializedAuthListener) {
            set({ initialized: true, autoSyncEnabled: readAutoSyncSetting() })
            return
        }

        hasInitializedAuthListener = true

        const { auth } = getFirebaseServices()

        onAuthStateChanged(auth, (user) => {
            set({
                user: user ? mapAuthUser(user) : undefined,
            })
        })

        set({
            initialized: true,
            autoSyncEnabled: readAutoSyncSetting(),
            lastError: undefined,
        })
    },

    setAutoSyncEnabled: (enabled) => {
        persistAutoSyncSetting(enabled)
        set({ autoSyncEnabled: enabled })
    },

    signInWithGoogle: async () => {
        if (!isFirebaseConfigured) {
            const message = resolveMissingConfigMessage()
            set({ lastError: message })
            throw new Error(message)
        }

        set({ lastError: undefined })

        try {
            const { auth, googleProvider } = getFirebaseServices()
            await signInWithPopup(auth, googleProvider)
        } catch (error) {
            const message = resolveVisibleError(error, 'Google 登录失败。')
            set({ lastError: message })
            throw new Error(message)
        }
    },

    signOut: async () => {
        set({ lastError: undefined })

        try {
            const { auth } = getFirebaseServices()
            await firebaseSignOut(auth)
            set({ user: undefined })
        } catch (error) {
            const message = resolveVisibleError(error, '退出登录失败。')
            set({ lastError: message })
            throw new Error(message)
        }
    },

    uploadNow: async () => {
        const user = get().user

        if (!user) {
            throw new Error('请先登录 Google 账号。')
        }

        if (get().isSyncing) {
            return
        }

        set({ isSyncing: true, lastError: undefined })

        try {
            const services = getFirebaseServices()
            const payload = createCurrentBackupPayload()
            await uploadBackup(user.uid, payload, services)
            const now = Date.now()

            set({
                isSyncing: false,
                lastSyncedAt: now,
                lastCloudUpdatedAt: now,
                lastError: undefined,
            })
        } catch (error) {
            const message = resolveVisibleError(error, '上传同步失败。')
            set({ isSyncing: false, lastError: message })
            throw new Error(message)
        }
    },

    downloadNow: async () => {
        const user = get().user

        if (!user) {
            throw new Error('请先登录 Google 账号。')
        }

        if (get().isSyncing) {
            return
        }

        set({ isSyncing: true, lastError: undefined })

        try {
            const services = getFirebaseServices()
            const { payload, cloudUpdatedAt } = await downloadBackup(user.uid, services)
            await restoreFromBackupPayload(payload)

            set({
                isSyncing: false,
                lastSyncedAt: Date.now(),
                lastCloudUpdatedAt: cloudUpdatedAt,
                lastError: undefined,
            })
        } catch (error) {
            const message = resolveVisibleError(error, '下载同步失败。')
            set({ isSyncing: false, lastError: message })
            throw new Error(message)
        }
    },
}))
