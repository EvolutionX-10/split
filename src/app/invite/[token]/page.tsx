import { auth, signIn } from "@/auth";
import { getInviteDetails, acceptInvite } from "@/lib/actions/invite";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import GoogleIcon from "@/components/icons/google";

type Props = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: Props) {
	const { token } = await params;
	const session = await auth();
	const group = await getInviteDetails(token);

	if (!group) {
		return (
			<main className="flex min-h-screen items-center justify-center px-6">
				<div className="text-center">
					<p className="text-lg font-semibold">Invalid invite</p>
					<p className="text-muted-foreground mt-1 text-sm">This link is invalid or has expired.</p>
				</div>
			</main>
		);
	}

	// Already a member
	if (group.isMember) {
		redirect(`/groups/${group.id}`);
	}

	return (
		<main className="flex min-h-screen flex-col items-center justify-center px-6">
			<div className="flex w-full max-w-sm flex-col items-center gap-6">
				{/* Group avatar */}
				<div
					className="flex h-20 w-20 items-center justify-center rounded-3xl text-3xl font-bold text-white"
					style={{ backgroundColor: group.accentColor }}
				>
					{group.name.charAt(0).toUpperCase()}
				</div>

				<div className="text-center">
					<p className="text-muted-foreground mb-1 text-xs tracking-widest uppercase">You're invited to</p>
					<h1 className="text-2xl font-bold">{group.name}</h1>
					{group.description && <p className="text-muted-foreground mt-1 text-sm">{group.description}</p>}
					<div className="mt-3 flex items-center justify-center gap-1">
						<Users className="text-muted-foreground h-4 w-4" />
						<span className="text-muted-foreground text-sm">{group.memberCount} members</span>
					</div>
				</div>

				{session ? (
					<form
						action={async () => {
							"use server";
							await acceptInvite(token);
							redirect(`/groups/${group.id}`);
						}}
					>
						<Button className="w-full" size="lg" type="submit">
							Accept invite
						</Button>
					</form>
				) : (
					<div className="flex w-full flex-col items-center gap-3">
						<p className="text-muted-foreground text-sm">Sign in first to accept this invite</p>
						<form
							action={async () => {
								"use server";
								await signIn("google", { redirectTo: `/invite/${token}` });
							}}
						>
							<Button className="w-full" size="lg" type="submit">
								<GoogleIcon />
								Sign in with Google
							</Button>
						</form>
					</div>
				)}
			</div>
		</main>
	);
}
