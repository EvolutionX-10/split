import PendingMutations from "@/components/pending-mutations";
export default function SyncPage() {
	return (
		<div className="space-y-4 p-4">
			<h1 className="text-xl font-semibold">Saved changes</h1>
			<p>
				Changes stay on this device for your account until the server confirms them. Signing out preserves pending
				changes.
			</p>
			<PendingMutations />
		</div>
	);
}
