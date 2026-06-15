"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, BellIcon, User } from "lucide-react";

type Props = { unreadCount: number };

const items = [
	{ href: "/dashboard", label: "Groups", icon: Users },
	{ href: "/notifications", label: "Notifications", icon: BellIcon },
	{ href: "/profile", label: "Profile", icon: User },
];

export default function BottomNav({ unreadCount }: Props) {
	const pathname = usePathname();

	return (
		<nav className="border-border fixed right-0 bottom-0 left-0 mx-auto flex h-16 max-w-md items-center justify-around border-t bg-zinc-950 px-4">
			{items.map(({ href, label, icon: Icon }) => {
				const active = pathname === href || pathname.startsWith(href + "/");
				return (
					<Link
						prefetch={true}
						key={href}
						href={href}
						className="relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-1"
					>
						<div className="relative">
							<Icon size={22} className={active ? "text-indigo-400" : "text-zinc-500"} />
							{href === "/notifications" && unreadCount > 0 && (
								<span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
									{unreadCount > 9 ? "9+" : unreadCount}
								</span>
							)}
						</div>
						<span className={`text-xs ${active ? "text-indigo-400" : "text-zinc-500"}`}>{label}</span>
					</Link>
				);
			})}
		</nav>
	);
}
