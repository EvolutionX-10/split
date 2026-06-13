import Link from "next/link";
import { Users } from "lucide-react";

type Group = {
	id: string;
	name: string;
	accentColor: string;
	description: string | null;
	memberCount: number;
	balance: number;
};

export default function GroupCard({ group }: { group: Group }) {
	const isOwed = group.balance > 0;
	const isEven = group.balance === 0;
	const amount = Math.abs(group.balance).toFixed(2);

	return (
		<Link prefetch={true} href={`/groups/${group.id}`}>
			<div className="border-border bg-card flex items-center gap-4 rounded-2xl border p-4 transition-transform active:scale-[0.98]">
				{/* Accent dot / avatar */}
				<div
					className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-semibold text-white"
					style={{ backgroundColor: group.accentColor }}
				>
					{group.name.charAt(0).toUpperCase()}
				</div>

				{/* Info */}
				<div className="min-w-0 flex-1">
					<p className="text-foreground truncate font-medium">{group.name}</p>
					<div className="mt-0.5 flex items-center gap-1">
						<Users size={12} className="text-muted-foreground" />
						<span className="text-muted-foreground text-xs">{group.memberCount} members</span>
					</div>
				</div>

				{/* Balance */}
				<div className="shrink-0 text-right">
					{isEven ? (
						<p className="text-muted-foreground text-xs">Settled up</p>
					) : (
						<>
							<p className={`text-sm font-semibold ${isOwed ? "text-emerald-500" : "text-rose-500"}`}>
								{isOwed ? "+" : "-"}₹{amount}
							</p>
							<p className="text-muted-foreground text-xs">{isOwed ? "you're owed" : "you owe"}</p>
						</>
					)}
				</div>
			</div>
		</Link>
	);
}
