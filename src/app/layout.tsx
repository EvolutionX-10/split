import type { Metadata, Viewport } from "next";
import PWAProvider from "@/components/providers/serwist";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { Suspense } from "react";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const viewport: Viewport = {
	themeColor: "#09090b",
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
};

export const metadata: Metadata = {
	title: "Split",
	description: "Split expenses with friends",
	manifest: "/manifest.webmanifest",
	appleWebApp: {
		capable: true,
		statusBarStyle: "black-translucent",
		title: "Split",
	},
	icons: {
		apple: "/icons/icon-192.png",
	},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className={cn("dark font-sans", inter.variable)}>
			<body>
				<PWAProvider>
					<Suspense fallback={<div className="flex h-full items-center justify-center">Loading...</div>}>
						{children}
					</Suspense>
				</PWAProvider>
			</body>
		</html>
	);
}
