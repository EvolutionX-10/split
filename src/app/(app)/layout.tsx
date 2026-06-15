import { auth } from "@/auth";
import { redirect } from "next/navigation";
import BottomNav from "@/components/bottom-nav";
import { Suspense } from "react";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
	const session = await auth();
	if (!session) redirect("/login");

	return (
		<div className="relative mx-auto flex h-dvh max-w-md flex-col">
			<main className="flex-1 overflow-y-auto pb-16">
				<Suspense fallback={<div className="flex h-full items-center justify-center">Loading...</div>}>
					{children}
				</Suspense>
			</main>
			<BottomNav />
		</div>
	);
}
