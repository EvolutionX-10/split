"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, MoreVertical } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import InviteSheet from "./invite-sheet";

type Group = {
	id: string;
	name: string;
	accentColor: string;
	description: string | null;
	inviteToken: string;
};

type Props = { group: Group; isOwner: boolean };

export default function GroupHeader({ group, isOwner }: Props) {
	const router = useRouter();

	return (
		<div className="flex items-center gap-3 px-4 pt-4 pb-4" style={{ backgroundColor: group.accentColor + "10" }}>
			<button
				onClick={() => router.push("/dashboard")}
				className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-black/10"
			>
				<ArrowLeft className="h-5 w-5" />
			</button>

			<div className="flex min-w-0 flex-1 items-center gap-3">
				<div
					className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-white"
					style={{ backgroundColor: group.accentColor }}
				>
					{group.name.charAt(0).toUpperCase()}
				</div>
				<div className="min-w-0">
					<h1 className="truncate font-semibold">{group.name}</h1>
					{group.description && <p className="text-muted-foreground truncate text-xs">{group.description}</p>}
				</div>
			</div>

			<div className="flex shrink-0 items-center gap-1">
				<InviteSheet
					groupId={group.id}
					groupName={group.name}
					accentColor={group.accentColor}
					inviteToken={group.inviteToken}
				/>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/10">
							<MoreVertical className="h-5 w-5" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{isOwner && (
							<DropdownMenuItem onClick={() => router.push(`/groups/${group.id}/settings`)}>Settings</DropdownMenuItem>
						)}
						<DropdownMenuItem className="text-destructive" onClick={() => router.push(`/groups/${group.id}/leave`)}>
							Leave group
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
