"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import { useEffect } from "react";

function useCacheOnNavigation() {
	useEffect(() => {
		if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

		const originalPushState = history.pushState.bind(history);
		const originalReplaceState = history.replaceState.bind(history);

		function cacheUrl(url: string | URL | null | undefined) {
			if (!url || !navigator.onLine) return;
			const href = typeof url === "string" ? url : url.toString();
			if (!href.startsWith("/") && !href.startsWith(window.location.origin)) return;

			navigator.serviceWorker.ready.then((reg) => {
				reg.active?.postMessage({ type: "CACHE_URL", url: href });
			});
		}

		history.pushState = (...args) => {
			originalPushState(...args);
			cacheUrl(args[2]);
		};

		history.replaceState = (...args) => {
			originalReplaceState(...args);
			cacheUrl(args[2]);
		};

		return () => {
			history.pushState = originalPushState;
			history.replaceState = originalReplaceState;
		};
	}, []);
}

export default function PWAProvider({ children }: { children: React.ReactNode }) {
	useCacheOnNavigation();

	return (
		<SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV !== "production"}>
			{children}
		</SerwistProvider>
	);
}
