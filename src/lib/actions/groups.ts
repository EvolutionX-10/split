"use server";

import { db } from "@/db";
import { groups, groupMembers, expenses, expenseSplits, settlements } from "@/db/schema/app";
import { auth } from "@/auth";
import { eq, and, sql } from "drizzle-orm";

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
