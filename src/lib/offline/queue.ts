"use client";

import { getDB, type QueuedMutation } from "./db";

type NewMutation = Omit<QueuedMutation, "id" | "status" | "createdAt" | "retryCount">;

export async function enqueueMutation(mutation: NewMutation) {
	const db = await getDB();
	const item = {
		...mutation,
		id: crypto.randomUUID(),
		status: "pending" as const,
		createdAt: Date.now(),
		retryCount: 0,
	} as QueuedMutation;
	await db.add("mutations", item);
	return item;
}

export async function getPendingMutations(groupId?: string) {
	const db = await getDB();
	const all = await db.getAll("mutations");
	return groupId ? all.filter((m) => m.groupId === groupId) : all;
}

export async function removeMutation(id: string) {
	const db = await getDB();
	await db.delete("mutations", id);
}

export async function updateMutationStatus(id: string, status: QueuedMutation["status"], error?: string) {
	const db = await getDB();
	const item = await db.get("mutations", id);
	if (!item) return;
	await db.put("mutations", {
		...item,
		status,
		error,
		retryCount: status === "failed" ? item.retryCount + 1 : item.retryCount,
	});
}

export async function getAllPendingCount() {
	const db = await getDB();
	return db.count("mutations");
}
