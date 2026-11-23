import "server-only";

import { db } from "@/db";
import { groupMembers } from "@/db/schema/app";
import { and, eq, inArray } from "drizzle-orm";

export async function requireGroupMembers(groupId: string, userIds: string[], client: Pick<typeof db, "select"> = db) {
	const required = [...new Set(userIds)];
	const members = await client
		.select({ userId: groupMembers.userId })
		.from(groupMembers)
		.where(and(eq(groupMembers.groupId, groupId), inArray(groupMembers.userId, required)));
	const memberIds = new Set(members.map((member) => member.userId));
	if (required.some((userId) => !memberIds.has(userId))) throw new Error("Not a member");
}
