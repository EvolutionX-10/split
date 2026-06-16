import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
	return (
		<div className="flex flex-col gap-6 px-4 py-4 pb-24">
			<Skeleton className="h-10 w-full rounded-xl" />

			<div className="grid grid-cols-3 gap-3">
				{[1, 2, 3].map((i) => (
					<div key={i} className="border-border bg-card flex flex-col gap-2 rounded-xl border px-3 py-3">
						<Skeleton className="h-3 w-16" />
						<Skeleton className="h-5 w-12" />
					</div>
				))}
			</div>

			<div className="flex flex-col gap-3">
				<Skeleton className="h-4 w-36" />
				<Skeleton className="h-55 w-full rounded-xl" />
			</div>

			<div className="flex flex-col gap-3">
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-45 w-full rounded-xl" />
			</div>
		</div>
	);
}
