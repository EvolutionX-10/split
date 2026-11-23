"use server";

import { db } from "@/db";
import { expenses, expenseSplits } from "@/db/schema/app";
import { auth } from "@/auth";
import { updateTag } from "next/cache";
import type { z } from "zod";
import { addExpenseInputSchema } from "@/lib/validation/ledger";
import { requireGroupMembers } from "@/lib/server/group-access";

export type AddExpenseInput = z.infer<typeof addExpenseInputSchema>;

export async function addExpense(input: AddExpenseInput) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");

	const parsed = addExpenseInputSchema.safeParse(input);
	if (!parsed.success) throw new Error(parsed.error.message);

	const { groupId, amount, description, category, splitType, expenseDate, paidBy, splits } = parsed.data;

	// Any group member may record an expense, including one paid by another member.
	await requireGroupMembers(groupId, [session.user.id, paidBy, ...splits.map((split) => split.userId)]);

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
