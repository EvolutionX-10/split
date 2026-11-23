"use client";
import { replayMutation } from "@/lib/actions/replay";
import { replayOwnedQueue } from "./engine";
import { activeAccount } from "./account";
import { enqueueMutation, getMutation, type MutationDraft } from "./queue";
export { onQueueChange } from "./events";

const running = new Map<string, Promise<void>>();
export function flushQueue(ownerId: string) {
	if (running.has(ownerId)) return running.get(ownerId)!;
	const work = async () => {
		const replay = () =>
			replayOwnedQueue(ownerId, { activeOwner: activeAccount, online: () => navigator.onLine, send: replayMutation });
		if (navigator.locks) {
			try {
				await navigator.locks.request(`split-replay-${ownerId}`, { ifAvailable: true }, (lock) =>
					lock ? replay() : Promise.resolve(),
				);
			} catch {
				await replay();
			} // Web Locks are optional; receipts still prevent duplicate writes.
		} else await replay();
	};
	const promise = work().finally(() => {
		running.delete(ownerId);
	});
	running.set(ownerId, promise);
	return promise;
}
export async function submitMutation(ownerId: string, draft: MutationDraft) {
	if (activeAccount() !== ownerId) throw new Error("Account changed. Reopen this page before saving.");
	const item = await enqueueMutation(ownerId, draft);
	try {
		if (navigator.onLine) await flushQueue(ownerId);
		return { pending: !!(await getMutation(ownerId, item.id)) };
	} catch {
		return { pending: true };
	} // A saved change must not be resubmitted with a new ID after a read/transport failure.
}
export function initSyncListeners(ownerId: string) {
	const flush = () => {
		void flushQueue(ownerId).catch(() => {});
	};
	const visible = () => {
		if (document.visibilityState === "visible") flush();
	};
	window.addEventListener("online", flush);
	document.addEventListener("visibilitychange", visible);
	flush();
	return () => {
		window.removeEventListener("online", flush);
		document.removeEventListener("visibilitychange", visible);
	};
}
