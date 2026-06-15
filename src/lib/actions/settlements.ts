"use server";

import { db } from "@/db";
import { settlements, groupMembers } from "@/db/schema/app";
import { auth } from "@/auth";
import { eq, and } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";

const settleUpSchema = z.object({
	groupId: z.string().uuid(),
    fromUserId: z.string(),
	toUserId: z.string(),
	amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
	note: z.string().max(200).optional(),
});

export type SettleUpInput = z.infer<typeof settleUpSchema>;

export async function settleUp(input: SettleUpInput) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	const userId = session.user.id;

	const parsed = settleUpSchema.safeParse(input);
	if (!parsed.success) throw new Error(parsed.error.message);

	const { groupId, fromUserId, toUserId, amount, note } = parsed.data;

	const membership = await db
		.select()
		.from(groupMembers)
		.where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, fromUserId)))
		.then((r) => r[0] ?? null);

	if (!membership) throw new Error("Not a member");

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
