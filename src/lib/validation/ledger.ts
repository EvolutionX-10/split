import { z } from "zod";

// Postgres numeric(10, 2) allows at most eight whole digits.
const moneySchema = z.string().regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter an amount up to 99,999,999.99");
export const positiveMoneySchema = moneySchema.refine((value) => Number(value) > 0, "Amount must be positive");
const percentageSchema = z
	.string()
	.regex(/^\d{1,3}(\.\d{1,2})?$/, "Invalid percentage")
	.refine((value) => Number(value) <= 100, "Percentage must be between 0 and 100");

export const userIdSchema = z.string().min(1).max(255);
export const MAX_SPLIT_PARTICIPANTS = 100;

// Call only with validated decimal strings. Bounded inputs/sums stay within safe integers.
function hundredths(value: string) {
	const [whole, fraction = ""] = value.split(".");
	return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export const addExpenseInputSchema = z
	.object({
		groupId: z.string().uuid(),
		amount: positiveMoneySchema,
		description: z.string().trim().min(1).max(200),
		category: z.enum([
			"food",
			"transport",
			"accommodation",
			"entertainment",
			"shopping",
			"utilities",
			"health",
			"other",
		]),
		splitType: z.enum(["equal", "percentage", "exact"]),
		expenseDate: z.coerce.date(),
		paidBy: userIdSchema,
		splits: z
			.array(
				z.object({
					userId: userIdSchema,
					amount: moneySchema.optional(),
					percentage: percentageSchema.optional(),
				}),
			)
			.min(1)
			.max(MAX_SPLIT_PARTICIPANTS),
	})
	.superRefine((input, ctx) => {
		if (new Set(input.splits.map((split) => split.userId)).size !== input.splits.length) {
			ctx.addIssue({ code: "custom", path: ["splits"], message: "Each participant must appear once" });
		}
		// Blank member inputs retain the form's existing meaning of zero.
		if (
			input.splitType === "exact" &&
			input.splits.reduce((sum, split) => sum + hundredths(split.amount ?? "0"), 0) !== hundredths(input.amount)
		) {
			ctx.addIssue({ code: "custom", path: ["splits"], message: "Exact shares must add up to the expense amount" });
		}
		if (
			input.splitType === "percentage" &&
			input.splits.reduce((sum, split) => sum + hundredths(split.percentage ?? "0"), 0) !== 10_000
		) {
			ctx.addIssue({ code: "custom", path: ["splits"], message: "Percentages must add up to 100%" });
		}
	});

export const settleUpInputSchema = z
	.object({
		groupId: z.string().uuid(),
		fromUserId: userIdSchema,
		toUserId: userIdSchema,
		amount: positiveMoneySchema,
		note: z.string().max(200).optional(),
	})
	.refine((input) => input.fromUserId !== input.toUserId, "Cannot settle up with yourself");
