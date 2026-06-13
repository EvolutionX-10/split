import { getGroupMembersAction } from "@/lib/actions/groups";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown } from "lucide-react";

type Props = { params: Promise<{ id: string }> };

export default async function MembersPage({ params }: Props) {
	const { id } = await params;

	let data = await Promise.try(() => getGroupMembersAction(id)).catch(() => notFound());

	// TODO: remove member functionality for owners
	const { members, currentUserId, isOwner: _ } = data;

	return (
		<div className="flex flex-col gap-4 px-4 py-4">
			<p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
				{members.length} member{members.length !== 1 ? "s" : ""}
			</p>

			<div className="flex flex-col gap-2">
				{members.map((member) => {
					const isMe = member.id === currentUserId;
					const isOwnerMember = member.role === "owner";

					return (
						<div key={member.id} className="border-border bg-card flex items-center gap-3 rounded-xl border px-4 py-3">
							<Avatar className="h-10 w-10">
								<AvatarImage src={member.image ?? ""} />
								<AvatarFallback>{member.name?.charAt(0) ?? "?"}</AvatarFallback>
							</Avatar>

							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-1.5">
									<p className="truncate text-sm font-medium">
										{member.name}
										{isMe ? " (you)" : ""}
									</p>
									{isOwnerMember && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
								</div>
								<p className="text-muted-foreground text-xs">
									Joined{" "}
									{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(
										member.joinedAt,
									)}
								</p>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
