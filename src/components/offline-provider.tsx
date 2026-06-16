"use client";

import { useEffect, useState } from "react";
import { initSyncListeners, onQueueChange } from "@/lib/offline/sync";
import { getAllPendingCount } from "@/lib/offline/queue";
import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflineProvider({ children }: { children: React.ReactNode }) {
	const [isOnline, setIsOnline] = useState(true);
	const [pendingCount, setPendingCount] = useState(0);

	useEffect(() => {
		setIsOnline(navigator.onLine);
		initSyncListeners();

		const updateOnline = () => setIsOnline(navigator.onLine);
		window.addEventListener("online", updateOnline);
		window.addEventListener("offline", updateOnline);

		const refreshCount = async () => setPendingCount(await getAllPendingCount());
		refreshCount();
		const unsub = onQueueChange(refreshCount);

		return () => {
			window.removeEventListener("online", updateOnline);
			window.removeEventListener("offline", updateOnline);
			unsub();
		};
	}, []);

	const showBanner = !isOnline || pendingCount > 0;

	return (
		<>
			{showBanner && (
				<div className="fixed top-0 right-0 left-0 z-50 mx-auto max-w-md">
					<div
						className={`flex items-center justify-center gap-2 py-2 text-xs font-medium text-white ${
							!isOnline ? "bg-amber-600" : "bg-indigo-600"
						}`}
					>
						{!isOnline ? (
							<>
								<WifiOff className="h-3.5 w-3.5" />
								You're offline{pendingCount > 0 && ` · ${pendingCount} pending`}
							</>
						) : (
							<>
								<RefreshCw className="h-3.5 w-3.5 animate-spin" />
								Syncing {pendingCount} change{pendingCount !== 1 ? "s" : ""}...
							</>
						)}
					</div>
				</div>
			)}
			{children}
		</>
	);
}
