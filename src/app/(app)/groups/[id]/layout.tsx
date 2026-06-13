import { auth } from "@/auth";
import { db } from "@/db";
import { groups, groupMembers } from "@/db/schema/app";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import GroupHeader from "@/components/group-header";
import GroupTabs from "@/components/group-tabs";

type Props = {
	children: React.ReactNode;
	params: Promise<{ id: string }>;
};

export default async function GroupLayout({ children, params }: Props) {
	const { id } = await params;
	const session = await auth();
	if (!session?.user?.id) notFound();

	const group = await db
		.select()
		.from(groups)
		.where(eq(groups.id, id))
		.then((r) => r[0] ?? null);

	if (!group) notFound();

	const membership = await db
		.select()
		.from(groupMembers)
		.where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, session.user.id)))
		.then((r) => r[0] ?? null);

	if (!membership) notFound();

	return (
		<div className="flex h-full flex-col">
			<GroupHeader group={group} isOwner={membership.role === "owner"} />
			<GroupTabs groupId={id} />
			<div className="flex-1 overflow-y-auto">{children}</div>
		</div>
	);
}
