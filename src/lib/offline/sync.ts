"use client";

import { addExpense } from "@/lib/actions/expenses";
import { settleUp } from "@/lib/actions/settlements";
import { getDB } from "./db";
import { removeMutation, updateMutationStatus } from "./queue";

type Listener = () => void;
const listeners = new Set<Listener>();

export function onQueueChange(cb: Listener) {
	listeners.add(cb);
	return () => listeners.delete(cb);
}

function notify() {
	listeners.forEach((cb) => cb());
}

let syncing = false;

export async function flushQueue() {
	if (syncing || !navigator.onLine) return;
	syncing = true;

	try {
		const db = await getDB();
		const all = await db.getAll("mutations");
		const sorted = all.sort((a, b) => a.createdAt - b.createdAt);

		for (const mutation of sorted) {
			try {
				await updateMutationStatus(mutation.id, "syncing");
				if (mutation.type === "add_expense") {
					await addExpense(mutation.payload);
				} else {
					await settleUp(mutation.payload);
				}
				await removeMutation(mutation.id);
				notify();
			} catch (err) {
				await updateMutationStatus(mutation.id, "failed", err instanceof Error ? err.message : "Sync failed");
				notify();
				if (!navigator.onLine) break;
			}
		}
	} finally {
		syncing = false;
	}
}

export function initSyncListeners() {
	if (typeof window === "undefined") return;
	window.addEventListener("online", flushQueue);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible" && navigator.onLine) flushQueue();
	});
	if (navigator.onLine) flushQueue();
}
