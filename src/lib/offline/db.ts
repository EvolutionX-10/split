import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { MutationRequest } from "./protocol";

export type QueuedMutation = MutationRequest & {
	id: string;
	ownerId: string;
	version: 2;
	status: "pending" | "syncing" | "failed" | "paused";
	createdAt: number;
	error?: string;
};
interface OfflineDB extends DBSchema {
	// Unowned version-1 rows are preserved but never displayed or replayed by an account.
	mutations: { key: string; value: unknown; indexes: { "by-groupId": string } };
	ownedMutations: { key: [string, string]; value: QueuedMutation; indexes: { "by-owner": string } };
}
let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;
export function getDB() {
	if (!dbPromise)
		dbPromise = openDB<OfflineDB>("split-offline", 2, {
			upgrade(db) {
				if (!db.objectStoreNames.contains("mutations"))
					db.createObjectStore("mutations", { keyPath: "id" }).createIndex("by-groupId", "groupId");
				if (!db.objectStoreNames.contains("ownedMutations"))
					db.createObjectStore("ownedMutations", { keyPath: ["ownerId", "id"] }).createIndex("by-owner", "ownerId");
			},
			blocking() {
				void dbPromise?.then((db) => db.close());
				dbPromise = null;
			},
			blocked() {
				if (typeof window !== "undefined") window.dispatchEvent(new Event("split-storage-blocked"));
			},
		}).catch((error) => {
			dbPromise = null;
			throw error;
		});
	return dbPromise;
}
