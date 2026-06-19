import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { defaultCache } from "@serwist/turbopack/worker";
import { Serwist } from "serwist";

declare global {
	interface WorkerGlobalScope extends SerwistGlobalConfig {
		__SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
	}
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
	precacheEntries: self.__SW_MANIFEST,
	skipWaiting: true,
	clientsClaim: true,
	navigationPreload: true,
	runtimeCaching: defaultCache,
	fallbacks: {
		entries: [
			{
				url: "/~offline",
				matcher({ request }) {
					return request.destination === "document";
				},
			},
		],
	},
});

serwist.addEventListeners();

// Handle cache-on-navigation messages
self.addEventListener("message", (event) => {
	if (event.data?.type !== "CACHE_URL") return;
	const url: string = event.data.url;

	event.waitUntil(
		caches.open("pages").then((cache) =>
			fetch(url)
				.then((res) => {
					if (res.ok) cache.put(url, res);
				})
				.catch(() => {}),
		),
	);
});
