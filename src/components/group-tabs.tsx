"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = { groupId: string };

const tabs = [
	{ label: "Expenses", href: "" },
	{ label: "Members", href: "/members" },
	{ label: "Transactions", href: "/transactions" },
	{ label: "Analytics", href: "/analytics" },
];

export default function GroupTabs({ groupId }: Props) {
	const pathname = usePathname();
	const base = `/groups/${groupId}`;

	return (
		<div className="border-border flex scrollbar-none overflow-x-auto border-b">
			{tabs.map((tab) => {
				const href = `${base}${tab.href}`;
				const active = tab.href === "" ? pathname === base : pathname.startsWith(href);

				return (
					<Link
						key={tab.href}
						href={href}
						className={`shrink-0 border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
							active ? "border-primary text-foreground" : "text-muted-foreground border-transparent"
						}`}
					>
						{tab.label}
					</Link>
				);
			})}
		</div>
	);
}
