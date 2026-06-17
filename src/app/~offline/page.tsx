import { WifiOff } from "lucide-react";

export default function OfflinePage() {
	return (
		<main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
			<div className="bg-muted flex h-16 w-16 items-center justify-center rounded-2xl">
				<WifiOff className="text-muted-foreground h-7 w-7" />
			</div>
			<div>
				<p className="text-foreground font-medium">You're offline</p>
				<p className="text-muted-foreground mt-1 max-w-xs text-sm">
					This page hasn't loaded before, so it isn't available offline yet. It'll work normally once you're back
					online.
				</p>
			</div>
		</main>
	);
}
