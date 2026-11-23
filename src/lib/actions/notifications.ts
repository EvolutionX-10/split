"use server";

import { db } from "@/db";
import { notifications, groups, expenses, expenseSplits, settlements } from "@/db/schema/app";
import { users } from "@/db/schema/auth";
import { auth } from "@/auth";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";
import { userIdSchema } from "@/lib/validation/ledger";
import { requireGroupMembers } from "@/lib/server/group-access";

export async function getNotifications() {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	return db
		.select({
			id: notifications.id,
			type: notifications.type,
			message: notifications.message,
			isRead: notifications.isRead,
			createdAt: notifications.createdAt,
			groupId: notifications.groupId,
			relatedUserId: notifications.relatedUserId,
		})
		.from(notifications)
		.where(eq(notifications.userId, session.user.id))
		.orderBy(desc(notifications.createdAt))
		.limit(50);
}

export async function getUnreadCount() {
	const session = await auth();
	if (!session?.user?.id) return 0;

	const result = await db
		.select({ id: notifications.id })
		.from(notifications)
		.where(and(eq(notifications.userId, session.user.id), eq(notifications.isRead, false)));

	return result.length;
}

export async function markAllRead() {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	await db
		.update(notifications)
		.set({ isRead: true })
		.where(and(eq(notifications.userId, session.user.id), eq(notifications.isRead, false)));

	updateTag("notifications");
}

export async function markRead(notificationId: string) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	await db
		.update(notifications)
		.set({ isRead: true })
		.where(and(eq(notifications.id, notificationId), eq(notifications.userId, session.user.id)));

	updateTag("notifications");
}

// Called from remind button
export async function sendReminder(groupId: string, toUserId: string) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	const userId = session.user.id;
	z.object({ groupId: z.string().uuid(), toUserId: userIdSchema }).parse({ groupId, toUserId });
	if (userId === toUserId) throw new Error("Cannot remind yourself");
	await requireGroupMembers(groupId, [userId, toUserId]);

	const result = await db.transaction(async (tx) => {
		// Serialize reminder checks/inserts for this group, including requests from other processes.
		await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId)).for("update");
		await requireGroupMembers(groupId, [userId, toUserId], tx);

		const expenseDebt = (payerId: string, debtorId: string) =>
			tx
				.select({ total: sql<string>`coalesce(sum(${expenseSplits.owedAmount}), 0)` })
				.from(expenseSplits)
				.innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
				.where(
					and(
						eq(expenses.groupId, groupId),
						eq(expenses.paidBy, payerId),
						eq(expenseSplits.userId, debtorId),
						eq(expenseSplits.isSettled, false),
					),
				);
		const payments = (fromUserId: string, recipientId: string) =>
			tx
				.select({ total: sql<string>`coalesce(sum(${settlements.amount}), 0)` })
				.from(settlements)
				.where(
					and(
						eq(settlements.groupId, groupId),
						eq(settlements.fromUserId, fromUserId),
						eq(settlements.toUserId, recipientId),
					),
				);
		// Use uncached Postgres numeric arithmetic, matching the pair balance shown in the UI.
		const [balance] = await tx
			.select({
				hasDebt: sql<boolean>`(
					(${expenseDebt(userId, toUserId)}) - (${expenseDebt(toUserId, userId)})
					+ (${payments(userId, toUserId)}) - (${payments(toUserId, userId)})
				) > 0`,
			})
			.from(groups)
			.where(eq(groups.id, groupId));
		if (!balance?.hasDebt) return { status: "no_debt" as const };

		const [recent] = await tx
			.select({ id: notifications.id })
			.from(notifications)
			.where(
				and(
					eq(notifications.type, "reminder"),
					eq(notifications.groupId, groupId),
					eq(notifications.relatedUserId, userId),
					eq(notifications.userId, toUserId),
					gte(notifications.createdAt, sql`clock_timestamp() - interval '24 hours'`),
				),
			)
			.limit(1);
		if (recent) return { status: "cooldown" as const };

		const [sender] = await tx.select({ name: users.name }).from(users).where(eq(users.id, userId));
		await tx.insert(notifications).values({
			userId: toUserId,
			type: "reminder",
			groupId,
			relatedUserId: userId,
			message: `${sender?.name ?? "Someone"} is reminding you to settle up`,
		});
		return { status: "sent" as const };
	});

	if (result.status === "sent") updateTag("notifications");
	return result;
}
