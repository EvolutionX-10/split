import { Skeleton } from "@/components/ui/skeleton";

export default function GroupLoading() {
	return (
		<div className="flex flex-col gap-6 px-4 py-4 pb-24">
			{/* Balances */}
			<div className="flex flex-col gap-2">
				<Skeleton className="h-3 w-20" />
				<div className="flex flex-col gap-2">
					{[1, 2].map((i) => (
						<div key={i} className="border-border bg-card flex items-center gap-3 rounded-xl border px-4 py-3">
							<Skeleton className="h-9 w-9 shrink-0 rounded-full" />
							<div className="flex flex-1 flex-col gap-1.5">
								<Skeleton className="h-3.5 w-24" />
								<Skeleton className="h-3 w-16" />
							</div>
							<Skeleton className="h-4 w-16" />
						</div>
					))}
				</div>
			</div>

			{/* Expenses */}
			<div className="flex flex-col gap-2">
				<Skeleton className="h-3 w-20" />
				<div className="flex flex-col gap-2">
					{[1, 2, 3].map((i) => (
						<div key={i} className="border-border bg-card flex items-center gap-3 rounded-xl border px-4 py-3">
							<Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
							<div className="flex flex-1 flex-col gap-1.5">
								<Skeleton className="h-3.5 w-28" />
								<Skeleton className="h-3 w-20" />
							</div>
							<Skeleton className="h-4 w-12" />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
