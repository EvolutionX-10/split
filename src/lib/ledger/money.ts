export const MAX_MONEY_MINOR = 9_999_999_999;

function hundredths(value: string) {
	const [whole, fraction = ""] = value.split(".");
	return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

// Parse decimal text directly; multiplying a binary float by 100 can lose a paise.
export function parseMoney(value: string): number | null {
	return /^\d{1,8}(\.\d{1,2})?$/.test(value) ? hundredths(value) : null;
}

export function parsePercentage(value: string): number | null {
	if (!/^\d{1,3}(\.\d{1,2})?$/.test(value)) return null;
	const basisPoints = hundredths(value);
	return basisPoints <= 10_000 ? basisPoints : null;
}

// Also supports signed differences and bounded sums when showing allocation feedback.
export function formatMoney(minor: number) {
	if (!Number.isSafeInteger(minor)) throw new Error("Money must be a safe integer in minor units");
	const absolute = Math.abs(minor);
	return `${minor < 0 ? "-" : ""}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}
