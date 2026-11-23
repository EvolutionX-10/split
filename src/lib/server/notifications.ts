import "server-only";

import { db } from "@/db";
import { groupMembers, notifications } from "@/db/schema/app";
import { users } from "@/db/schema/auth";
import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";

// Internal helper, deliberately outside the callable server-action module.
export async function createMemberJoinedNotifications(groupId: string, joinedUserId: string) {
	const joinedUser = await db
		.select({ name: users.name })
		.from(users)
		.where(eq(users.id, joinedUserId))
		.then((rows) => rows[0] ?? null);
	const members = await db
		.select({ userId: groupMembers.userId })
		.from(groupMembers)
		.where(eq(groupMembers.groupId, groupId));
	const toNotify = members.filter((member) => member.userId !== joinedUserId);
	if (toNotify.length === 0) return;

	await db.insert(notifications).values(
		toNotify.map((member) => ({
			userId: member.userId,
			type: "member_joined" as const,
			groupId,
			relatedUserId: joinedUserId,
			message: `${joinedUser?.name ?? "Someone"} joined the group`,
		})),
	);
	updateTag("notifications");
}
