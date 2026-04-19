import { withStore } from '../db'
import type { StoreName } from '../../../types'

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

async function deleteWithCursor(cursorRequest: IDBRequest<IDBCursorWithValue | null>): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    let deletedCount = 0

    cursorRequest.onerror = () => {
      reject(cursorRequest.error ?? new Error('IndexedDB cursor request failed.'))
    }

    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result

      if (!cursor) {
        resolve(deletedCount)
        return
      }

      const deleteRequest = cursor.delete()

      deleteRequest.onerror = () => {
        reject(deleteRequest.error ?? new Error('IndexedDB delete request failed.'))
      }

      deleteRequest.onsuccess = () => {
        deletedCount += 1
        cursor.continue()
      }
    }
  })
}

export async function getAllValues<T>(storeName: StoreName): Promise<T[]> {
  return withStore(storeName, 'readonly', async (store) => {
    const result = await requestToPromise(store.getAll() as IDBRequest<T[]>)
    return result
  })
}

export async function getValue<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return withStore(storeName, 'readonly', async (store) => {
    const result = await requestToPromise(store.get(key) as IDBRequest<T | undefined>)
    return result
  })
}

export async function putValue<T>(storeName: StoreName, value: T): Promise<void> {
  await withStore(storeName, 'readwrite', async (store) => {
    await requestToPromise(store.put(value))
  })
}

export async function putValues<T>(storeName: StoreName, values: T[]): Promise<void> {
  await withStore(storeName, 'readwrite', async (store) => {
    for (const value of values) {
      await requestToPromise(store.put(value))
    }
  })
}

export async function deleteValuesByIndex(
  storeName: StoreName,
  indexName: string,
  key: IDBValidKey,
): Promise<number> {
  return withStore(storeName, 'readwrite', async (store) => {
    const index = store.index(indexName)
    const cursorRequest = index.openCursor(IDBKeyRange.only(key))
    return deleteWithCursor(cursorRequest)
  })
}
