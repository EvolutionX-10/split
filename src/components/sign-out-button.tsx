"use client";
import { Button } from "./ui/button";
import { useOfflineAccount } from "./offline-provider";
export default function SignOutButton() {
	const { logout } = useOfflineAccount();
	return (
		<Button variant="destructive" className="w-full" onClick={() => void logout()}>
			Sign out
		</Button>
	);
}
