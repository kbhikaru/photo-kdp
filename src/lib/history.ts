import { v4 as uuid } from 'uuid';
import { addHistoryEntry, getAllHistoryEntries, getSetting, setSetting } from './db';
import type { HistoryAction, HistoryEntry } from '../types';

const ACTOR_NAME_KEY = 'actorName';
const UNSET_ACTOR_LABEL = '未設定';

export async function getActorName(): Promise<string> {
  return (await getSetting<string>(ACTOR_NAME_KEY)) ?? '';
}

export async function setActorName(name: string): Promise<void> {
  await setSetting(ACTOR_NAME_KEY, name);
}

export async function recordHistory(actor: string, action: HistoryAction, summary: string, propertyId?: string): Promise<void> {
  const entry: HistoryEntry = {
    id: uuid(),
    timestamp: new Date().toISOString(),
    actor: actor || UNSET_ACTOR_LABEL,
    action,
    summary,
    propertyId,
  };
  await addHistoryEntry(entry);
}

export async function listHistory(): Promise<HistoryEntry[]> {
  const entries = await getAllHistoryEntries();
  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
