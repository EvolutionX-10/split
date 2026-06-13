"use server";

import { db } from "@/db";
import { groups, groupMembers, expenses, expenseSplits, settlements } from "@/db/schema/app";
import { auth } from "@/auth";
import { eq, and, sql } from "drizzle-orm";
import { type InsertGroup, insertGroupSchema } from "@/db/validators";
import { users } from "@/db/schema/auth";

export async function getGroups() {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	const userId = session.user.id;

	const userGroups = await db
		.select({
			id: groups.id,
			name: groups.name,
			accentColor: groups.accentColor,
			description: groups.description,
			createdAt: groups.createdAt,
			memberCount: sql<number>`count(distinct ${groupMembers.userId})::int`,
		})
		.from(groups)
		.innerJoin(groupMembers, eq(groups.id, groupMembers.groupId))
		.where(eq(groupMembers.userId, userId))
		.groupBy(groups.id);

	// For each group, compute net balance for current user
	const groupsWithBalance = await Promise.all(
		userGroups.map(async (group) => {
			// Total others owe me (I paid, others owe)
			const owedToMe = await db
				.select({ total: sql<string>`coalesce(sum(${expenseSplits.owedAmount}), 0)` })
				.from(expenseSplits)
				.innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
				.where(and(eq(expenses.groupId, group.id), eq(expenses.paidBy, userId), eq(expenseSplits.isSettled, false)))
				.then((r) => parseFloat(r[0]?.total ?? "0"));

			// What I owe others (others paid, I owe)
			const iOwe = await db
				.select({ total: sql<string>`coalesce(sum(${expenseSplits.owedAmount}), 0)` })
				.from(expenseSplits)
				.innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
				.where(
					and(eq(expenses.groupId, group.id), eq(expenseSplits.userId, userId), eq(expenseSplits.isSettled, false)),
				)
				.then((r) => parseFloat(r[0]?.total ?? "0"));

			// Settlements paid by me
			const settledByMe = await db
				.select({ total: sql<string>`coalesce(sum(${settlements.amount}), 0)` })
				.from(settlements)
				.where(and(eq(settlements.groupId, group.id), eq(settlements.fromUserId, userId)))
				.then((r) => parseFloat(r[0]?.total ?? "0"));

			// Settlements received by me
			const settledToMe = await db
				.select({ total: sql<string>`coalesce(sum(${settlements.amount}), 0)` })
				.from(settlements)
				.where(and(eq(settlements.groupId, group.id), eq(settlements.toUserId, userId)))
				.then((r) => parseFloat(r[0]?.total ?? "0"));

			const net = owedToMe - settledToMe - (iOwe - settledByMe);

			return { ...group, balance: net };
		}),
	);

	return groupsWithBalance;
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

	return group;
}

export async function getGroupHome(groupId: string) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	const userId = session.user.id;

	// Verify membership
	const membership = await db
		.select()
		.from(groupMembers)
		.where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
		.then((r) => r[0] ?? null);

	if (!membership) throw new Error("Not a member");

	// Group details
	const group = await db
		.select()
		.from(groups)
		.where(eq(groups.id, groupId))
		.then((r) => r[0] ?? null);

	if (!group) throw new Error("Group not found");

	// Members with user info
	const members = await db
		.select({
			id: users.id,
			name: users.name,
			image: users.image,
			role: groupMembers.role,
		})
		.from(groupMembers)
		.innerJoin(users, eq(groupMembers.userId, users.id))
		.where(eq(groupMembers.groupId, groupId));

	// Expenses with paidBy user info
	const expenseList = await db
		.select({
			id: expenses.id,
			description: expenses.description,
			amount: expenses.amount,
			category: expenses.category,
			expenseDate: expenses.expenseDate,
			paidById: expenses.paidBy,
			paidByName: users.name,
			paidByImage: users.image,
		})
		.from(expenses)
		.innerJoin(users, eq(expenses.paidBy, users.id))
		.where(eq(expenses.groupId, groupId))
		.orderBy(expenses.expenseDate);

	// Net balances between all pairs in group
	// For each member, compute what they owe current user or are owed
	const balances: { userId: string; name: string; image: string | null; net: number }[] = [];

	for (const member of members) {
		if (member.id === userId) continue;

		// What this member owes me (I paid, they owe)
		const theyOweMe = await db
			.select({ total: sql<string>`coalesce(sum(${expenseSplits.owedAmount}), 0)` })
			.from(expenseSplits)
			.innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
			.where(
				and(
					eq(expenses.groupId, groupId),
					eq(expenses.paidBy, userId),
					eq(expenseSplits.userId, member.id),
					eq(expenseSplits.isSettled, false),
				),
			)
			.then((r) => parseFloat(r[0]?.total ?? "0"));

		// What I owe this member (they paid, I owe)
		const iOweThem = await db
			.select({ total: sql<string>`coalesce(sum(${expenseSplits.owedAmount}), 0)` })
			.from(expenseSplits)
			.innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
			.where(
				and(
					eq(expenses.groupId, groupId),
					eq(expenses.paidBy, member.id),
					eq(expenseSplits.userId, userId),
					eq(expenseSplits.isSettled, false),
				),
			)
			.then((r) => parseFloat(r[0]?.total ?? "0"));

		// Settlements between us
		const iPaidThem = await db
			.select({ total: sql<string>`coalesce(sum(${settlements.amount}), 0)` })
			.from(settlements)
			.where(
				and(eq(settlements.groupId, groupId), eq(settlements.fromUserId, userId), eq(settlements.toUserId, member.id)),
			)
			.then((r) => parseFloat(r[0]?.total ?? "0"));

		const theyPaidMe = await db
			.select({ total: sql<string>`coalesce(sum(${settlements.amount}), 0)` })
			.from(settlements)
			.where(
				and(eq(settlements.groupId, groupId), eq(settlements.fromUserId, member.id), eq(settlements.toUserId, userId)),
			)
			.then((r) => parseFloat(r[0]?.total ?? "0"));

		const net = theyOweMe - theyPaidMe - (iOweThem - iPaidThem);
		if (net !== 0) {
			balances.push({ userId: member.id, name: member.name ?? "Unknown", image: member.image, net });
		}
	}

	return { group, members, expenses: expenseList, balances, currentUserId: userId };
}

export async function getGroupMembers(groupId: string) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	const userId = session.user.id;

	const membership = await db
		.select()
		.from(groupMembers)
		.where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
		.then((r) => r[0] ?? null);

	if (!membership) throw new Error("Not a member");

	const members = await db
		.select({
			id: users.id,
			name: users.name,
			image: users.image,
			role: groupMembers.role,
			joinedAt: groupMembers.joinedAt,
		})
		.from(groupMembers)
		.innerJoin(users, eq(groupMembers.userId, users.id))
		.where(eq(groupMembers.groupId, groupId))
		.orderBy(groupMembers.joinedAt);

	return { members, currentUserId: userId, isOwner: membership.role === "owner" };
}
