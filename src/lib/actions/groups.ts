"use server";

import { db } from "@/db";
import { groups, groupMembers } from "@/db/schema/app";
import { auth } from "@/auth";
import { type InsertGroup, insertGroupSchema } from "@/db/validators";
import { getGroupHome, getGroupMembers, getGroups, getGroupTransactions } from "../cache/groups";
import { updateTag } from "next/cache";

export async function getUserGroupsAction() {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	return getGroups(session.user.id);
}

export async function getGroupHomeAction(groupId: string) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	return getGroupHome(groupId, session.user.id);
}

export async function getGroupMembersAction(groupId: string) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	return getGroupMembers(groupId, session.user.id);
}

export async function getGroupTransactionsAction(groupId: string) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	return getGroupTransactions(groupId, session.user.id);
}

export async function createGroup(input: InsertGroup) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	const userId = session.user.id;

	const parsed = insertGroupSchema.safeParse(input);
	if (!parsed.success) throw new Error(parsed.error.message);

	const [group] = await db
		.insert(groups)
		.values({
			...parsed.data,
			createdBy: userId,
		})
		.returning();

	// Add creator as owner
	await db.insert(groupMembers).values({
		groupId: group.id,
		userId,
		role: "owner",
	});

	updateTag("groups");
	return group;
}
