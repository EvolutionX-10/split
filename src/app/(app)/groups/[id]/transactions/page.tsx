import { getGroupTransactionsAction } from "@/lib/actions/groups";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CATEGORY_ICONS } from "@/lib/constants";

type Props = { params: Promise<{ id: string }> };

export default async function TransactionsPage({ params }: Props) {
	const { id } = await params;

	let data;
	try {
		data = await getGroupTransactionsAction(id);
	} catch {
		notFound();
	}

	const { timeline, currentUserId } = data;

	if (timeline.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center px-6 py-24 text-center">
				<p className="font-medium">No activity yet</p>
				<p className="text-muted-foreground mt-1 text-sm">Expenses and settlements will appear here</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col px-4 py-4">
			<div className="relative flex flex-col gap-0">
				{timeline.map((item, index) => {
					const isMe = item.actorId === currentUserId;
					const actorLabel = isMe ? "You" : item.actorName;
					const date = new Intl.DateTimeFormat("en-IN", {
						day: "numeric",
						month: "short",
						year: "numeric",
						hour: "2-digit",
						minute: "2-digit",
					}).format(new Date(item.date));

					return (
						<div key={item.id} className="relative flex gap-3 pb-6">
							{/* Timeline line */}
							{index !== timeline.length - 1 && <div className="bg-border absolute top-9 bottom-0 left-4 w-px" />}

							{/* Icon / Avatar */}
							<div className="z-10 shrink-0">
								{item.type === "expense" ? (
									<div className="bg-muted flex h-9 w-9 items-center justify-center rounded-full text-base">
										{CATEGORY_ICONS[item.category!] ?? "💸"}
									</div>
								) : item.type === "settlement" ? (
									<div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-base">
										✅
									</div>
								) : (
									<Avatar className="h-9 w-9">
										<AvatarImage src={item.actorImage ?? ""} />
										<AvatarFallback>{item.actorName?.charAt(0)}</AvatarFallback>
									</Avatar>
								)}
							</div>

							{/* Content */}
							<div className="min-w-0 flex-1 pt-1">
								<p className="text-sm leading-snug font-medium">
									{item.type === "expense" && (
										<>
											{actorLabel} paid <span className="text-foreground">₹{item.amount?.toFixed(2)}</span> for{" "}
											{item.description}
										</>
									)}
									{item.type === "settlement" && (
										<>
											{actorLabel} settled <span className="text-emerald-500">₹{item.amount?.toFixed(2)}</span> with{" "}
											{item.toUserId === currentUserId ? "you" : item.toUserName}
										</>
									)}
									{item.type === "join" && <>{actorLabel} joined the group</>}
								</p>
								<p className="text-muted-foreground mt-0.5 text-xs">{date}</p>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
