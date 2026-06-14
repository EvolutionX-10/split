import { auth } from "@/auth";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema/app";
import { users } from "@/db/schema/auth";
import { eq, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import AddExpenseForm from "@/components/add-expense-form";

type Props = { searchParams: Promise<{ groupId?: string }> };

export default async function NewExpensePage({ searchParams }: Props) {
	await connection();
	const { groupId } = await searchParams;
	if (!groupId) redirect("/dashboard");

	const session = await auth();
	if (!session?.user?.id) redirect("/login");

	const [group, members] = await Promise.all([
		db
			.select()
			.from(groups)
			.where(eq(groups.id, groupId))
			.then((r) => r[0] ?? null),
		db
			.select({ id: users.id, name: users.name, image: users.image })
			.from(groupMembers)
			.innerJoin(users, eq(groupMembers.userId, users.id))
			.where(eq(groupMembers.groupId, groupId)),
	]);

	if (!group) notFound();

	const membership = members.find((m) => m.id === session.user!.id);
	if (!membership) notFound();

	return <AddExpenseForm group={group} members={members} currentUserId={session.user.id} />;
}
