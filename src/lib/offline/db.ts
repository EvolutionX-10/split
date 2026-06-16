import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AddExpenseInput } from "@/lib/actions/expenses";
import type { SettleUpInput } from "@/lib/actions/settlements";

export type QueuedMutation =
	| {
			id: string;
			type: "add_expense";
			groupId: string;
			payload: AddExpenseInput;
			status: "pending" | "syncing" | "failed";
			createdAt: number;
			retryCount: number;
			error?: string;
	  }
	| {
			id: string;
			type: "settle_up";
			groupId: string;
			payload: SettleUpInput;
			status: "pending" | "syncing" | "failed";
			createdAt: number;
			retryCount: number;
			error?: string;
	  };

interface OfflineDB extends DBSchema {
	mutations: {
		key: string;
		value: QueuedMutation;
		indexes: { "by-groupId": string };
	};
}

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

export function getDB() {
	if (!dbPromise) {
		dbPromise = openDB<OfflineDB>("split-offline", 1, {
			upgrade(db) {
				const store = db.createObjectStore("mutations", { keyPath: "id" });
				store.createIndex("by-groupId", "groupId");
			},
		});
	}
	return dbPromise;
}
