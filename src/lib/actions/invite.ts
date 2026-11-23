"use server";

import { db } from "@/db";
import { groups, groupMembers } from "@/db/schema/app";
import { auth } from "@/auth";
import { eq, and, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { createMemberJoinedNotifications } from "@/lib/server/notifications";

export async function getInviteDetails(token: string) {
	const result = await db
		.select({
			id: groups.id,
			name: groups.name,
			accentColor: groups.accentColor,
			description: groups.description,
			memberCount: sql<number>`count(distinct ${groupMembers.userId})::int`,
		})
		.from(groups)
		.innerJoin(groupMembers, eq(groups.id, groupMembers.groupId))
		.where(eq(groups.inviteToken, token))
		.groupBy(groups.id)
		.then((r) => r[0] ?? null);

	if (!result) return null;

	const session = await auth();
	let isMember = false;

	if (session?.user?.id) {
		const membership = await db
			.select()
			.from(groupMembers)
			.where(and(eq(groupMembers.groupId, result.id), eq(groupMembers.userId, session.user.id)))
			.then((r) => r[0] ?? null);
		isMember = !!membership;
	}

	return { ...result, isMember };
}

export async function acceptInvite(token: string) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	const userId = session.user.id;

	const result = await db.transaction(async (tx) => {
		// Serialize joins for this group so membership and its notifications are created once.
		const [group] = await tx.select({ id: groups.id }).from(groups).where(eq(groups.inviteToken, token)).for("update");
		if (!group) throw new Error("Invalid invite");
		const [existing] = await tx
			.select({ id: groupMembers.id })
			.from(groupMembers)
			.where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)));
		if (existing) return { group, joined: false };
		await tx.insert(groupMembers).values({ groupId: group.id, userId, role: "member" });
		await createMemberJoinedNotifications(group.id, userId, tx);
		return { group, joined: true };
	});
	if (result.joined) {
		updateTag("notifications");
		updateTag("groups");
		updateTag(`group-${result.group.id}`);
	}
	return result.group;
}
