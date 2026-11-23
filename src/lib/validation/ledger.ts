import { z } from "zod";
import { parseMoney, parsePercentage } from "@/lib/ledger/money";
import { calculateSplits, MAX_SPLIT_PARTICIPANTS } from "@/lib/ledger/splits";

// Postgres numeric(10, 2) allows at most eight whole digits.
const moneySchema = z.string().refine((value) => parseMoney(value) !== null, "Enter an amount up to 99,999,999.99");
export const positiveMoneySchema = moneySchema.refine(
	(value) => (parseMoney(value) ?? 0) > 0,
	"Amount must be positive",
);
const percentageSchema = z
	.string()
	.refine((value) => parsePercentage(value) !== null, "Percentage must be between 0 and 100");

export const userIdSchema = z.string().min(1).max(255);

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
		const result = calculateSplits(input);
		if (!result.ok)
			ctx.addIssue({
				code: "custom",
				path: [result.field === "members" ? "splits" : result.field],
				message: result.message,
			});
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
