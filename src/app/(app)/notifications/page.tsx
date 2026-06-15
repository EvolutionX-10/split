import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getNotificationsCache } from "@/lib/cache/groups";
import { markAllRead } from "@/lib/actions/notifications";
import { Button } from "@/components/ui/button";
import { Bell, Users, HandCoins, Clock } from "lucide-react";
import Link from "next/link";

const TYPE_ICONS: Record<string, React.ReactNode> = {
	member_joined: <Users className="h-5 w-5 text-indigo-400" />,
	expense_added: <HandCoins className="h-5 w-5 text-emerald-400" />,
	settlement_done: <HandCoins className="h-5 w-5 text-emerald-400" />,
	settlement_requested: <Clock className="h-5 w-5 text-amber-400" />,
	reminder: <Clock className="h-5 w-5 text-rose-400" />,
};

export default async function NotificationsPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/login");

	const notifs = await getNotificationsCache(session.user.id);
	const hasUnread = notifs.some((n) => !n.isRead);

	return (
		<div className="flex flex-col px-4 pt-10 pb-6">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-xl font-semibold">Notifications</h1>
				{hasUnread && (
					<form action={markAllRead}>
						<Button variant="ghost" size="sm" type="submit">
							Mark all read
						</Button>
					</form>
				)}
			</div>

			{notifs.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
					<div className="bg-muted flex h-14 w-14 items-center justify-center rounded-2xl">
						<Bell className="text-muted-foreground h-7 w-7" />
					</div>
					<p className="font-medium">No notifications yet</p>
					<p className="text-muted-foreground text-sm">You'll be notified when someone joins or reminds you</p>
				</div>
			) : (
				<div className="flex flex-col gap-2">
					{notifs.map((n) => {
						const date = new Intl.DateTimeFormat("en-IN", {
							day: "numeric",
							month: "short",
							hour: "2-digit",
							minute: "2-digit",
						}).format(new Date(n.createdAt));

						const content = (
							<div
								className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
									n.isRead ? "border-border bg-card" : "border-indigo-500/30 bg-indigo-500/5"
								}`}
							>
								<div className="bg-muted mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
									{TYPE_ICONS[n.type] ?? <Bell className="h-5 w-5" />}
								</div>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-medium">{n.message}</p>
									<p className="text-muted-foreground mt-0.5 text-xs">{date}</p>
								</div>
								{!n.isRead && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />}
							</div>
						);

						return n.groupId ? (
							<Link key={n.id} href={`/groups/${n.groupId}`}>
								{content}
							</Link>
						) : (
							<div key={n.id}>{content}</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
