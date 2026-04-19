import { DB_NAME, DB_VERSION } from '../../types'
import { migrations } from './migrations'

let dbPromise: Promise<IDBDatabase> | null = null

function runMigrations(
  db: IDBDatabase,
  transaction: IDBTransaction,
  oldVersion: number,
  newVersion: number | null,
) {
  for (let version = oldVersion + 1; version <= (newVersion ?? DB_VERSION); version += 1) {
    const migration = migrations[version]

    if (migration) {
      migration(db, transaction, oldVersion, newVersion)
    }
  }
}

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = request.result
      const transaction = request.transaction

      if (!transaction) {
        reject(new Error('IndexedDB migration transaction is unavailable.'))
        return
      }

      runMigrations(db, transaction, event.oldVersion, event.newVersion)
    }

    request.onsuccess = () => {
      const db = request.result

      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }

      resolve(db)
    }

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open IndexedDB database.'))
    }
  })

  return dbPromise
}

export async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore, transaction: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await openDatabase()

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)

    let settled = false

    const finish = (callback: () => void) => {
      if (settled) {
        return
      }

      settled = true
      callback()
    }

    transaction.oncomplete = () => {
      finish(() => undefined)
    }

    transaction.onerror = () => {
      finish(() => reject(transaction.error ?? new Error(`Transaction failed for ${storeName}.`)))
    }

    transaction.onabort = () => {
      finish(() => reject(transaction.error ?? new Error(`Transaction aborted for ${storeName}.`)))
    }

    Promise.resolve(handler(store, transaction))
      .then((result) => {
        transaction.oncomplete = () => {
          finish(() => resolve(result))
        }
      })
      .catch((error) => {
        transaction.abort()
        finish(() => reject(error))
      })
  })
}
