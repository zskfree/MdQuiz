import { withStore } from '../db'
import type { StoreName } from '../../../types'

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
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
