"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getUserGroupsAction } from "@/lib/actions/groups";

const STATIC_ROUTES = ["/dashboard", "/profile", "/notifications"];

export default function CacheWarmer() {
	const router = useRouter();
	const hasWarmed = useRef(false);

	useEffect(() => {
		if (hasWarmed.current || !navigator.onLine) return;
		hasWarmed.current = true;

		async function warm() {
			STATIC_ROUTES.forEach((route) => router.prefetch(route));

			try {
				const groups = await getUserGroupsAction();
				for (const g of groups) {
					router.prefetch(`/groups/${g.id}`);
					router.prefetch(`/groups/${g.id}/members`);
					router.prefetch(`/groups/${g.id}/transactions`);
					router.prefetch(`/groups/${g.id}/analytics`);
					router.prefetch(`/expenses/new?groupId=${g.id}`);
				}
			} catch {
				// best-effort, ignore failures
			}
		}

		const idle = "requestIdleCallback" in window ? window.requestIdleCallback : (cb: () => void) => setTimeout(cb, 300);

		idle(warm);
	}, [router]);

	return null;
}
