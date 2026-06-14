import { db } from "@/db";
import { groups, groupMembers, expenses, expenseSplits, settlements } from "@/db/schema/app";
import { users } from "@/db/schema/auth";
import { sql, eq, and, inArray } from "drizzle-orm";
import { cacheTag } from "next/cache";

export async function getGroups(userId: string) {
	"use cache";
	cacheTag("groups");
	const userGroups = await db
		.select({
			id: groups.id,
			name: groups.name,
			accentColor: groups.accentColor,
			description: groups.description,
			createdAt: groups.createdAt,
			memberCount: sql<number>`(
      select count(*)::int from ${groupMembers} gm2
      where gm2."groupId" = ${groups.id}
    )`,
		})
		.from(groups)
		.innerJoin(groupMembers, eq(groups.id, groupMembers.groupId))
		.where(eq(groupMembers.userId, userId))
		.groupBy(groups.id);

	if (userGroups.length === 0) return [];

	const groupIds = userGroups.map((g) => g.id);

	// Single query: what others owe me across all groups
	const owedToMeRowsPromise = db
		.select({
			groupId: expenses.groupId,
			total: sql<string>`coalesce(sum(${expenseSplits.owedAmount}), 0)`,
		})
		.from(expenseSplits)
		.innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
		.where(and(inArray(expenses.groupId, groupIds), eq(expenses.paidBy, userId), eq(expenseSplits.isSettled, false)))
		.groupBy(expenses.groupId);

	// Single query: what I owe others across all groups
	const iOweRowsPromise = db
		.select({
			groupId: expenses.groupId,
			total: sql<string>`coalesce(sum(${expenseSplits.owedAmount}), 0)`,
		})
		.from(expenseSplits)
		.innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
		.where(
			and(inArray(expenses.groupId, groupIds), eq(expenseSplits.userId, userId), eq(expenseSplits.isSettled, false)),
		)
		.groupBy(expenses.groupId);

	// Single query: settlements paid by me
	const settledByMeRowsPromise = db
		.select({
			groupId: settlements.groupId,
			total: sql<string>`coalesce(sum(${settlements.amount}), 0)`,
		})
		.from(settlements)
		.where(and(inArray(settlements.groupId, groupIds), eq(settlements.fromUserId, userId)))
		.groupBy(settlements.groupId);

	// Single query: settlements received by me
	const settledToMeRowsPromise = db
		.select({
			groupId: settlements.groupId,
			total: sql<string>`coalesce(sum(${settlements.amount}), 0)`,
		})
		.from(settlements)
		.where(and(inArray(settlements.groupId, groupIds), eq(settlements.toUserId, userId)))
		.groupBy(settlements.groupId);

	const [owedToMeRows, iOweRows, settledByMeRows, settledToMeRows] = await Promise.all([
		owedToMeRowsPromise,
		iOweRowsPromise,
		settledByMeRowsPromise,
		settledToMeRowsPromise,
	]);

	// Map to lookup objects
	const owedToMe = Object.fromEntries(owedToMeRows.map((r) => [r.groupId, parseFloat(r.total)]));
	const iOwe = Object.fromEntries(iOweRows.map((r) => [r.groupId, parseFloat(r.total)]));
	const settledByMe = Object.fromEntries(settledByMeRows.map((r) => [r.groupId, parseFloat(r.total)]));
	const settledToMe = Object.fromEntries(settledToMeRows.map((r) => [r.groupId, parseFloat(r.total)]));

	return userGroups.map((g) => ({
		...g,
		balance: (owedToMe[g.id] ?? 0) - (settledToMe[g.id] ?? 0) - ((iOwe[g.id] ?? 0) - (settledByMe[g.id] ?? 0)),
	}));
}

export async function getGroupHome(groupId: string, userId: string) {
	"use cache";
	cacheTag(`group-${groupId}`);

	const [membership, group] = await Promise.all([
		db
			.select()
			.from(groupMembers)
			.where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
			.then((r) => r[0] ?? null),
		db
			.select()
			.from(groups)
			.where(eq(groups.id, groupId))
			.then((r) => r[0] ?? null),
	]);

	if (!membership) throw new Error("Not a member");
	if (!group) throw new Error("Group not found");

	const [members, expenseList, theyOweMeRows, iOweThemRows, iPaidThemRows, theyPaidMeRows] = await Promise.all([
		db
			.select({ id: users.id, name: users.name, image: users.image, role: groupMembers.role })
			.from(groupMembers)
			.innerJoin(users, eq(groupMembers.userId, users.id))
			.where(eq(groupMembers.groupId, groupId)),

		db
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
			.orderBy(expenses.expenseDate),

		// I paid, others owe me — grouped by who owes
		db
			.select({
				userId: expenseSplits.userId,
				total: sql<string>`coalesce(sum(${expenseSplits.owedAmount}), 0)`,
			})
			.from(expenseSplits)
			.innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
			.where(and(eq(expenses.groupId, groupId), eq(expenses.paidBy, userId), eq(expenseSplits.isSettled, false)))
			.groupBy(expenseSplits.userId),

		// Others paid, I owe — grouped by who paid
		db
			.select({
				userId: expenses.paidBy,
				total: sql<string>`coalesce(sum(${expenseSplits.owedAmount}), 0)`,
			})
			.from(expenseSplits)
			.innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
			.where(and(eq(expenses.groupId, groupId), eq(expenseSplits.userId, userId), eq(expenseSplits.isSettled, false)))
			.groupBy(expenses.paidBy),

		// Settlements I paid to others
		db
			.select({
				userId: settlements.toUserId,
				total: sql<string>`coalesce(sum(${settlements.amount}), 0)`,
			})
			.from(settlements)
			.where(and(eq(settlements.groupId, groupId), eq(settlements.fromUserId, userId)))
			.groupBy(settlements.toUserId),

		// Settlements others paid to me
		db
			.select({
				userId: settlements.fromUserId,
				total: sql<string>`coalesce(sum(${settlements.amount}), 0)`,
			})
			.from(settlements)
			.where(and(eq(settlements.groupId, groupId), eq(settlements.toUserId, userId)))
			.groupBy(settlements.fromUserId),
	]);

	const theyOweMe = Object.fromEntries(theyOweMeRows.map((r) => [r.userId, parseFloat(r.total)]));
	const iOweThem = Object.fromEntries(iOweThemRows.map((r) => [r.userId, parseFloat(r.total)]));
	const iPaidThem = Object.fromEntries(iPaidThemRows.map((r) => [r.userId, parseFloat(r.total)]));
	const theyPaidMe = Object.fromEntries(theyPaidMeRows.map((r) => [r.userId, parseFloat(r.total)]));

	const balances = members
		.filter((m) => m.id !== userId)
		.map((m) => ({
			userId: m.id,
			name: m.name ?? "Unknown",
			image: m.image,
			net: (theyOweMe[m.id] ?? 0) - (theyPaidMe[m.id] ?? 0) - ((iOweThem[m.id] ?? 0) - (iPaidThem[m.id] ?? 0)),
		}))
		.filter((b) => b.net !== 0);

	return { group, members, expenses: expenseList, balances, currentUserId: userId };
}

export async function getGroupMembers(groupId: string, userId: string) {
	"use cache";
	cacheTag(`group-${groupId}`);

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
