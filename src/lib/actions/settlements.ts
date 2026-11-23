"use server";

import { db } from "@/db";
import { settlements } from "@/db/schema/app";
import { auth } from "@/auth";
import { updateTag } from "next/cache";
import type { z } from "zod";
import { settleUpInputSchema } from "@/lib/validation/ledger";
import { requireGroupMembers } from "@/lib/server/group-access";

export type SettleUpInput = z.infer<typeof settleUpInputSchema>;

export async function settleUp(input: SettleUpInput) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	const userId = session.user.id;

	const parsed = settleUpInputSchema.safeParse(input);
	if (!parsed.success) throw new Error(parsed.error.message);

	const { groupId, fromUserId, toUserId, amount, note } = parsed.data;

	// A participant may record either an outgoing payment or money they received.
	if (userId !== fromUserId && userId !== toUserId) throw new Error("Only a payment participant can record it");
	await requireGroupMembers(groupId, [userId, fromUserId, toUserId]);

	await db.insert(settlements).values({
		groupId,
		fromUserId,
		toUserId,
		amount,
		note: note ?? null,
	});

	updateTag(`group-${groupId}`);
	updateTag("groups");
}
