import { db } from "@/db";
import { groups, groupMembers, expenses, expenseSplits, settlements, notifications } from "@/db/schema/app";
import { users } from "@/db/schema/auth";
import { sql, eq, and, inArray, desc } from "drizzle-orm";
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
			.orderBy(desc(expenses.expenseDate)),

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

export async function getGroupTransactions(groupId: string, userId: string) {
	"use cache";
	cacheTag(`group-${groupId}`);

	const membership = await db
		.select()
		.from(groupMembers)
		.where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
		.then((r) => r[0] ?? null);

	if (!membership) throw new Error("Not a member");

	const [expenseList, settlementList, memberJoins] = await Promise.all([
		db
			.select({
				id: expenses.id,
				type: sql<string>`'expense'`,
				description: expenses.description,
				amount: expenses.amount,
				category: expenses.category,
				actorId: expenses.paidBy,
				actorName: users.name,
				actorImage: users.image,
				date: expenses.expenseDate,
				createdAt: expenses.createdAt,
			})
			.from(expenses)
			.innerJoin(users, eq(expenses.paidBy, users.id))
			.where(eq(expenses.groupId, groupId)),

		db
			.select({
				id: settlements.id,
				type: sql<string>`'settlement'`,
				description: sql<string>`null`,
				amount: settlements.amount,
				category: sql<string>`null`,
				actorId: settlements.fromUserId,
				actorName: users.name,
				actorImage: users.image,
				toUserId: settlements.toUserId,
				date: settlements.settledAt,
				createdAt: settlements.settledAt,
			})
			.from(settlements)
			.innerJoin(users, eq(settlements.fromUserId, users.id))
			.where(eq(settlements.groupId, groupId)),

		db
			.select({
				id: groupMembers.id,
				type: sql<string>`'join'`,
				actorId: users.id,
				actorName: users.name,
				actorImage: users.image,
				date: groupMembers.joinedAt,
				createdAt: groupMembers.joinedAt,
			})
			.from(groupMembers)
			.innerJoin(users, eq(groupMembers.userId, users.id))
			.where(eq(groupMembers.groupId, groupId)),
	]);

	// Get toUser names for settlements
	const toUserIds = settlementList.map((s) => s.toUserId);
	const toUsers =
		toUserIds.length > 0
			? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, toUserIds))
			: [];
	const toUserMap = Object.fromEntries(toUsers.map((u) => [u.id, u.name]));

	const timeline = [
		...expenseList.map((e) => ({
			id: e.id,
			type: "expense" as const,
			description: e.description,
			amount: parseFloat(e.amount),
			category: e.category,
			actorId: e.actorId,
			actorName: e.actorName,
			actorImage: e.actorImage,
			toUserName: null,
			toUserId: null,
			date: e.date,
		})),
		...settlementList.map((s) => ({
			id: s.id,
			type: "settlement" as const,
			description: null,
			amount: parseFloat(s.amount),
			category: null,
			actorId: s.actorId,
			actorName: s.actorName,
			actorImage: s.actorImage,
			toUserName: toUserMap[s.toUserId] ?? "someone",
			toUserId: s.toUserId,
			date: s.date,
		})),
		...memberJoins.map((m) => ({
			id: m.id,
			type: "join" as const,
			description: null,
			amount: null,
			category: null,
			actorId: m.actorId,
			actorName: m.actorName,
			actorImage: m.actorImage,
			toUserName: null,
			toUserId: null,
			date: m.date,
		})),
	].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

	return { timeline, currentUserId: userId };
}

function getPeriodStart(period: Period): Date | null {
	const now = new Date();
	switch (period) {
		case "week":
			return new Date(now.setDate(now.getDate() - 7));
		case "month":
			return new Date(now.setMonth(now.getMonth() - 1));
		case "6months":
			return new Date(now.setMonth(now.getMonth() - 6));
		case "year":
			return new Date(now.setFullYear(now.getFullYear() - 1));
		case "all":
			return null;
	}
}

export async function getGroupAnalytics(groupId: string, userId: string, period: Period) {
	"use cache";
	cacheTag(`group-${groupId}`);

	const membership = await db
		.select()
		.from(groupMembers)
		.where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
		.then((r) => r[0] ?? null);

	if (!membership) throw new Error("Not a member");

	const periodStart = getPeriodStart(period);

	const [allExpenses, allSplits, allMembers] = await Promise.all([
		db
			.select({
				id: expenses.id,
				amount: expenses.amount,
				category: expenses.category,
				paidBy: expenses.paidBy,
				paidByName: users.name,
				expenseDate: expenses.expenseDate,
			})
			.from(expenses)
			.innerJoin(users, eq(expenses.paidBy, users.id))
			.where(
				and(
					eq(expenses.groupId, groupId),
					periodStart ? sql`${expenses.expenseDate} >= ${periodStart.toISOString()}` : undefined,
				),
			)
			.orderBy(expenses.expenseDate),

		db
			.select({
				expenseId: expenseSplits.expenseId,
				userId: expenseSplits.userId,
				owedAmount: expenseSplits.owedAmount,
				isSettled: expenseSplits.isSettled,
			})
			.from(expenseSplits)
			.innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
			.where(
				and(
					eq(expenses.groupId, groupId),
					periodStart ? sql`${expenses.expenseDate} >= ${periodStart.toISOString()}` : undefined,
				),
			),

		db
			.select({ id: users.id, name: users.name })
			.from(groupMembers)
			.innerJoin(users, eq(groupMembers.userId, users.id))
			.where(eq(groupMembers.groupId, groupId)),
	]);

	// Summary
	const totalSpent = allExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
	const myExpenses = allExpenses.filter((e) => e.paidBy === userId);
	const youPaid = myExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
	const mySplits = allSplits.filter((s) => s.userId === userId);
	const yourShare = mySplits.reduce((sum, s) => sum + parseFloat(s.owedAmount), 0);

	// Spending by category
	const categoryMap: Record<string, number> = {};
	for (const e of allExpenses) {
		categoryMap[e.category] = (categoryMap[e.category] ?? 0) + parseFloat(e.amount);
	}
	const byCategory = Object.entries(categoryMap).map(([category, amount]) => ({
		category,
		amount: parseFloat(amount.toFixed(2)),
	}));

	// Member contributions (who paid how much)
	const memberMap: Record<string, { name: string; amount: number }> = {};
	for (const m of allMembers) memberMap[m.id] = { name: m.id === userId ? "You" : (m.name ?? "Unknown"), amount: 0 };
	for (const e of allExpenses) {
		if (memberMap[e.paidBy]) memberMap[e.paidBy].amount += parseFloat(e.amount);
	}
	const byMember = Object.values(memberMap).filter((m) => m.amount > 0);

	// Balance over time (cumulative net per day)
	const splitMap: Record<string, number> = {};
	for (const s of allSplits) splitMap[s.expenseId] = splitMap[s.expenseId] ?? 0;

	const dailyNet: Record<string, number> = {};
	for (const e of allExpenses) {
		const day = e.expenseDate.toISOString().slice(0, 10);
		const mySplit = allSplits.find((s) => s.expenseId === e.id && s.userId === userId);
		const myOwed = mySplit ? parseFloat(mySplit.owedAmount) : 0;
		const iPaid = e.paidBy === userId ? parseFloat(e.amount) : 0;
		dailyNet[day] = (dailyNet[day] ?? 0) + iPaid - myOwed;
	}

	// Cumulative
	let cumulative = 0;
	const balanceOverTime = Object.entries(dailyNet)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, net]) => {
			cumulative += net;
			return { date, balance: parseFloat(cumulative.toFixed(2)) };
		});

	return {
		summary: { totalSpent, youPaid, yourShare },
		byCategory,
		byMember,
		balanceOverTime,
		currentUserId: userId,
	};
}

export type Period = "week" | "month" | "6months" | "year" | "all";

export async function getNotificationsCache(userId: string) {
	"use cache";
	cacheTag("notifications");

	return db
		.select({
			id: notifications.id,
			type: notifications.type,
			message: notifications.message,
			isRead: notifications.isRead,
			createdAt: notifications.createdAt,
			groupId: notifications.groupId,
		})
		.from(notifications)
		.where(eq(notifications.userId, userId))
		.orderBy(desc(notifications.createdAt))
		.limit(50);
}

export async function getUnreadCountCache(userId: string) {
	"use cache";
	cacheTag("notifications");

	const result = await db
		.select({ id: notifications.id })
		.from(notifications)
		.where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

	return result.length;
}
