"use server";

import { db } from "@/db";
import { expenses, expenseSplits, groupMembers } from "@/db/schema/app";
import { auth } from "@/auth";
import { eq, and } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";

const addExpenseInputSchema = z.object({
	groupId: z.string().uuid(),
	amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
	description: z.string().min(1).max(200),
	category: z.enum(["food", "transport", "accommodation", "entertainment", "shopping", "utilities", "health", "other"]),
	splitType: z.enum(["equal", "percentage", "exact"]),
	expenseDate: z.coerce.date(),
	paidBy: z.string(),
	splits: z
		.array(
			z.object({
				userId: z.string(),
				amount: z
					.string()
					.regex(/^\d+(\.\d{1,2})?$/)
					.optional(), // for exact
				percentage: z
					.string()
					.regex(/^\d+(\.\d{1,2})?$/)
					.optional(), // for percentage
			}),
		)
		.min(1),
});

export type AddExpenseInput = z.infer<typeof addExpenseInputSchema>;

export async function addExpense(input: AddExpenseInput) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	const parsed = addExpenseInputSchema.safeParse(input);
	if (!parsed.success) throw new Error(parsed.error.message);

	const { groupId, amount, description, category, splitType, expenseDate, paidBy, splits } = parsed.data;

	// Verify current user is a member
	const membership = await db
		.select()
		.from(groupMembers)
		.where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, session.user.id)))
		.then((r) => r[0] ?? null);

	if (!membership) throw new Error("Not a member");

	const totalAmount = parseFloat(amount);

	// Compute owed amounts per split type
	const splitRows = splits.map((s) => {
		let owedAmount: number;

		if (splitType === "equal") {
			owedAmount = parseFloat((totalAmount / splits.length).toFixed(2));
		} else if (splitType === "percentage") {
			const pct = parseFloat(s.percentage ?? "0");
			owedAmount = parseFloat(((pct / 100) * totalAmount).toFixed(2));
		} else {
			owedAmount = parseFloat(s.amount ?? "0");
		}

		return {
			userId: s.userId,
			owedAmount: owedAmount.toFixed(2),
			percentage: s.percentage ?? null,
		};
	});

	// Fix rounding drift for equal splits
	if (splitType === "equal") {
		const splitTotal = splitRows.reduce((sum, r) => sum + parseFloat(r.owedAmount), 0);
		const drift = parseFloat((totalAmount - splitTotal).toFixed(2));
		if (drift !== 0) {
			splitRows[0].owedAmount = (parseFloat(splitRows[0].owedAmount) + drift).toFixed(2);
		}
	}

	// Insert expense
	const [expense] = await db
		.insert(expenses)
		.values({
			groupId,
			paidBy,
			amount,
			category,
			description,
			splitType,
			expenseDate,
		})
		.returning();

	// Insert splits in one batch
	await db.insert(expenseSplits).values(
		splitRows.map((s) => ({
			expenseId: expense.id,
			userId: s.userId,
			owedAmount: s.owedAmount,
			percentage: s.percentage,
		})),
	);

	updateTag(`group-${groupId}`);
	updateTag("groups");

	return expense;
}
