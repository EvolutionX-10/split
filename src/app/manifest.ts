import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Split",
		short_name: "Split",
		description: "Split expenses with friends",
		start_url: "/dashboard",
		display: "standalone",
		background_color: "#09090b",
		theme_color: "#09090b",
		orientation: "portrait",
		icons: [
			{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
			{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
			{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
		],
	};
}
