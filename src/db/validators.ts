import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { groups, groupMembers, expenses, expenseSplits, settlements, notifications } from "./schema/app";

// --- Groups ---

export const insertGroupSchema = createInsertSchema(groups, {
	name: z.string().min(1, "Name required").max(50),
	description: z.string().max(200).optional(),
	accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color"),
}).omit({ id: true, inviteToken: true, createdBy: true, createdAt: true });

export const selectGroupSchema = createSelectSchema(groups);

// --- Group Members ---

export const insertGroupMemberSchema = createInsertSchema(groupMembers).omit({
	id: true,
	joinedAt: true,
});

// --- Expenses ---

export const insertExpenseSchema = createInsertSchema(expenses, {
	amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
	description: z.string().min(1, "Description required").max(200),
	expenseDate: z.coerce.date(),
}).omit({ id: true, createdAt: true });

export const selectExpenseSchema = createSelectSchema(expenses);

// --- Expense Splits ---

export const insertExpenseSplitSchema = createInsertSchema(expenseSplits, {
	owedAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
	percentage: z
		.string()
		.regex(/^\d+(\.\d{1,2})?$/)
		.optional(),
}).omit({ id: true, isSettled: true, settledAt: true });

// --- Settlements ---

export const insertSettlementSchema = createInsertSchema(settlements, {
	amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
	note: z.string().max(200).optional(),
}).omit({ id: true, settledAt: true });

// --- Notifications ---

export const insertNotificationSchema = createInsertSchema(notifications, {
	message: z.string().min(1).max(500),
}).omit({ id: true, isRead: true, createdAt: true });

// --- Inferred Types ---

export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type SelectGroup = z.infer<typeof selectGroupSchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type SelectExpense = z.infer<typeof selectExpenseSchema>;
export type InsertExpenseSplit = z.infer<typeof insertExpenseSplitSchema>;
export type InsertSettlement = z.infer<typeof insertSettlementSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
