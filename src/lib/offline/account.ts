export const ACCOUNT_KEY = "split-active-account-v2";
export function activeAccount() {
	try {
		return localStorage.getItem(ACCOUNT_KEY);
	} catch {
		return null;
	}
}
export function setActiveAccount(ownerId: string | null) {
	if (ownerId) localStorage.setItem(ACCOUNT_KEY, ownerId);
	else localStorage.removeItem(ACCOUNT_KEY);
	window.dispatchEvent(new Event("split-account-change"));
}
