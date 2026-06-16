export function isLikelyNetworkError(err: unknown) {
	if (typeof navigator !== "undefined" && !navigator.onLine) return true;
	if (!(err instanceof Error)) return false;
	return /fetch|network|failed to fetch/i.test(err.message);
}
