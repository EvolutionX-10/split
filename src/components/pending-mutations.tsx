"use client";

import { useEffect, useState } from "react";
import { getPendingMutations } from "@/lib/offline/queue";
import { onQueueChange } from "@/lib/offline/sync";
import { CATEGORY_ICONS } from "@/lib/constants";
import { CloudUpload } from "lucide-react";
import type { QueuedMutation } from "@/lib/offline/db";

type Props = { groupId: string };

export default function PendingMutations({ groupId }: Props) {
	const [mutations, setMutations] = useState<QueuedMutation[]>([]);

	useEffect(() => {
		let mounted = true;
		async function load() {
			const all = await getPendingMutations(groupId);
			if (mounted) setMutations(all);
		}
		load();
		const unsub = onQueueChange(load);
		return () => {
			mounted = false;
			unsub();
		};
	}, [groupId]);

	if (mutations.length === 0) return null;

	return (
		<div className="flex flex-col gap-2">
			{mutations.map((m) => (
				<div
					key={m.id}
					className="flex items-center gap-3 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 px-4 py-3"
				>
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
						{m.type === "add_expense" ? (
							<span className="text-lg">{CATEGORY_ICONS[m.payload.category] ?? "💸"}</span>
						) : (
							<CloudUpload className="h-5 w-5 text-amber-500" />
						)}
					</div>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium">
							{m.type === "add_expense" ? m.payload.description : "Settlement"}
						</p>
						<p className="text-xs text-amber-500">
							{m.status === "syncing" ? "Syncing..." : m.status === "failed" ? "Failed, will retry" : "Waiting to sync"}
						</p>
					</div>
					<p className="text-sm font-semibold">₹{parseFloat(m.payload.amount).toFixed(2)}</p>
				</div>
			))}
		</div>
	);
}
