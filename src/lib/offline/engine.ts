import type { ReplayResult } from "./protocol";
import { getPendingMutations, removeMutation, updateMutationStatus } from "./queue";
import type { QueuedMutation } from "./db";

export async function replayOwnedQueue(
	ownerId: string,
	options: {
		activeOwner: () => string | null;
		online: () => boolean;
		send: (mutation: QueuedMutation) => Promise<ReplayResult>;
	},
) {
	for (const item of await getPendingMutations(ownerId)) {
		if (!options.online() || options.activeOwner() !== ownerId) break;
		if (item.status === "failed") continue;
		await updateMutationStatus(ownerId, item.id, "syncing");
		try {
			const result = await options.send(item);
			if (options.activeOwner() !== ownerId) break;
			if (result.status === "synced") await removeMutation(ownerId, item.id, true);
			else {
				const paused = result.reason === "session" || result.reason === "account";
				await updateMutationStatus(ownerId, item.id, paused ? "paused" : "failed", result.reason);
				if (paused) break;
			}
		} catch {
			await updateMutationStatus(ownerId, item.id, "pending", "network");
			break;
		}
	}
}
