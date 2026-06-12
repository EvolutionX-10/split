import { pgTable, text, timestamp, numeric, pgEnum, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";

// --- Enums ---

export const splitTypeEnum = pgEnum("split_type", ["equal", "percentage", "exact"]);
export const expenseCategoryEnum = pgEnum("expense_category", [
	"food",
	"transport",
	"accommodation",
	"entertainment",
	"shopping",
	"utilities",
	"health",
	"other",
]);
export const memberRoleEnum = pgEnum("member_role", ["owner", "member"]);
export const notificationTypeEnum = pgEnum("notification_type", [
	"member_joined",
	"expense_added",
	"settlement_requested",
	"settlement_done",
	"reminder",
]);

// --- Groups ---

export const groups = pgTable("groups", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull(),
	description: text("description"),
	accentColor: text("accentColor").notNull().default("#6366f1"),
	inviteToken: text("inviteToken")
		.notNull()
		.unique()
		.$defaultFn(() => crypto.randomUUID()),
	createdBy: text("createdBy")
		.notNull()
		.references(() => users.id),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

// --- Group Members ---

export const groupMembers = pgTable("group_members", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	groupId: text("groupId")
		.notNull()
		.references(() => groups.id, { onDelete: "cascade" }),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	role: memberRoleEnum("role").notNull().default("member"),
	joinedAt: timestamp("joinedAt", { mode: "date" }).notNull().defaultNow(),
});

// --- Expenses ---

export const expenses = pgTable("expenses", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	groupId: text("groupId")
		.notNull()
		.references(() => groups.id, { onDelete: "cascade" }),
	paidBy: text("paidBy")
		.notNull()
		.references(() => users.id),
	amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
	category: expenseCategoryEnum("category").notNull().default("other"),
	description: text("description").notNull(),
	splitType: splitTypeEnum("splitType").notNull().default("equal"),
	expenseDate: timestamp("expenseDate", { mode: "date" }).notNull().defaultNow(),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

// --- Expense Splits ---
// one row per member included in the expense

export const expenseSplits = pgTable("expense_splits", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	expenseId: text("expenseId")
		.notNull()
		.references(() => expenses.id, { onDelete: "cascade" }),
	userId: text("userId")
		.notNull()
		.references(() => users.id),
	owedAmount: numeric("owedAmount", { precision: 10, scale: 2 }).notNull(),
	percentage: numeric("percentage", { precision: 5, scale: 2 }), // null if not % split
	isSettled: boolean("isSettled").notNull().default(false),
	settledAt: timestamp("settledAt", { mode: "date" }),
});

// --- Settlements ---
// explicit settle-up transactions between two users in a group

export const settlements = pgTable("settlements", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	groupId: text("groupId")
		.notNull()
		.references(() => groups.id, { onDelete: "cascade" }),
	fromUserId: text("fromUserId")
		.notNull()
		.references(() => users.id), // person paying
	toUserId: text("toUserId")
		.notNull()
		.references(() => users.id), // person receiving
	amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
	note: text("note"),
	settledAt: timestamp("settledAt", { mode: "date" }).notNull().defaultNow(),
});

// --- Notifications ---

export const notifications = pgTable("notifications", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	type: notificationTypeEnum("type").notNull(),
	groupId: text("groupId").references(() => groups.id, { onDelete: "cascade" }),
	relatedUserId: text("relatedUserId").references(() => users.id), // who triggered it
	message: text("message").notNull(),
	isRead: boolean("isRead").notNull().default(false),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

// --- Relations ---

export const groupsRelations = relations(groups, ({ one, many }) => ({
	creator: one(users, { fields: [groups.createdBy], references: [users.id] }),
	members: many(groupMembers),
	expenses: many(expenses),
	settlements: many(settlements),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
	group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
	user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
	group: one(groups, { fields: [expenses.groupId], references: [groups.id] }),
	paidByUser: one(users, { fields: [expenses.paidBy], references: [users.id] }),
	splits: many(expenseSplits),
}));

export const expenseSplitsRelations = relations(expenseSplits, ({ one }) => ({
	expense: one(expenses, { fields: [expenseSplits.expenseId], references: [expenses.id] }),
	user: one(users, { fields: [expenseSplits.userId], references: [users.id] }),
}));

export const settlementsRelations = relations(settlements, ({ one }) => ({
	group: one(groups, { fields: [settlements.groupId], references: [groups.id] }),
	fromUser: one(users, { fields: [settlements.fromUserId], references: [users.id] }),
	toUser: one(users, { fields: [settlements.toUserId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
	user: one(users, { fields: [notifications.userId], references: [users.id] }),
	group: one(groups, { fields: [notifications.groupId], references: [groups.id] }),
	relatedUser: one(users, { fields: [notifications.relatedUserId], references: [users.id] }),
}));
