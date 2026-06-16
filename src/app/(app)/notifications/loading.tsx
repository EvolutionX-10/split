import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
	return (
		<div className="flex flex-col px-4 pb-6">
			<Skeleton className="mb-6 h-7 w-36" />
			<div className="flex flex-col gap-2">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="border-border bg-card flex items-start gap-3 rounded-xl border px-4 py-3">
						<Skeleton className="h-9 w-9 shrink-0 rounded-full" />
						<div className="flex flex-1 flex-col gap-1.5">
							<Skeleton className="h-3.5 w-44" />
							<Skeleton className="h-3 w-20" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
