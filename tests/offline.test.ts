import "fake-indexeddb/auto";
import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { openDB } from "idb";
import { getDB } from "@/lib/offline/db";
import {
	enqueueMutation,
	getPendingMutations,
	getMutation,
	removeMutation,
	updateMutationStatus,
	hasLegacyChanges,
	type MutationDraft,
} from "@/lib/offline/queue";
import { replayOwnedQueue } from "@/lib/offline/engine";
import { onQueueChange } from "@/lib/offline/events";

const draft: MutationDraft = {
	type: "settle_up",
	payload: { groupId: "10000000-0000-4000-8000-000000000001", fromUserId: "alice", toUserId: "bob", amount: "1.00" },
};
beforeAll(async () => {
	const old = await openDB("split-offline", 1, {
		upgrade(db) {
			db.createObjectStore("mutations", { keyPath: "id" }).createIndex("by-groupId", "groupId");
		},
	});
	await old.put("mutations", { id: "old", payload: { description: "Legacy private change" } });
	old.close();
	await getDB();
});
beforeEach(async () => {
	await (await getDB()).clear("ownedMutations");
});
describe("owned IndexedDB queue", () => {
	test("observer failures never turn a committed queue insertion into a failed save", async () => {
		const off = onQueueChange(() => {
			throw new Error("broken subscriber");
		});
		const row = await enqueueMutation("alice", draft);
		off();
		expect((await getMutation("alice", row.id))?.id).toBe(row.id);
	});
	test("legacy entries survive upgrade without being assigned to any account", async () => {
		expect(await hasLegacyChanges()).toBe(true);
		expect(await getPendingMutations("alice")).toHaveLength(0);
		expect(await getPendingMutations("bob")).toHaveLength(0);
		expect(await (await getDB()).get("mutations", "old")).toEqual({
			id: "old",
			payload: { description: "Legacy private change" },
		});
	});
	test("accounts cannot query, change or discard each other's entries", async () => {
		const a = await enqueueMutation("alice", draft);
		await enqueueMutation("bob", draft);
		expect((await getPendingMutations("alice")).map((row) => row.id)).toEqual([a.id]);
		await removeMutation("bob", a.id);
		await updateMutationStatus("bob", a.id, "failed");
		expect((await getMutation("alice", a.id))?.status).toBe("pending");
		expect(a.payload.ownerId).toBe("alice");
		expect(a.payload.mutationId).toBe(a.id);
	});
	test("enqueue and status changes notify immediately after durable writes", async () => {
		const events: string[] = [];
		const off = onQueueChange((event) => events.push(event.ownerId));
		const row = await enqueueMutation("alice", draft);
		await updateMutationStatus("alice", row.id, "failed", "server");
		off();
		expect(events).toEqual(["alice", "alice"]);
		expect((await getMutation("alice", row.id))?.status).toBe("failed");
	});
	test("account switching stops the queue before the next send and never deletes unacknowledged work", async () => {
		const a = await enqueueMutation("alice", draft);
		await enqueueMutation("alice", draft);
		let active = "alice";
		let sent = 0;
		await replayOwnedQueue("alice", {
			activeOwner: () => active,
			online: () => true,
			send: async () => {
				sent++;
				active = "bob";
				return { status: "synced", id: "server-id" };
			},
		});
		expect(sent).toBe(1);
		expect(await getPendingMutations("alice")).toHaveLength(2);
		expect(await getMutation("alice", a.id)).toBeDefined();
		await replayOwnedQueue("alice", {
			activeOwner: () => "bob",
			online: () => true,
			send: async () => {
				throw new Error("must not send");
			},
		});
		expect(await getPendingMutations("alice")).toHaveLength(2);
	});
	test("a lost response retries the exact saved request ID", async () => {
		const row = await enqueueMutation("alice", draft);
		const ids: string[] = [];
		await replayOwnedQueue("alice", {
			activeOwner: () => "alice",
			online: () => true,
			send: async (item) => {
				ids.push(item.payload.mutationId);
				throw new Error("response lost");
			},
		});
		expect((await getMutation("alice", row.id))?.status).toBe("pending");
		await replayOwnedQueue("alice", {
			activeOwner: () => "alice",
			online: () => true,
			send: async (item) => {
				ids.push(item.payload.mutationId);
				return { status: "synced", id: "same-server-id" };
			},
		});
		expect(ids).toEqual([row.id, row.id]);
		expect(await getPendingMutations("alice")).toHaveLength(0);
	});
	test("expired sessions pause; validation failures require explicit retry", async () => {
		const row = await enqueueMutation("alice", draft);
		await replayOwnedQueue("alice", {
			activeOwner: () => "alice",
			online: () => true,
			send: async () => ({ status: "blocked", reason: "session" }),
		});
		expect((await getMutation("alice", row.id))?.status).toBe("paused");
		await replayOwnedQueue("alice", {
			activeOwner: () => "alice",
			online: () => true,
			send: async () => ({ status: "blocked", reason: "invalid" }),
		});
		expect((await getMutation("alice", row.id))?.status).toBe("failed");
		let sent = 0;
		await replayOwnedQueue("alice", {
			activeOwner: () => "alice",
			online: () => true,
			send: async () => {
				sent++;
				return { status: "synced", id: "id" };
			},
		});
		expect(sent).toBe(0);
		await updateMutationStatus("alice", row.id, "pending");
		await replayOwnedQueue("alice", {
			activeOwner: () => "alice",
			online: () => true,
			send: async () => ({ status: "synced", id: "id" }),
		});
		expect(await getPendingMutations("alice")).toHaveLength(0);
	});
	test("offline runs preserve pending changes without invoking transport", async () => {
		await enqueueMutation("alice", draft);
		let sent = 0;
		await replayOwnedQueue("alice", {
			activeOwner: () => "alice",
			online: () => false,
			send: async () => {
				sent++;
				return { status: "synced", id: "id" };
			},
		});
		expect(sent).toBe(0);
		expect(await getPendingMutations("alice")).toHaveLength(1);
	});
});
