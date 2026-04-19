import { STORE_NAMES, type MdQuizDBSchema } from '../../types'

export type Migration = (
  db: IDBDatabase,
  transaction: IDBTransaction,
  oldVersion: number,
  newVersion: number | null,
) => void

function createStore<K extends keyof MdQuizDBSchema>(
  db: IDBDatabase,
  name: K,
  options?: IDBObjectStoreParameters,
) {
  if (db.objectStoreNames.contains(name)) {
    return
  }

  db.createObjectStore(name, options)
}

function createIndex(
  store: IDBObjectStore,
  name: string,
  keyPath: string | string[],
  options?: IDBIndexParameters,
) {
  if (store.indexNames.contains(name)) {
    return
  }

  store.createIndex(name, keyPath, options)
}

function createMemoryRecordStore(db: IDBDatabase) {
  if (db.objectStoreNames.contains(STORE_NAMES.memoryRecords)) {
    return
  }

  db.createObjectStore(STORE_NAMES.memoryRecords, { keyPath: ['libraryId', 'questionId'] })
}

function createMemoryRecordIndexes(store: IDBObjectStore) {
  createIndex(store, 'libraryId', 'libraryId')
  createIndex(store, 'level', 'level')
  createIndex(store, 'nextReviewAt', 'nextReviewAt')
  createIndex(store, 'updatedAt', 'updatedAt')
}

function isMemoryRecordKeyPathUpToDate(keyPath: string | string[] | null): boolean {
  return Array.isArray(keyPath) && keyPath.length === 2 && keyPath[0] === 'libraryId' && keyPath[1] === 'questionId'
}

export const createInitialSchema: Migration = (db, transaction) => {
  createStore(db, STORE_NAMES.libraries, { keyPath: 'id' })
  createStore(db, STORE_NAMES.questions, { keyPath: 'id' })
  createStore(db, STORE_NAMES.diagnostics, { keyPath: 'id' })
  createStore(db, STORE_NAMES.sessions, { keyPath: 'id' })
  createMemoryRecordStore(db)
  createStore(db, STORE_NAMES.examResults, { keyPath: 'id' })
  createStore(db, STORE_NAMES.imports, { keyPath: 'id' })

  const libraries = transaction.objectStore(STORE_NAMES.libraries)
  createIndex(libraries, 'sourceType', 'sourceType')
  createIndex(libraries, 'updatedAt', 'updatedAt')

  const questions = transaction.objectStore(STORE_NAMES.questions)
  createIndex(questions, 'libraryId', 'libraryId')
  createIndex(questions, 'type', 'type')
  createIndex(questions, 'difficulty', 'difficulty')
  createIndex(questions, 'scorable', 'scorable')
  createIndex(questions, 'updatedAt', 'updatedAt')
  createIndex(questions, 'tagsNormalized', 'tags', { multiEntry: true })

  const diagnostics = transaction.objectStore(STORE_NAMES.diagnostics)
  createIndex(diagnostics, 'libraryId', 'libraryId')
  createIndex(diagnostics, 'questionId', 'questionId')
  createIndex(diagnostics, 'type', 'type')
  createIndex(diagnostics, 'severity', 'severity')

  const sessions = transaction.objectStore(STORE_NAMES.sessions)
  createIndex(sessions, 'libraryId', 'libraryId')
  createIndex(sessions, 'mode', 'mode')
  createIndex(sessions, 'status', 'status')
  createIndex(sessions, 'updatedAt', 'updatedAt')

  const memoryRecords = transaction.objectStore(STORE_NAMES.memoryRecords)
  createMemoryRecordIndexes(memoryRecords)

  const examResults = transaction.objectStore(STORE_NAMES.examResults)
  createIndex(examResults, 'libraryId', 'libraryId')
  createIndex(examResults, 'submittedAt', 'submittedAt')
  createIndex(examResults, 'accuracy', 'accuracy')

  const imports = transaction.objectStore(STORE_NAMES.imports)
  createIndex(imports, 'libraryId', 'libraryId')
  createIndex(imports, 'importedAt', 'importedAt')
  createIndex(imports, 'success', 'success')
}

export const migrateMemoryRecordsToCompoundKey: Migration = (db, transaction) => {
  if (!db.objectStoreNames.contains(STORE_NAMES.memoryRecords)) {
    createMemoryRecordStore(db)
    createMemoryRecordIndexes(transaction.objectStore(STORE_NAMES.memoryRecords))
    return
  }

  const memoryRecords = transaction.objectStore(STORE_NAMES.memoryRecords)

  if (isMemoryRecordKeyPathUpToDate(memoryRecords.keyPath)) {
    createMemoryRecordIndexes(memoryRecords)
    return
  }

  const snapshotRequest = memoryRecords.getAll()

  snapshotRequest.onsuccess = () => {
    const snapshot = snapshotRequest.result

    db.deleteObjectStore(STORE_NAMES.memoryRecords)
    createMemoryRecordStore(db)

    const recreatedStore = transaction.objectStore(STORE_NAMES.memoryRecords)
    createMemoryRecordIndexes(recreatedStore)

    for (const record of snapshot) {
      recreatedStore.put(record)
    }
  }
}

export const migrations: Record<number, Migration> = {
  1: createInitialSchema,
  2: migrateMemoryRecordsToCompoundKey,
}
