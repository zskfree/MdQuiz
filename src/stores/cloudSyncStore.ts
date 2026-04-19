import { FirebaseError } from 'firebase/app'
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, type User } from 'firebase/auth'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
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
const FIRESTORE_CHUNK_MAX_BYTES = 450 * 1024

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

function buildChunkDocumentId(index: number): string {
    return `chunk-${index.toString().padStart(6, '0')}`
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = ''
    const step = 0x8000

    for (let index = 0; index < bytes.length; index += step) {
        const slice = bytes.subarray(index, index + step)
        binary += String.fromCharCode(...slice)
    }

    return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index)
    }

    return bytes
}

function encodePayloadToChunks(content: string): { chunks: string[]; byteLength: number } {
    const bytes = new TextEncoder().encode(content)
    const chunks: string[] = []

    for (let offset = 0; offset < bytes.length; offset += FIRESTORE_CHUNK_MAX_BYTES) {
        const slice = bytes.subarray(offset, offset + FIRESTORE_CHUNK_MAX_BYTES)
        chunks.push(bytesToBase64(slice))
    }

    return {
        chunks,
        byteLength: bytes.byteLength,
    }
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
    const metaRef = getCloudMetaRef(uid, services)
    const previousMetaSnapshot = await getDoc(metaRef)
    const previousChunkCount = (() => {
        const value = previousMetaSnapshot.data()?.chunkCount
        return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
    })()

    const { chunks, byteLength } = encodePayloadToChunks(JSON.stringify(payload))

    await Promise.all(
        chunks.map((chunkData, index) =>
            setDoc(
                doc(services.db, 'users', uid, CLOUD_SYNC_META_COLLECTION, buildChunkDocumentId(index)),
                {
                    index,
                    data: chunkData,
                    updatedAt: Date.now(),
                },
            ),
        ),
    )

    if (previousChunkCount > chunks.length) {
        const staleChunkIndexes = Array.from(
            { length: previousChunkCount - chunks.length },
            (_, offset) => chunks.length + offset,
        )

        await Promise.all(
            staleChunkIndexes.map((index) =>
                deleteDoc(doc(services.db, 'users', uid, CLOUD_SYNC_META_COLLECTION, buildChunkDocumentId(index))),
            ),
        )
    }

    await setDoc(
        metaRef,
        {
            app: 'mdquiz',
            version: payload.version,
            exportedAt: payload.exportedAt,
            chunkCount: chunks.length,
            payloadByteLength: byteLength,
            updatedAt: Date.now(),
            serverUpdatedAt: serverTimestamp(),
        },
        { merge: true },
    )
}

async function downloadBackup(
    uid: string,
    services: FirebaseServices,
): Promise<{ payload: BackupPayload; cloudUpdatedAt?: number }> {
    const metaSnapshot = await getDoc(getCloudMetaRef(uid, services))

    if (!metaSnapshot.exists()) {
        throw new Error('云端还没有可恢复的备份，请先执行一次上传同步。')
    }

    const metaData = metaSnapshot.data()
    const chunkCount =
        typeof metaData?.chunkCount === 'number' && Number.isFinite(metaData.chunkCount)
            ? Math.max(Math.floor(metaData.chunkCount), 0)
            : 0

    if (chunkCount <= 0) {
        throw new Error('云端备份数据不完整，请先重新执行一次上传同步。')
    }

    const chunkSnapshots = await Promise.all(
        Array.from({ length: chunkCount }, (_, index) =>
            getDoc(doc(services.db, 'users', uid, CLOUD_SYNC_META_COLLECTION, buildChunkDocumentId(index))),
        ),
    )

    const chunkBase64List = chunkSnapshots.map((snapshot, index) => {
        if (!snapshot.exists()) {
            throw new Error(`云端备份分片缺失（chunk ${index + 1}/${chunkCount}）。`)
        }

        const chunkData = snapshot.data()?.data

        if (typeof chunkData !== 'string' || chunkData.length === 0) {
            throw new Error(`云端备份分片无效（chunk ${index + 1}/${chunkCount}）。`)
        }

        return chunkData
    })

    const mergedBytes = base64ToBytes(chunkBase64List.join(''))
    const backupContent = new TextDecoder().decode(mergedBytes)
    const payload = parseBackupPayload(backupContent)
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
