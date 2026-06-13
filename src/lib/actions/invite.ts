"use server";

import { db } from "@/db";
import { groups, groupMembers } from "@/db/schema/app";
import { auth } from "@/auth";
import { eq, and, sql } from "drizzle-orm";
import { updateTag } from "next/cache";

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

	const group = await db
		.select({ id: groups.id })
		.from(groups)
		.where(eq(groups.inviteToken, token))
		.then((r) => r[0] ?? null);

	if (!group) throw new Error("Invalid invite");

	// Check not already a member
	const existing = await db
		.select()
		.from(groupMembers)
		.where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)))
		.then((r) => r[0] ?? null);

	if (existing) return group; // already in, just redirect

	await db.insert(groupMembers).values({
		groupId: group.id,
		userId,
		role: "member",
	});

	updateTag("groups");
	updateTag(`group-${group.id}`);
	return group;
}
