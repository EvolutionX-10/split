import { z } from "zod";
import { addExpenseInputSchema, settleUpInputSchema } from "@/lib/validation/ledger";

export const replaySchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("add_expense"), payload: addExpenseInputSchema }),
	z.object({ type: z.literal("settle_up"), payload: settleUpInputSchema }),
]);
export type MutationRequest = z.infer<typeof replaySchema>;
export type ReplayResult =
	| { status: "synced"; id: string }
	| { status: "blocked"; reason: "session" | "account" | "membership" | "conflict" | "invalid" | "server" };
