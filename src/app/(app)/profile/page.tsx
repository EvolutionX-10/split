import { auth } from "@/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SignOutButton from "@/components/sign-out-button";
import Link from "next/link";

export default async function ProfilePage() {
	const session = await auth();
	const user = session!.user!;

	return (
		<div className="flex flex-col px-6 pb-6">
			<h1 className="mb-8 text-xl font-semibold">Profile</h1>

			<div className="flex items-center gap-4">
				<Avatar className="h-16 w-16">
					<AvatarImage src={user.image ?? ""} alt={user.name ?? "User"} />
					<AvatarFallback className="bg-indigo-600 text-lg">{user.name?.charAt(0) ?? "U"}</AvatarFallback>
				</Avatar>
				<div>
					<p className="font-medium">{user.name}</p>
					<p className="text-muted-foreground text-sm">{user.email}</p>
				</div>
			</div>

			<div className="mt-10">
				<Link href="/sync" className="mb-4 block underline">
					Review saved changes
				</Link>
				<p className="mb-4 text-sm">Pending changes stay on this device for your account when you sign out.</p>
				<SignOutButton />
			</div>
		</div>
	);
}
