import { getDB, type QueuedMutation } from "./db";
import { notifyQueue } from "./events";
import type { AddExpenseInput } from "@/lib/actions/expenses";
import type { SettleUpInput } from "@/lib/actions/settlements";

export type MutationDraft =
	| { type: "add_expense"; payload: Omit<AddExpenseInput, "ownerId" | "mutationId"> }
	| { type: "settle_up"; payload: Omit<SettleUpInput, "ownerId" | "mutationId"> };
export async function enqueueMutation(ownerId: string, draft: MutationDraft) {
	const id = crypto.randomUUID();
	const item = {
		...draft,
		payload: { ...draft.payload, ownerId, mutationId: id },
		ownerId,
		id,
		version: 2,
		status: "pending",
		createdAt: Date.now(),
	} as QueuedMutation;
	await (await getDB()).add("ownedMutations", item);
	notifyQueue({ ownerId });
	return item;
}
export async function getPendingMutations(ownerId: string, groupId?: string) {
	const all = await (await getDB()).getAllFromIndex("ownedMutations", "by-owner", ownerId);
	return all
		.filter((item) => !groupId || item.payload.groupId === groupId)
		.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}
export async function getMutation(ownerId: string, id: string) {
	return (await getDB()).get("ownedMutations", [ownerId, id]);
}
export async function removeMutation(ownerId: string, id: string, synced = false) {
	await (await getDB()).delete("ownedMutations", [ownerId, id]);
	notifyQueue({ ownerId, synced });
}
export async function updateMutationStatus(
	ownerId: string,
	id: string,
	status: QueuedMutation["status"],
	error?: string,
) {
	const db = await getDB();
	const tx = db.transaction("ownedMutations", "readwrite");
	const item = await tx.store.get([ownerId, id]);
	if (item) await tx.store.put({ ...item, status, error });
	await tx.done;
	notifyQueue({ ownerId });
}
export async function hasLegacyChanges() {
	return (await (await getDB()).count("mutations")) > 0;
}
