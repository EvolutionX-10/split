import { getGroups } from "@/lib/actions/groups";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import GroupCard from "@/components/group-card";
import CreateGroupDrawer from "@/components/create-group-drawer";

export default async function DashboardPage() {
	const groups = await getGroups();

	return (
		<div className="flex flex-col px-4 pb-6">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-xl font-semibold">Your Groups</h1>
				{groups.length > 0 && <CreateGroupDrawer />}
			</div>

			{groups.length === 0 ? (
				<EmptyState />
			) : (
				<div className="flex flex-col gap-3">
					{groups.map((group) => (
						<GroupCard key={group.id} group={group} />
					))}
				</div>
			)}
		</div>
	);
}

function EmptyState() {
	return (
		<div className="mt-24 flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
			<div className="bg-muted flex h-16 w-16 items-center justify-center rounded-2xl">
				<Plus size={28} className="text-muted-foreground" />
			</div>
			<div>
				<p className="text-foreground font-medium">No groups yet</p>
				<p className="text-muted-foreground mt-1 text-sm">Create a group and invite friends to start splitting</p>
			</div>
			<CreateGroupDrawer />
		</div>
	);
}
