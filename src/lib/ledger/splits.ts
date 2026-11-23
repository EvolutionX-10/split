import { formatMoney, parseMoney, parsePercentage } from "./money";

export const MAX_SPLIT_PARTICIPANTS = 100;
export type SplitType = "equal" | "percentage" | "exact";
export type SplitInput = {
	amount: string;
	splitType: SplitType;
	splits: { userId: string; amount?: string; percentage?: string }[];
};
type SplitResult =
	| { ok: true; shares: { userId: string; minor: number; amount: string }[] }
	| {
			ok: false;
			field: "amount" | "members" | "splits";
			message: string;
			remaining?: { value: number; unit: "paise" | "basisPoints" };
	  };

export function calculateSplits({ amount, splitType, splits }: SplitInput): SplitResult {
	const total = parseMoney(amount);
	if (total === null || total <= 0) {
		return { ok: false, field: "amount", message: "Enter an amount from 0.01 to 99,999,999.99" };
	}
	if (splits.length === 0 || splits.length > MAX_SPLIT_PARTICIPANTS) {
		return { ok: false, field: "members", message: `Include between 1 and ${MAX_SPLIT_PARTICIPANTS} members` };
	}
	if (splits.some((split) => !split.userId) || new Set(splits.map((split) => split.userId)).size !== splits.length) {
		return { ok: false, field: "members", message: "Each participant must appear once" };
	}

	let shares: number[];
	if (splitType === "exact") {
		const values = splits.map((split) => parseMoney(split.amount ?? "0"));
		if (values.some((value) => value === null)) {
			return { ok: false, field: "splits", message: "Enter valid exact shares with up to two decimal places" };
		}
		shares = values as number[];
		const remaining = total - shares.reduce((sum, value) => sum + value, 0);
		if (remaining !== 0) {
			return {
				ok: false,
				field: "splits",
				message: "Exact shares must add up to the expense amount",
				remaining: { value: remaining, unit: "paise" },
			};
		}
	} else {
		const weights = splits.map((split) => (splitType === "equal" ? 1 : parsePercentage(split.percentage ?? "0")));
		if (weights.some((value) => value === null)) {
			return {
				ok: false,
				field: "splits",
				message: "Percentages must be between 0 and 100 with up to two decimal places",
			};
		}
		const validWeights = weights as number[];
		const denominator = validWeights.reduce((sum, value) => sum + value, 0);
		if (splitType === "percentage" && denominator !== 10_000) {
			return {
				ok: false,
				field: "splits",
				message: "Percentages must add up to 100%",
				remaining: { value: 10_000 - denominator, unit: "basisPoints" },
			};
		}
		// Largest remainder: all products are <= 9,999,999,999 * 10,000, safely below 2^53.
		shares = validWeights.map((weight) => Math.floor((total * weight) / denominator));
		const remaining = total - shares.reduce((sum, value) => sum + value, 0);
		const order = splits
			.map((split, index) => ({
				index,
				userId: split.userId,
				remainder: (total * validWeights[index]) % denominator,
			}))
			.sort((a, b) => b.remainder - a.remainder || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
		// Use code-unit ID order for ties, independent of input order and browser/server locale.
		for (let i = 0; i < remaining; i++) shares[order[i].index]++;
	}
	return {
		ok: true,
		shares: splits.map((split, index) => ({
			userId: split.userId,
			minor: shares[index],
			amount: formatMoney(shares[index]),
		})),
	};
}
