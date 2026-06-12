"use client";
import { SerwistProvider } from "@serwist/turbopack/react";

export default function PWAProvider({ children }: { children: React.ReactNode }) {
	return (
		<SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV !== "production"}>
			{children}
		</SerwistProvider>
	);
}
