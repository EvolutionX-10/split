"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { flushSync } from "react-dom";
import { activeAccount, setActiveAccount } from "@/lib/offline/account";
import { initSyncListeners, onQueueChange, flushQueue } from "@/lib/offline/sync";
import { getPendingMutations } from "@/lib/offline/queue";
import type { QueuedMutation } from "@/lib/offline/db";

const AccountContext = createContext<{ ownerId: string; logout: () => Promise<void> } | null>(null);
export function useOfflineAccount() {
	const account = useContext(AccountContext);
	if (!account) throw new Error("Missing account context");
	return account;
}

export default function OfflineProvider({ ownerId, children }: { ownerId: string; children: React.ReactNode }) {
	const router = useRouter();
	const [ready, setReady] = useState(false);
	const [online, setOnline] = useState(true);
	const [items, setItems] = useState<QueuedMutation[]>([]);
	const [error, setError] = useState("");
	useEffect(() => {
		let alive = true;
		const changed = () => {
			if (activeAccount() !== ownerId) setReady(false);
		};
		const verify = async () => {
			setOnline(navigator.onLine);
			if (!navigator.onLine) {
				if (alive) setReady(activeAccount() === ownerId);
				return;
			}
			try {
				const response = await fetch("/api/offline/session", { cache: "no-store" });
				if (!response.ok) throw new Error("Session unavailable");
				const identity = await response.json();
				if (!alive) return;
				setActiveAccount(identity.userId);
				setReady(identity.userId === ownerId);
			} catch {
				if (alive) {
					setReady(activeAccount() === ownerId);
					setError("Could not verify your connection. Saved changes remain on this device.");
				}
			}
		};
		const visible = () => {
			if (document.visibilityState === "visible") void verify();
		};
		const blocked = () => setError("Close older Split tabs and reload to open saved changes.");
		const hide = () => flushSync(() => setReady(false));
		window.addEventListener("storage", changed);
		window.addEventListener("split-account-change", changed);
		window.addEventListener("online", verify);
		window.addEventListener("offline", verify);
		window.addEventListener("pageshow", verify);
		window.addEventListener("pagehide", hide);
		document.addEventListener("visibilitychange", visible);
		window.addEventListener("split-storage-blocked", blocked);
		void verify();
		return () => {
			alive = false;
			window.removeEventListener("storage", changed);
			window.removeEventListener("split-account-change", changed);
			window.removeEventListener("online", verify);
			window.removeEventListener("offline", verify);
			window.removeEventListener("pageshow", verify);
			window.removeEventListener("pagehide", hide);
			document.removeEventListener("visibilitychange", visible);
			window.removeEventListener("split-storage-blocked", blocked);
		};
	}, [ownerId]);
	useEffect(() => {
		if (!ready) return;
		let alive = true;
		const load = async () => {
			try {
				const rows = await getPendingMutations(ownerId);
				if (alive) setItems(rows);
			} catch {
				if (alive) setError("Saved changes could not be opened. Keep this device and retry.");
			}
		};
		void load();
		const unsub = onQueueChange((change) => {
			if (change.ownerId !== ownerId) return;
			void load();
			if (change.synced) router.refresh();
		});
		const cleanup = initSyncListeners(ownerId);
		return () => {
			alive = false;
			unsub();
			cleanup();
		};
	}, [ownerId, ready, router]);
	async function logout() {
		if (!navigator.onLine) {
			setError("Reconnect to sign out. Your pending changes stay on this device.");
			return;
		}
		setReady(false);
		try {
			setActiveAccount(null);
			await signOut({ redirect: false });
			const response = await fetch("/api/offline/session", { cache: "no-store" });
			if (!response.ok || (await response.json()).userId !== null) throw new Error("Sign-out was not confirmed");
			setActiveAccount(null);
			window.location.replace("/login");
		} catch {
			setError("Could not confirm sign-out. Reconnect and reopen your account.");
		}
	}
	if (!ready)
		return (
			<div className="p-6 text-center">
				{error && <p role="alert">{error}</p>}
				<p>Verify or reopen your account to continue.</p>
				<a href="/dashboard" className="underline">
					Reopen account
				</a>
				<p>Pending changes stay on this device for the account that saved them.</p>
			</div>
		);
	const syncing = items.filter((item) => item.status === "syncing").length;
	const attention = items.filter((item) => item.status === "failed" || item.status === "paused").length;
	return (
		<AccountContext.Provider value={{ ownerId, logout }}>
			{(!online || items.length > 0 || error) && (
				<div role="status" className="bg-indigo-950 p-3 text-center text-sm">
					{error ||
						(!online
							? `Offline · ${items.length} saved changes`
							: syncing
								? `Syncing ${syncing} changes`
								: attention
									? `${attention} changes need attention`
									: `${items.length} changes waiting to sync`)}
					{items.length > 0 && (
						<Link href="/sync" className="ml-2 underline">
							Review changes
						</Link>
					)}
					{online && items.some((item) => item.status === "pending") && (
						<button
							className="ml-2 underline"
							onClick={() =>
								void flushQueue(ownerId).catch(() =>
									setError("Sync could not start. Your saved changes remain on this device."),
								)
							}
						>
							Sync now
						</button>
					)}
				</div>
			)}
			{children}
		</AccountContext.Provider>
	);
}
