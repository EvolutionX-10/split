import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly, StaleWhileRevalidate } from "serwist";
declare global {
	interface WorkerGlobalScope extends SerwistGlobalConfig {
		__SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
	}
}
declare const self: ServiceWorkerGlobalScope;
const PUBLIC_CACHE = "split-public-precache-v2";
const STATIC_CACHE = "split-static-v2";
const legacyCaches = new Set([
	"pages",
	"pages-rsc",
	"pages-rsc-prefetch",
	"next-data",
	"apis",
	"others",
	"cross-origin",
	"static-data-assets",
	"next-image",
	"static-image-assets",
	"google-fonts-webfonts",
	"google-fonts-stylesheets",
	"static-font-assets",
	"next-static-js-assets",
	"static-js-assets",
	"static-style-assets",
	"static-audio-assets",
	"static-video-assets",
]);
const publicPath = (path: string) =>
	path.startsWith("/_next/static/") || path.startsWith("/icons/") || path === "/~offline" || path === "/favicon.ico";
const serwist = new Serwist({
	precacheEntries: self.__SW_MANIFEST?.filter((entry) =>
		publicPath(new URL(typeof entry === "string" ? entry : entry.url, self.location.origin).pathname),
	),
	precacheOptions: { cacheName: PUBLIC_CACHE },
	skipWaiting: true,
	clientsClaim: true,
	navigationPreload: false,
	runtimeCaching: [
		{
			matcher: ({ url }) =>
				url.origin === self.location.origin &&
				(url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")),
			handler: new StaleWhileRevalidate({ cacheName: STATIC_CACHE }),
		},
		{ matcher: ({ url }) => url.origin === self.location.origin, handler: new NetworkOnly() },
	],
	fallbacks: { entries: [{ url: "/~offline", matcher: ({ request }) => request.destination === "document" }] },
});
serwist.addEventListeners();
// Remove the previous app's URL-keyed private HTML/RSC caches on upgrade.
self.addEventListener("activate", (event) =>
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => legacyCaches.has(key) || key.startsWith("serwist-precache-"))
						.map((key) => caches.delete(key)),
				),
			),
	),
);
