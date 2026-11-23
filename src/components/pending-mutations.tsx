"use client";
import { useEffect, useState } from "react";
import { useOfflineAccount } from "./offline-provider";
import { getPendingMutations, hasLegacyChanges, removeMutation, updateMutationStatus } from "@/lib/offline/queue";
import { flushQueue, onQueueChange } from "@/lib/offline/sync";
import type { QueuedMutation } from "@/lib/offline/db";

const messages: Record<string, string> = {
	session: "Sign in again to send this change.",
	account: "Sign in to the account that saved this change.",
	membership: "Group membership changed. Review access before retrying.",
	conflict: "This request ID already saved different content. Review before discarding.",
	invalid: "This change needs review and cannot be sent in its current form.",
	server: "Could not save on the server. Retry when the service is available.",
	network: "Waiting for a connection.",
};
export default function PendingMutations({ groupId }: { groupId?: string }) {
	const { ownerId } = useOfflineAccount();
	const [items, setItems] = useState<QueuedMutation[]>([]);
	const [legacy, setLegacy] = useState(false);
	const [error, setError] = useState("");
	useEffect(() => {
		let alive = true;
		const load = async () => {
			try {
				const rows = await getPendingMutations(ownerId, groupId);
				const old = await hasLegacyChanges();
				if (alive) {
					setItems(rows);
					setLegacy(old);
				}
			} catch {
				if (alive) setError("Saved changes could not be opened. Keep this device and retry.");
			}
		};
		void load();
		const unsub = onQueueChange((change) => {
			if (change.ownerId === ownerId) void load();
		});
		return () => {
			alive = false;
			unsub();
		};
	}, [ownerId, groupId]);
	async function retry(id: string) {
		try {
			await updateMutationStatus(ownerId, id, "pending");
			await flushQueue(ownerId);
		} catch {
			setError("Retry could not start. Your saved change is still on this device.");
		}
	}
	async function discard(id: string) {
		if (
			!confirm(
				"Discard this saved change from this device? A change already acknowledged by the server will remain in the ledger.",
			)
		)
			return;
		try {
			await removeMutation(ownerId, id);
		} catch {
			setError("Could not discard this change. Try again.");
		}
	}
	return (
		<div className="flex flex-col gap-3">
			{error && <p role="alert">{error}</p>}
			{legacy && !groupId && (
				<p>
					Older unsynced changes are held for manual recovery. They have not been assigned to this account or sent
					automatically.
				</p>
			)}
			{!groupId && items.length === 0 && <p>No pending changes for this account.</p>}
			{items.map((item) => (
				<div key={item.id} className="rounded-xl border border-dashed border-amber-500/40 p-4">
					<p className="font-medium break-words">
						{item.type === "add_expense" ? item.payload.description : "Settlement"} · ₹{item.payload.amount}
					</p>
					<p className="text-sm" role="status">
						{item.status === "syncing"
							? "Syncing…"
							: item.status === "failed"
								? "Needs attention"
								: item.status === "paused"
									? "Paused"
									: "Waiting to sync"}
					</p>
					{item.error && <p className="text-sm">{messages[item.error] || "Review this saved change."}</p>}
					{item.status !== "syncing" && (
						<div className="mt-2 flex gap-4">
							<button onClick={() => void retry(item.id)} className="underline">
								Retry
							</button>
							<button onClick={() => void discard(item.id)} className="underline">
								Discard
							</button>
						</div>
					)}
				</div>
			))}
		</div>
	);
}
