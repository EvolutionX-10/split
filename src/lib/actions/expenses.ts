"use server";

import { db } from "@/db";
import { expenses, expenseSplits } from "@/db/schema/app";
import { auth } from "@/auth";
import { updateTag } from "next/cache";
import type { z } from "zod";
import { addExpenseInputSchema } from "@/lib/validation/ledger";
import { requireGroupMembers } from "@/lib/server/group-access";
import { calculateSplits } from "@/lib/ledger/splits";
import { formatMoney, parseMoney } from "@/lib/ledger/money";

export type AddExpenseInput = z.infer<typeof addExpenseInputSchema>;

export async function addExpense(input: AddExpenseInput) {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Unauthorized");
	const userId = session.user.id;

	const parsed = addExpenseInputSchema.safeParse(input);
	if (!parsed.success) throw new Error(parsed.error.message);

	const { groupId, amount, description, category, splitType, expenseDate, paidBy, splits } = parsed.data;

	const allocation = calculateSplits(parsed.data);
	if (!allocation.ok) throw new Error(allocation.message);
	const expense = await db.transaction(async (tx) => {
		// Any group member may record another member's expense; check before either write.
		await requireGroupMembers(groupId, [userId, paidBy, ...splits.map((split) => split.userId)], tx);
		const [created] = await tx
			.insert(expenses)
			.values({
				groupId,
				paidBy,
				amount: formatMoney(parseMoney(amount)!),
				category,
				description,
				splitType,
				expenseDate,
			})
			.returning();
		await tx.insert(expenseSplits).values(
			allocation.shares.map((share, index) => ({
				expenseId: created.id,
				userId: share.userId,
				owedAmount: share.amount,
				percentage: splitType === "percentage" ? (splits[index].percentage ?? "0") : null,
			})),
		);
		return created;
	});

	updateTag(`group-${groupId}`);
	updateTag("groups");

	return expense;
}
