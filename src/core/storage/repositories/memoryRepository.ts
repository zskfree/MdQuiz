import type { MemoryRecord } from '../../../types'
import { STORE_NAMES } from '../../../types'
import { deleteValuesByIndex, getAllValues, putValue, putValues } from './common'

export async function loadMemoryRecords(): Promise<MemoryRecord[]> {
  return getAllValues<MemoryRecord>(STORE_NAMES.memoryRecords)
}

export async function saveMemoryRecord(record: MemoryRecord): Promise<void> {
  await putValue(STORE_NAMES.memoryRecords, record)
}

export async function saveMemoryRecords(records: MemoryRecord[]): Promise<void> {
  await putValues(STORE_NAMES.memoryRecords, records)
}

export async function deleteMemoryRecordsByLibrary(libraryId: string): Promise<number> {
  return deleteValuesByIndex(STORE_NAMES.memoryRecords, 'libraryId', libraryId)
}
