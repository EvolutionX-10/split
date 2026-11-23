import "server-only";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { db } from "@/db";
import { mutationReceipts } from "@/db/schema/app";

export class MutationError extends Error {
	constructor(
		public code: "account" | "conflict",
		message: string,
	) {
		super(message);
	}
}

function canonical(value: unknown): unknown {
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) return value.map(canonical);
	if (value && typeof value === "object")
		return Object.fromEntries(
			Object.entries(value)
				.filter(([, v]) => v !== undefined)
				.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
				.map(([k, v]) => [k, canonical(v)]),
		);
	return value;
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function applyOnce(
	tx: Transaction,
	ownerId: string,
	mutationId: string,
	kind: "add_expense" | "settle_up",
	payload: unknown,
	write: () => Promise<string>,
) {
	const payloadHash = createHash("sha256")
		.update(JSON.stringify(canonical(payload)))
		.digest("hex");
	// Transaction-scoped lock serializes identical keys across tabs, servers, and lost responses.
	await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([ownerId, mutationId])}, 0))`);
	const [existing] = await tx
		.select()
		.from(mutationReceipts)
		.where(and(eq(mutationReceipts.ownerId, ownerId), eq(mutationReceipts.mutationId, mutationId)));
	if (existing) {
		if (existing.kind !== kind || existing.payloadHash !== payloadHash)
			throw new MutationError("conflict", "This request ID was already used for different content");
		return existing.entityId;
	}
	const entityId = await write();
	await tx.insert(mutationReceipts).values({ ownerId, mutationId, kind, payloadHash, entityId });
	return entityId;
}
