import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import * as appSchema from "@/db/schema/app";
import * as authSchema from "@/db/schema/auth";
import type { AddExpenseInput } from "@/lib/actions/expenses";

// Never fall back to DATABASE_URL or the app's .env.local connection.
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl)
	throw new Error("Set TEST_DATABASE_URL to a dedicated local Postgres database ending in _test (see README).");
const target = new URL(testUrl);
if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) || !target.pathname.endsWith("_test")) {
	throw new Error("Action tests require a local Postgres TEST_DATABASE_URL with a database name ending in _test.");
}

const schemaName = `split_test_${crypto.randomUUID().replaceAll("-", "")}`;
const client = postgres(testUrl, {
	prepare: false,
	max: 5,
	connection: { search_path: schemaName },
	onnotice: () => {},
});
const db = drizzle(client, { schema: { ...appSchema, ...authSchema } });
let currentUserId: string | null = "alice";
const updateTag = mock((_tag: string) => {});

// Only framework/session boundaries are replaced. All queries and writes use real Postgres.
mock.module("@/db", () => ({ db }));
mock.module("@/auth", () => ({ auth: async () => (currentUserId ? { user: { id: currentUserId } } : null) }));
mock.module("next/cache", () => ({ updateTag }));
mock.module("server-only", () => ({}));

const { addExpense } = await import("@/lib/actions/expenses");
const { settleUp } = await import("@/lib/actions/settlements");
const notificationActions = await import("@/lib/actions/notifications");
const { sendReminder, markRead, markAllRead } = notificationActions;
const { acceptInvite } = await import("@/lib/actions/invite");
const { users } = authSchema;
const { groups, groupMembers, expenses, expenseSplits, settlements, notifications } = appSchema;
const groupId = "10000000-0000-4000-8000-000000000001";
const otherGroupId = "10000000-0000-4000-8000-000000000002";

function expense(overrides: Partial<AddExpenseInput> = {}): AddExpenseInput {
	return {
		groupId,
		amount: "100.00",
		description: "Dinner",
		category: "food",
		splitType: "equal",
		expenseDate: new Date("2026-11-23T12:00:00Z"),
		paidBy: "alice",
		splits: [{ userId: "alice" }, { userId: "bob" }],
		...overrides,
	};
}

function payment(overrides = {}) {
	return { groupId, fromUserId: "alice", toUserId: "bob", amount: "10.00", ...overrides };
}

async function expectNoWrites() {
	for (const table of [expenses, expenseSplits, settlements, notifications]) {
		expect(await db.select({ id: table.id }).from(table)).toHaveLength(0);
	}
	expect(updateTag).not.toHaveBeenCalled();
}

async function seedDebt() {
	// Bob owes Alice 100.00; Carol has no bilateral debt with Alice.
	await addExpense(expense({ splits: [{ userId: "bob" }] }));
	updateTag.mockClear();
}

beforeAll(async () => {
	await client.unsafe(`CREATE SCHEMA "${schemaName}"`);
	const journal = JSON.parse(await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8")) as {
		entries: { tag: string }[];
	};
	for (const entry of journal.entries) {
		const migration = await readFile(new URL(`../drizzle/${entry.tag}.sql`, import.meta.url), "utf8");
		await client.unsafe(migration.replaceAll('"public".', `"${schemaName}".`));
	}
});

afterAll(async () => {
	try {
		await client.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
	} finally {
		await client.end();
	}
});

beforeEach(async () => {
	await client.unsafe(
		'TRUNCATE "users", "groups", "group_members", "expenses", "expense_splits", "settlements", "notifications" CASCADE',
	);
	await db.insert(users).values(["alice", "bob", "carol", "outsider"].map((id) => ({ id, name: id })));
	await db.insert(groups).values([
		{ id: groupId, name: "Friends", createdBy: "alice", inviteToken: "friends-invite" },
		{ id: otherGroupId, name: "Other", createdBy: "outsider" },
	]);
	await db
		.insert(groupMembers)
		.values([
			...["alice", "bob", "carol"].map((userId) => ({ groupId, userId })),
			{ groupId: otherGroupId, userId: "outsider" },
		]);
	currentUserId = "alice";
	updateTag.mockClear();
});

describe("expense action authorization and validation", () => {
	test("anonymous requests cannot create expenses", async () => {
		currentUserId = null;
		await expect(addExpense(expense())).rejects.toThrow("Unauthorized");
		await expectNoWrites();
	});

	test("outsiders cannot record expenses for a group", async () => {
		currentUserId = "outsider";
		await expect(addExpense(expense())).rejects.toThrow("Not a member");
		await expectNoWrites();
	});

	test.each([
		{ paidBy: "outsider" },
		{ splits: [{ userId: "alice" }, { userId: "outsider" }] },
		{ paidBy: "missing-user" },
		{ groupId: otherGroupId },
	] satisfies Partial<AddExpenseInput>[])(
		"rejects a payer, participant, or group outside the caller's memberships: %j",
		async (input) => {
			await expect(addExpense(expense(input))).rejects.toThrow("Not a member");
			await expectNoWrites();
		},
	);

	test.each([
		{ amount: "0" },
		{ amount: "-1.00" },
		{ amount: "100000000.00" },
		{ amount: "0.001" },
		{ amount: "NaN" },
		{ amount: "1e2" },
		{ description: "   " },
		{ expenseDate: new Date("invalid") },
		{ splits: [] },
		{ splits: [{ userId: "alice" }, { userId: "alice" }] },
		{ splitType: "exact", splits: [{ userId: "alice", amount: "99.99" }] },
		{ splitType: "exact", splits: [{ userId: "alice", amount: "100.01" }] },
		{ splitType: "exact", splits: [{ userId: "alice" }] },
		{
			splitType: "exact",
			splits: [
				{ userId: "alice", amount: "-1" },
				{ userId: "bob", amount: "101" },
			],
		},
		{ splitType: "percentage", splits: [{ userId: "alice", percentage: "99.99" }] },
		{ splitType: "percentage", splits: [{ userId: "alice", percentage: "100.01" }] },
		{ splitType: "percentage", splits: [{ userId: "alice" }] },
		{
			splitType: "percentage",
			splits: [
				{ userId: "alice", percentage: "-1" },
				{ userId: "bob", percentage: "101" },
			],
		},
	] satisfies Partial<AddExpenseInput>[])("rejects invalid direct input before writing: %j", async (input) => {
		await expect(addExpense(expense(input))).rejects.toThrow();
		await expectNoWrites();
	});

	test("rejects more than 100 participants before writing", async () => {
		await expect(
			addExpense(expense({ splits: Array.from({ length: 101 }, (_, i) => ({ userId: `member-${i}` })) })),
		).rejects.toThrow();
		await expectNoWrites();
	});

	test("accepts 100 distinct group members at the supported limit", async () => {
		const ids = Array.from({ length: 100 }, (_, i) => `member-${i}`);
		await db.insert(users).values(ids.map((id) => ({ id })));
		await db.insert(groupMembers).values(ids.map((userId) => ({ groupId, userId })));
		await addExpense(expense({ splits: ids.map((userId) => ({ userId })) }));
		expect(await db.select().from(expenseSplits)).toHaveLength(100);
	});

	test("a member can record another member's expense without being in the split", async () => {
		currentUserId = "carol";
		const created = await addExpense(expense({ paidBy: "bob", splits: [{ userId: "alice" }] }));
		expect(created.paidBy).toBe("bob");
		expect(
			await db.select({ userId: expenseSplits.userId, amount: expenseSplits.owedAmount }).from(expenseSplits),
		).toEqual([{ userId: "alice", amount: "100.00" }]);
		expect(updateTag.mock.calls).toEqual([[`group-${groupId}`], ["groups"]]);
	});

	test.each([
		{
			splitType: "exact",
			amount: "0.30",
			splits: [
				{ userId: "alice", amount: "0.10" },
				{ userId: "bob", amount: "0.20" },
			],
		},
		{
			splitType: "percentage",
			splits: [
				{ userId: "alice", percentage: "33.33" },
				{ userId: "bob", percentage: "66.67" },
			],
		},
		{ splitType: "exact", splits: [{ userId: "alice", amount: "100" }, { userId: "bob" }] },
		{ splitType: "percentage", splits: [{ userId: "alice", percentage: "100" }, { userId: "bob" }] },
		{ amount: "99999999.99", splits: [{ userId: "alice" }] },
	] satisfies Partial<AddExpenseInput>[])(
		"accepts exact totals and existing zero-share semantics: %j",
		async (input) => {
			const created = await addExpense(expense(input));
			expect((await db.select().from(expenses))[0].id).toBe(created.id);
			expect(await db.select().from(expenseSplits)).toHaveLength(input.splits!.length);
		},
	);
});

describe("settlement action policy", () => {
	test("anonymous callers cannot settle up", async () => {
		currentUserId = null;
		await expect(settleUp(payment())).rejects.toThrow("Unauthorized");
		await expectNoWrites();
	});

	test("an unrelated group member cannot record a payment between others", async () => {
		currentUserId = "carol";
		await expect(settleUp(payment())).rejects.toThrow("Only a payment participant");
		await expectNoWrites();
	});

	test("an outsider cannot record payments between group members", async () => {
		currentUserId = "outsider";
		await expect(settleUp(payment())).rejects.toThrow();
		await expectNoWrites();
	});

	test.each([
		{ fromUserId: "outsider" },
		{ toUserId: "outsider" },
		{ toUserId: "missing-user" },
		{ groupId: otherGroupId },
		{ toUserId: "alice" },
		{ amount: "0.00" },
		{ amount: "-1" },
		{ amount: "100000000.00" },
		{ amount: "1.001" },
	])("rejects invalid participant or amount input: %j", async (input) => {
		await expect(settleUp(payment(input))).rejects.toThrow();
		await expectNoWrites();
	});

	test.each(["alice", "bob"])("%s may record a payment they sent or received", async (userId) => {
		currentUserId = userId;
		await settleUp(payment());
		expect(
			await db
				.select({ from: settlements.fromUserId, to: settlements.toUserId, amount: settlements.amount })
				.from(settlements),
		).toEqual([{ from: "alice", to: "bob", amount: "10.00" }]);
	});

	test("partial and overpayments remain supported", async () => {
		await seedDebt();
		currentUserId = "bob";
		await settleUp(payment({ fromUserId: "bob", toUserId: "alice", amount: "25" }));
		await settleUp(payment({ fromUserId: "bob", toUserId: "alice", amount: "100" }));
		expect(await db.select().from(settlements)).toHaveLength(2);
	});
});

describe("notification action boundaries and reminders", () => {
	test("the internal member-joined writer is not exported as an action", () => {
		expect("createMemberJoinedNotifications" in notificationActions).toBe(false);
	});

	test("anonymous callers cannot send reminders", async () => {
		currentUserId = null;
		await expect(sendReminder(groupId, "bob")).rejects.toThrow("Unauthorized");
		await expectNoWrites();
	});

	test("outsiders cannot remind a group member", async () => {
		currentUserId = "outsider";
		await expect(sendReminder(groupId, "bob")).rejects.toThrow("Not a member");
		await expectNoWrites();
	});

	test.each([
		[groupId, "outsider"],
		[groupId, "alice"],
		["invalid", "bob"],
	])("rejects nonmember/self/invalid requests: %s %s", async (id, recipientId) => {
		await expect(sendReminder(id, recipientId)).rejects.toThrow();
		await expectNoWrites();
	});

	test("there must be a positive bilateral debt, not just a group balance", async () => {
		expect(await sendReminder(groupId, "bob")).toEqual({ status: "no_debt" });
		await seedDebt();
		expect(await sendReminder(groupId, "carol")).toEqual({ status: "no_debt" });
		currentUserId = "bob";
		expect(await sendReminder(groupId, "alice")).toEqual({ status: "no_debt" });
		expect(await db.select().from(notifications)).toHaveLength(0);
	});

	test("a member can remind a debtor and cannot repeat within 24 hours", async () => {
		await seedDebt();
		expect(await sendReminder(groupId, "bob")).toEqual({ status: "sent" });
		expect(await sendReminder(groupId, "bob")).toEqual({ status: "cooldown" });
		expect(
			await db
				.select({ userId: notifications.userId, sender: notifications.relatedUserId, type: notifications.type })
				.from(notifications),
		).toEqual([{ userId: "bob", sender: "alice", type: "reminder" }]);
		expect(updateTag.mock.calls).toEqual([["notifications"]]);
	});

	test("the cooldown survives marking a reminder as read", async () => {
		await seedDebt();
		await sendReminder(groupId, "bob");
		await db.update(notifications).set({ isRead: true });
		expect(await sendReminder(groupId, "bob")).toEqual({ status: "cooldown" });
	});

	test("an older reminder permits another reminder", async () => {
		await seedDebt();
		await sendReminder(groupId, "bob");
		await db.update(notifications).set({ createdAt: sql`clock_timestamp() - interval '25 hours'` });
		expect(await sendReminder(groupId, "bob")).toEqual({ status: "sent" });
		expect(await db.select().from(notifications)).toHaveLength(2);
	});

	test("parallel requests insert just one reminder", async () => {
		await seedDebt();
		const results = await Promise.all(Array.from({ length: 8 }, () => sendReminder(groupId, "bob")));
		expect(results.filter((result) => result.status === "sent")).toHaveLength(1);
		expect(results.filter((result) => result.status === "cooldown")).toHaveLength(7);
		expect(await db.select().from(notifications)).toHaveLength(1);
	});

	test("settlements and reverse expenses change reminder eligibility immediately", async () => {
		await seedDebt();
		await addExpense(expense({ paidBy: "bob", amount: "20", splits: [{ userId: "alice" }] }));
		await settleUp(payment({ fromUserId: "bob", toUserId: "alice", amount: "80" }));
		expect(await sendReminder(groupId, "bob")).toEqual({ status: "no_debt" });
		await settleUp(payment({ fromUserId: "alice", toUserId: "bob", amount: "0.01" }));
		expect(await sendReminder(groupId, "bob")).toEqual({ status: "sent" });
	});

	test("a debt in another group does not authorize a reminder here", async () => {
		await db.insert(groupMembers).values([
			{ groupId: otherGroupId, userId: "alice" },
			{ groupId: otherGroupId, userId: "bob" },
		]);
		await addExpense(expense({ groupId: otherGroupId, splits: [{ userId: "bob" }] }));
		expect(await sendReminder(groupId, "bob")).toEqual({ status: "no_debt" });
	});

	test("removed recipients cannot receive reminders even with historical debt", async () => {
		await seedDebt();
		await db.delete(groupMembers).where(eq(groupMembers.userId, "bob"));
		await expect(sendReminder(groupId, "bob")).rejects.toThrow("Not a member");
		expect(await db.select().from(notifications)).toHaveLength(0);
	});

	test("accepting an invite still notifies the other members through the internal helper", async () => {
		currentUserId = "outsider";
		await acceptInvite("friends-invite");
		const rows = await db.select().from(notifications);
		expect(rows.map((row) => row.userId).sort()).toEqual(["alice", "bob", "carol"]);
		expect(rows.every((row) => row.type === "member_joined" && row.relatedUserId === "outsider")).toBe(true);
	});

	test("read actions cannot mark someone else's notifications read", async () => {
		await seedDebt();
		await sendReminder(groupId, "bob");
		const [row] = await db.select().from(notifications);
		await markRead(row.id);
		await markAllRead();
		expect((await db.select().from(notifications))[0].isRead).toBe(false);
		currentUserId = "bob";
		await markRead(row.id);
		expect((await db.select().from(notifications))[0].isRead).toBe(true);
	});
});
