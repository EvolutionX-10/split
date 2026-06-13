import { getGroupHome } from "@/lib/actions/groups";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import BalanceCard from "@/components/balance-card";
import ExpenseItem from "@/components/expense-item";

type Props = { params: Promise<{ id: string }> };

export default async function GroupPage({ params }: Props) {
	const { id } = await params;

	let data;
	try {
		data = await getGroupHome(id);
	} catch {
		notFound();
	}

	const { group, balances, expenses, currentUserId } = data;

	return (
		<div className="flex flex-col gap-6 px-4 py-4 pb-24">
			{/* Balances */}
			{balances.length > 0 && (
				<div className="flex flex-col gap-2">
					<p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">Balances</p>
					<div className="flex flex-col gap-2">
						{balances.map((b) => (
							<BalanceCard key={b.userId} balance={b} groupId={group.id} />
						))}
					</div>
				</div>
			)}

			{/* Expenses */}
			<div className="flex flex-col gap-2">
				<p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">Expenses</p>
				{expenses.length === 0 ? (
					<div className="flex flex-col items-center gap-3 py-16 text-center">
						<p className="font-medium">No expenses yet</p>
						<p className="text-muted-foreground text-sm">Tap + to add your first split!</p>
					</div>
				) : (
					<div className="flex flex-col gap-2">
						{expenses.map((e) => (
							<ExpenseItem key={e.id} expense={e} currentUserId={currentUserId} />
						))}
					</div>
				)}
			</div>

			{/* FAB */}
			<div className="fixed right-4 bottom-20">
				<Button
					size="lg"
					className="h-14 w-14 rounded-full shadow-lg"
					style={{ backgroundColor: group.accentColor }}
					asChild
				>
					<Link href={`/expenses/new?groupId=${group.id}`}>
						<Plus className="h-6 w-6" />
					</Link>
				</Button>
			</div>
		</div>
	);
}
