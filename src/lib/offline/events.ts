type Change = { ownerId: string; synced?: boolean };
const listeners = new Set<(change: Change) => void>();
function emit(change: Change) {
	for (const fn of listeners) {
		try {
			void Promise.resolve(fn(change)).catch(() => {});
		} catch {
			/* Observers must not turn a committed write into a failed save. */
		}
	}
}
let channel: BroadcastChannel | undefined;
function listen() {
	if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined" && !channel) {
		try {
			channel = new BroadcastChannel("split-queue-v2");
		} catch {
			return;
		}
		channel.onmessage = (event) => {
			if (typeof event.data?.ownerId === "string") emit(event.data);
		};
	}
}
export function onQueueChange(fn: (change: Change) => void) {
	listen();
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}
export function notifyQueue(change: Change) {
	listen();
	emit(change);
	try {
		channel?.postMessage(change);
	} catch {
		/* Local storage remains authoritative. */
	}
}
