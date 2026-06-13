import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Props = {
	balance: { userId: string; name: string; image: string | null; net: number };
	groupId: string;
};

export default function BalanceCard({ balance }: Props) {
	const isOwed = balance.net > 0;
	const amount = Math.abs(balance.net).toFixed(2);

	return (
		<div className="border-border bg-card flex items-center gap-3 rounded-xl border px-4 py-3">
			<Avatar className="h-9 w-9">
				<AvatarImage src={balance.image ?? ""} />
				<AvatarFallback className="text-sm">{balance.name.charAt(0)}</AvatarFallback>
			</Avatar>
			<div className="flex-1">
				<p className="text-sm font-medium">{balance.name}</p>
				<p className="text-muted-foreground text-xs">{isOwed ? "owes you" : "you owe"}</p>
			</div>
			<p className={`text-sm font-semibold ${isOwed ? "text-emerald-500" : "text-rose-500"}`}>
				{isOwed ? "+" : "-"}₹{amount}
			</p>
		</div>
	);
}
