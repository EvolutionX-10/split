"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, UserCircleIcon } from "lucide-react";

const items = [
	{ href: "/dashboard", label: "Groups", icon: Users },
	{ href: "/profile", label: "Profile", icon: UserCircleIcon },
];

export default function BottomNav() {
	const pathname = usePathname();

	return (
		<nav className="border-border bg-background fixed right-0 bottom-0 left-0 mx-auto flex h-16 max-w-md items-center justify-around border-t px-4">
			{items.map(({ href, label, icon: Icon }) => {
				const active = pathname === href || pathname.startsWith(href + "/");
				return (
					<Link
						prefetch={true}
						key={href}
						href={href}
						className="flex min-h-11 min-w-11 flex-col items-center justify-center gap-1"
					>
						<Icon size={22} className={active ? "text-indigo-400" : "text-zinc-500"} />
						<span className={`text-xs ${active ? "text-indigo-400" : "text-zinc-500"}`}>{label}</span>
					</Link>
				);
			})}
		</nav>
	);
}
