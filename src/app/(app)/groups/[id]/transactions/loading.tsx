import { Skeleton } from "@/components/ui/skeleton";

export default function TransactionsLoading() {
	return (
		<div className="flex flex-col px-4 py-4">
			<div className="flex flex-col gap-0">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="flex gap-3 pb-6">
						<Skeleton className="h-9 w-9 shrink-0 rounded-full" />
						<div className="flex flex-1 flex-col gap-1.5 pt-1">
							<Skeleton className="h-3.5 w-48" />
							<Skeleton className="h-3 w-24" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
