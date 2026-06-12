import { auth } from "@/auth";
import { redirect } from "next/navigation";
import BottomNav from "@/components/bottom-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
	const session = await auth();
	if (!session) redirect("/login");

	return (
		<div className="mx-auto flex h-dvh max-w-md flex-col">
			<main className="flex-1 overflow-y-auto pb-16">{children}</main>
			<BottomNav />
		</div>
	);
}
