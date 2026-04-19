import type { MemoryRecord } from '../../../types'
import { STORE_NAMES } from '../../../types'
import { getAllValues, putValue, putValues } from './common'

export async function loadMemoryRecords(): Promise<MemoryRecord[]> {
  return getAllValues<MemoryRecord>(STORE_NAMES.memoryRecords)
}

export async function saveMemoryRecord(record: MemoryRecord): Promise<void> {
  await putValue(STORE_NAMES.memoryRecords, record)
}

export async function saveMemoryRecords(records: MemoryRecord[]): Promise<void> {
  await putValues(STORE_NAMES.memoryRecords, records)
}
