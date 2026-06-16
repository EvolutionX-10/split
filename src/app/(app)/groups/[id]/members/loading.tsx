import { Skeleton } from "@/components/ui/skeleton";

export default function MembersLoading() {
	return (
		<div className="flex flex-col gap-4 px-4 py-4">
			<Skeleton className="h-3 w-20" />
			<div className="flex flex-col gap-2">
				{[1, 2, 3].map((i) => (
					<div key={i} className="border-border bg-card flex items-center gap-3 rounded-xl border px-4 py-3">
						<Skeleton className="h-10 w-10 shrink-0 rounded-full" />
						<div className="flex flex-1 flex-col gap-1.5">
							<Skeleton className="h-3.5 w-32" />
							<Skeleton className="h-3 w-24" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
