import { describe, expect, test } from "bun:test";
import { formatMoney, MAX_MONEY_MINOR, parseMoney, parsePercentage } from "@/lib/ledger/money";
import { calculateSplits, type SplitInput } from "@/lib/ledger/splits";

function shares(input: SplitInput) {
	const result = calculateSplits(input);
	if (!result.ok) throw new Error(result.message);
	return result.shares;
}

describe("decimal money boundaries", () => {
	test.each([
		["0", 0],
		["0.01", 1],
		["0.1", 10],
		["1.01", 101],
		["99999999.99", MAX_MONEY_MINOR],
	] as const)("parses %s to %s paise and formats without float rounding", (text, minor) => {
		expect(parseMoney(text)).toBe(minor);
		expect(parseMoney(formatMoney(minor))).toBe(minor);
	});
	test.each(["", "-1", "1e2", "NaN", "Infinity", "1.001", "100000000", " 1", "1\n"])(
		"rejects invalid money %j",
		(value) => {
			expect(parseMoney(value)).toBeNull();
		},
	);
	test("supports signed allocation differences, rejects unsafe formatting, and bounds percentages", () => {
		expect(formatMoney(-1)).toBe("-0.01");
		expect(() => formatMoney(Number.MAX_SAFE_INTEGER + 1)).toThrow();
		expect(() => formatMoney(1.5)).toThrow();
		expect(parsePercentage("33.33")).toBe(3333);
		expect(parsePercentage("100")).toBe(10000);
		for (const value of ["100.01", "-1", "0.001", "", "1e2"]) expect(parsePercentage(value)).toBeNull();
	});
});

describe("shared split allocation", () => {
	test("three paise split five ways never produces a negative share", () => {
		const result = shares({
			amount: "0.03",
			splitType: "equal",
			splits: ["e", "c", "a", "d", "b"].map((userId) => ({ userId })),
		});
		expect(Object.fromEntries(result.map((share) => [share.userId, share.amount]))).toEqual({
			a: "0.01",
			b: "0.01",
			c: "0.01",
			d: "0.00",
			e: "0.00",
		});
	});
	test("five paise at 50/50 conserves the total with a deterministic tie break", () => {
		expect(
			shares({
				amount: "0.05",
				splitType: "percentage",
				splits: [
					{ userId: "b", percentage: "50" },
					{ userId: "a", percentage: "50" },
				],
			}),
		).toEqual([
			{ userId: "b", minor: 2, amount: "0.02" },
			{ userId: "a", minor: 3, amount: "0.03" },
		]);
	});
	test("larger fractional remainders receive the extra paise before ID tie breaks", () => {
		expect(
			shares({
				amount: "0.01",
				splitType: "percentage",
				splits: [
					{ userId: "a", percentage: "1" },
					{ userId: "b", percentage: "99" },
				],
			}).map((s) => s.minor),
		).toEqual([0, 1]);
	});
	test("exact shares, including omitted zero shares, are preserved", () => {
		expect(
			shares({
				amount: "0.30",
				splitType: "exact",
				splits: [{ userId: "a", amount: "0.10" }, { userId: "b", amount: "0.20" }, { userId: "c" }],
			}).map((s) => s.minor),
		).toEqual([10, 20, 0]);
	});
	test.each([
		{ amount: "0", splitType: "equal", splits: [{ userId: "a" }] },
		{ amount: "1", splitType: "equal", splits: [] },
		{ amount: "1", splitType: "equal", splits: [{ userId: "a" }, { userId: "a" }] },
		{ amount: "1", splitType: "equal", splits: [{ userId: "" }] },
		{ amount: "1", splitType: "percentage", splits: [{ userId: "a", percentage: "100.01" }] },
		{ amount: "1", splitType: "exact", splits: [{ userId: "a", amount: "0.999" }] },
	] satisfies SplitInput[])("rejects invalid allocations: %j", (input) => {
		expect(calculateSplits(input).ok).toBe(false);
	});
	test("reports exact under/over allocation without tolerating a missing paise", () => {
		for (const [amount, remaining] of [
			["0.99", 1],
			["1.01", -1],
		] as const) {
			const result = calculateSplits({ amount: "1", splitType: "exact", splits: [{ userId: "a", amount }] });
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.remaining).toEqual({ value: remaining, unit: "paise" });
		}
		const result = calculateSplits({
			amount: "1",
			splitType: "percentage",
			splits: [{ userId: "a", percentage: "99.99" }],
		});
		if (result.ok) throw new Error("Expected incomplete percentage split");
		expect(result.remaining).toEqual({ value: 1, unit: "basisPoints" });
	});

	test("seeded property checks conserve totals, stay nonnegative, and are independent of participant order", () => {
		let seed = 0x5eed;
		const random = () => {
			seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
			return seed / 0x100000000;
		};
		for (let trial = 0; trial < 1000; trial++) {
			const count = 1 + Math.floor(random() * 100);
			const total = trial % 10 === 0 ? MAX_MONEY_MINOR : 1 + Math.floor(random() * MAX_MONEY_MINOR);
			let remaining = 10000;
			const weights = Array.from({ length: count }, (_, i) => {
				const weight = i === count - 1 ? remaining : Math.floor(random() * (remaining + 1));
				remaining -= weight;
				return weight;
			});
			for (const splitType of ["equal", "percentage"] as const) {
				const splits = weights.map((weight, i) => ({
					userId: `user-${String(i).padStart(3, "0")}`,
					percentage: formatMoney(weight),
				}));
				const input = { amount: formatMoney(total), splitType, splits };
				const allocated = shares(input);
				expect(allocated.reduce((sum, s) => sum + s.minor, 0)).toBe(total);
				expect(allocated.every((s) => Number.isSafeInteger(s.minor) && s.minor >= 0)).toBe(true);
				const reversed = shares({ ...input, splits: [...splits].reverse() });
				expect(Object.fromEntries(reversed.map((s) => [s.userId, s.minor]))).toEqual(
					Object.fromEntries(allocated.map((s) => [s.userId, s.minor])),
				);
				for (let i = 0; i < count; i++) {
					const denominator = splitType === "equal" ? count : 10000;
					const product = total * (splitType === "equal" ? 1 : weights[i]);
					expect(
						allocated[i].minor >= Math.floor(product / denominator) &&
							allocated[i].minor <= Math.ceil(product / denominator),
					).toBe(true);
					if (splitType === "percentage" && weights[i] === 0) expect(allocated[i].minor).toBe(0);
				}
			}
		}
	});
});
