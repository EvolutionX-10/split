"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { settleUp } from "@/lib/actions/settlements";
import { useRouter } from "next/navigation";

type Props = {
	balance: { userId: string; name: string; image: string | null; net: number };
	groupId: string;
	currentUserId: string;
};

export default function BalanceCard({ balance, groupId, currentUserId }: Props) {
	const router = useRouter();
	const isOwed = balance.net > 0;
	const amount = Math.abs(balance.net).toFixed(2);

	const [open, setOpen] = useState(false);
	const [settleAmount, setSettleAmount] = useState(amount);
	const [note, setNote] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	async function handleSettle() {
		if (!settleAmount || parseFloat(settleAmount) <= 0) return setError("Enter a valid amount");

		setLoading(true);
		setError("");
		try {
			await settleUp({
				groupId,
				fromUserId: currentUserId,
				toUserId: balance.userId,
				amount: settleAmount,
				note,
			});
			setOpen(false);
			router.refresh();
		} catch {
			setError("Something went wrong. Try again.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<>
			<button
				onClick={() => setOpen(true)}
				className="border-border bg-card flex w-full items-center gap-3 rounded-xl border px-4 py-3 transition-transform active:scale-[0.98]"
			>
				<Avatar className="h-9 w-9">
					<AvatarImage src={balance.image ?? ""} />
					<AvatarFallback className="text-sm">{balance.name.charAt(0)}</AvatarFallback>
				</Avatar>
				<div className="flex-1 text-left">
					<p className="text-sm font-medium">{balance.name}</p>
					<p className="text-muted-foreground text-xs">{isOwed ? "owes you" : "you owe"} · tap to settle</p>
				</div>
				<p className={`text-sm font-semibold ${isOwed ? "text-emerald-500" : "text-rose-500"}`}>
					{isOwed ? "+" : "-"}₹{amount}
				</p>
			</button>

			<Drawer open={open} onOpenChange={setOpen}>
				<DrawerContent className="px-6 pb-10">
					<DrawerHeader className="px-0">
						<DrawerTitle>{isOwed ? `${balance.name} owes you` : `You owe ${balance.name}`}</DrawerTitle>
					</DrawerHeader>

					<div className="flex flex-col gap-5">
						{/* Avatar + net */}
						<div className="bg-muted flex items-center gap-3 rounded-xl px-4 py-3">
							<Avatar className="h-10 w-10">
								<AvatarImage src={balance.image ?? ""} />
								<AvatarFallback>{balance.name.charAt(0)}</AvatarFallback>
							</Avatar>
							<div>
								<p className="text-sm font-medium">{balance.name}</p>
								<p className={`text-sm font-semibold ${isOwed ? "text-emerald-500" : "text-rose-500"}`}>
									{isOwed ? `owes you ₹${amount}` : `you owe ₹${amount}`}
								</p>
							</div>
						</div>

						{isOwed ? (
							// They owe me — options: remind or mark settled
							<div className="flex flex-col gap-3">
								<p className="text-muted-foreground text-sm">
									You can remind {balance.name} to pay you back, or mark it as settled if they already paid.
								</p>
								<div className="flex gap-3">
									<Button
										variant="outline"
										className="flex-1"
										onClick={() => {
											// remind — placeholder for notification later
											setOpen(false);
										}}
									>
										Remind
									</Button>
									<Button
										className="flex-1"
										onClick={async () => {
											setLoading(true);
											try {
												await settleUp({
													groupId,
													fromUserId: balance.userId,
													toUserId: currentUserId, // they pay me
													amount,
													note,
												});
												setOpen(false);
												router.refresh();
											} catch {
												setError("Something went wrong.");
											} finally {
												setLoading(false);
											}
										}}
										disabled={loading}
									>
										Mark settled
									</Button>
								</div>
							</div>
						) : (
							// I owe them — settle up
							<div className="flex flex-col gap-4">
								<div className="flex flex-col gap-1.5">
									<Label>Amount</Label>
									<div className="flex items-center gap-2">
										<span className="text-muted-foreground">₹</span>
										<Input
											type="number"
											inputMode="decimal"
											value={settleAmount}
											onChange={(e) => {
												setSettleAmount(e.target.value);
												setError("");
											}}
										/>
									</div>
									{error && <p className="text-destructive text-xs">{error}</p>}
								</div>

								<div className="flex flex-col gap-1.5">
									<Label>
										Note <span className="text-muted-foreground text-xs">(optional)</span>
									</Label>
									<Input
										placeholder="e.g. Paid via UPI"
										value={note}
										onChange={(e) => setNote(e.target.value)}
										maxLength={200}
									/>
								</div>

								<Button onClick={handleSettle} disabled={loading} className="w-full">
									{loading ? "Settling..." : `Pay ₹${settleAmount}`}
								</Button>
							</div>
						)}
					</div>
				</DrawerContent>
			</Drawer>
		</>
	);
}
