import { auth } from "@/auth";
import { redirect } from "next/navigation";
import BottomNav from "@/components/bottom-nav";
import { Suspense } from "react";
import { getUnreadCountCache } from "@/lib/cache/groups";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
	const session = await auth();
	if (!session?.user?.id) redirect("/login");

	const unreadCount = await getUnreadCountCache(session.user.id);

	return (
		<div className="relative mx-auto flex h-dvh max-w-md flex-col">
			<main className="flex-1 overflow-y-auto pb-16">
				<Suspense fallback={<div className="flex h-full items-center justify-center">Loading...</div>}>
					{children}
				</Suspense>
			</main>
			<BottomNav unreadCount={unreadCount} />
		</div>
	);
}
