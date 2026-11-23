"use server";

import { addExpense } from "./expenses";
import { settleUp } from "./settlements";
import { MutationError } from "@/lib/server/idempotency";
import { replaySchema, type ReplayResult } from "@/lib/offline/protocol";

export async function replayMutation(input: unknown): Promise<ReplayResult> {
	const parsed = replaySchema.safeParse(input);
	if (!parsed.success) return { status: "blocked", reason: "invalid" };
	try {
		const result =
			parsed.data.type === "add_expense" ? await addExpense(parsed.data.payload) : await settleUp(parsed.data.payload);
		return { status: "synced", id: result.id };
	} catch (error) {
		if (error instanceof MutationError) return { status: "blocked", reason: error.code };
		if (error instanceof Error && error.message === "Unauthorized") return { status: "blocked", reason: "session" };
		if (error instanceof Error && error.message === "Not a member") return { status: "blocked", reason: "membership" };
		return { status: "blocked", reason: "server" };
	}
}
