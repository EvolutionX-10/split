"use server";

import { db } from "@/db";
import { notifications, groupMembers } from "@/db/schema/app";
import { users } from "@/db/schema/auth";
import { auth } from "@/auth";
import { eq, and, desc } from "drizzle-orm";
import { updateTag } from "next/cache";

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

// Called internally when a member joins
export async function createMemberJoinedNotifications(groupId: string, joinedUserId: string) {
	const joinedUser = await db
		.select({ name: users.name })
		.from(users)
		.where(eq(users.id, joinedUserId))
		.then((r) => r[0] ?? null);

	const otherMembers = await db
		.select({ userId: groupMembers.userId })
		.from(groupMembers)
		.where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, joinedUserId)));

	// Notify all other members
	const allMembers = await db
		.select({ userId: groupMembers.userId })
		.from(groupMembers)
		.where(eq(groupMembers.groupId, groupId));

	const toNotify = allMembers.filter((m) => m.userId !== joinedUserId);
	if (toNotify.length === 0) return;

	await db.insert(notifications).values(
		toNotify.map((m) => ({
			userId: m.userId,
			type: "member_joined" as const,
			groupId,
			relatedUserId: joinedUserId,
			message: `${joinedUser?.name ?? "Someone"} joined the group`,
		})),
	);

	updateTag("notifications");
}

// Called from remind button
export async function sendReminder(groupId: string, toUserId: string) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	const sender = await db
		.select({ name: users.name })
		.from(users)
		.where(eq(users.id, session.user.id))
		.then((r) => r[0] ?? null);

	await db.insert(notifications).values({
		userId: toUserId,
		type: "reminder" as const,
		groupId,
		relatedUserId: session.user.id,
		message: `${sender?.name ?? "Someone"} is reminding you to settle up`,
	});

	updateTag("notifications");
}
