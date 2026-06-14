// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CATEGORY_ICONS } from "@/lib/constants";

type Expense = {
	id: string;
	description: string;
	amount: string;
	category: keyof typeof CATEGORY_ICONS;
	expenseDate: Date;
	paidById: string;
	paidByName: string | null;
	paidByImage: string | null;
};

type Props = { expense: Expense; currentUserId: string };

export default function ExpenseItem({ expense, currentUserId }: Props) {
	const isMe = expense.paidById === currentUserId;
	const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(expense.expenseDate);

	return (
		<div className="border-border bg-card flex items-center gap-3 rounded-xl border px-4 py-3">
			<div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg">
				{CATEGORY_ICONS[expense.category]}
			</div>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium">{expense.description}</p>
				<p className="text-muted-foreground text-xs">
					{isMe ? "You" : expense.paidByName} paid · {date}
				</p>
			</div>
			<p className="text-sm font-semibold">₹{parseFloat(expense.amount).toFixed(2)}</p>
		</div>
	);
}
