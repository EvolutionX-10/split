"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Check } from "lucide-react";
import { CATEGORIES, type CATEGORY_ICONS } from "@/lib/constants";
import { submitMutation } from "@/lib/offline/sync";
import { calculateSplits, type SplitType } from "@/lib/ledger/splits";
import { formatMoney } from "@/lib/ledger/money";
import PendingMutations from "./pending-mutations";

type Member = { id: string; name: string | null; image: string | null };
type Group = { id: string; name: string; accentColor: string };
type Props = { group: Group; members: Member[]; currentUserId: string };
type Category = keyof typeof CATEGORY_ICONS;

export default function AddExpenseForm({ group, members, currentUserId }: Props) {
	const router = useRouter();

	const [amount, setAmount] = useState("");
	const [description, setDescription] = useState("");
	const [category, setCategory] = useState<Category>("other");
	const [splitType, setSplitType] = useState<SplitType>("equal");
	const [paidBy, setPaidBy] = useState(currentUserId);
	const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 16));
	const [includedMembers, setIncludedMembers] = useState<string[]>(members.map((m) => m.id));
	const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
	const [percentages, setPercentages] = useState<Record<string, string>>({});
	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [savedOffline, setSavedOffline] = useState(false);
	const submittingRef = useRef(false);

	function resetForm() {
		setAmount("");
		setDescription("");
		setCategory("other");
		setSplitType("equal");
		setPaidBy(currentUserId);
		setExpenseDate(new Date().toISOString().slice(0, 16));
		setIncludedMembers(members.map((m) => m.id));
		setExactAmounts({});
		setPercentages({});
		setErrors({});
	}

	function toggleMember(id: string) {
		setIncludedMembers((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
	}

	function buildSplits() {
		return includedMembers.map((userId) => ({
			userId,
			...(splitType === "exact" ? { amount: exactAmounts[userId] || "0" } : {}),
			...(splitType === "percentage" ? { percentage: percentages[userId] || "0" } : {}),
		}));
	}
	const draftSplits = buildSplits();
	const allocation = calculateSplits({ amount, splitType, splits: draftSplits });
	const shareAmounts = new Map(allocation.ok ? allocation.shares.map((share) => [share.userId, share.amount]) : []);

	function validate() {
		const newErrors: Record<string, string> = {};

		if (!allocation.ok) newErrors[allocation.field] = allocation.message;

		if (!description.trim()) newErrors.description = "Required";

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	}

	async function handleSubmit() {
		if (submittingRef.current) return;
		if (!validate()) return;

		submittingRef.current = true;
		setLoading(true);

		const input = {
			groupId: group.id,
			amount,
			description,
			category,
			splitType,
			paidBy,
			expenseDate: new Date(expenseDate),
			splits: draftSplits,
		};

		try {
			await submitMutation(currentUserId, { type: "add_expense", payload: input });
			resetForm();
			if (!navigator.onLine) {
				setSavedOffline(true);
				return;
			}
			router.push(`/groups/${group.id}`);
		} catch {
			setErrors((e) => ({
				...e,
				submit: "Could not save this change on your device. Keep this screen open and retry.",
			}));
		} finally {
			setLoading(false);
			submittingRef.current = false;
		}
	}

	return (
		<div className="flex h-dvh flex-col">
			{/* Header */}
			<div className="border-border flex items-center gap-3 border-b px-4 pb-4">
				<button
					onClick={() => router.back()}
					className="hover:bg-muted flex h-9 w-9 items-center justify-center rounded-full"
				>
					<ArrowLeft className="h-5 w-5" />
				</button>
				<h1 className="font-semibold">Add Expense</h1>
			</div>

			<div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4 pb-24">
				{/* Amount */}
				<div className="flex flex-col items-center gap-1 py-4">
					<Label htmlFor="expense-amount" className="text-muted-foreground text-sm">
						Amount
					</Label>
					<div className="flex items-center gap-1">
						<span className="text-muted-foreground text-4xl font-light">₹</span>
						<input
							id="expense-amount"
							type="number"
							inputMode="decimal"
							placeholder="0.00"
							value={amount}
							onChange={(e) => {
								setAmount(e.target.value);
								if (errors.amount) setErrors((p) => ({ ...p, amount: "" }));
							}}
							className="w-48 border-none bg-transparent text-center text-5xl font-semibold outline-none"
						/>
					</div>
					{errors.amount && <p className="text-destructive mt-1 text-xs">{errors.amount}</p>}
				</div>

				{/* Description */}
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="expense-description">Description</Label>
					<Input
						id="expense-description"
						placeholder="What's this for?"
						value={description}
						onChange={(e) => {
							setDescription(e.target.value);
							if (errors.description) setErrors((p) => ({ ...p, description: "" }));
						}}
						maxLength={200}
						className={errors.description ? "border-destructive" : ""}
					/>
					{errors.description && <p className="text-destructive text-xs">{errors.description}</p>}
				</div>

				{/* Category */}
				<div className="flex flex-col gap-2">
					<Label>Category</Label>
					<div className="grid grid-cols-4 gap-2">
						{CATEGORIES.map((cat) => (
							<button
								key={cat.value}
								onClick={() => setCategory(cat.value as Category)}
								className={`flex flex-col items-center gap-1 rounded-xl border p-3 transition-colors ${
									category === cat.value ? "border-primary bg-primary/10" : "border-border bg-card"
								}`}
							>
								<span className="text-xl">{cat.icon}</span>
								<span className="text-xs">{cat.label}</span>
							</button>
						))}
					</div>
				</div>

				{/* Date */}
				<div className="flex flex-col gap-1.5">
					<Label>Date & Time</Label>
					<Input type="datetime-local" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
				</div>

				{/* Paid by */}
				<div className="flex flex-col gap-2">
					<Label>Paid by</Label>
					<div className="flex flex-wrap gap-2">
						{members.map((m) => (
							<button
								key={m.id}
								onClick={() => setPaidBy(m.id)}
								className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
									paidBy === m.id ? "border-primary bg-primary/10" : "border-border"
								}`}
							>
								<Avatar className="h-5 w-5">
									<AvatarImage src={m.image ?? ""} />
									<AvatarFallback className="text-xs">{m.name?.charAt(0)}</AvatarFallback>
								</Avatar>
								{m.id === currentUserId ? "You" : m.name}
							</button>
						))}
					</div>
				</div>

				{/* Split type */}
				<div className="flex flex-col gap-2">
					<Label>Split</Label>
					<div className="border-border flex overflow-hidden rounded-xl border">
						{(["equal", "percentage", "exact"] as SplitType[]).map((type) => (
							<button
								key={type}
								onClick={() => {
									setSplitType(type);
									if (errors.splits) setErrors((p) => ({ ...p, splits: "" }));
								}}
								className={`flex-1 py-2 text-sm font-medium capitalize transition-colors ${
									splitType === type ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
								}`}
							>
								{type}
							</button>
						))}
					</div>
				</div>

				{/* Members to include */}
				<div className="flex flex-col gap-2">
					<Label>Split between</Label>
					<div className="flex flex-col gap-2">
						{members.map((m) => (
							<div key={m.id} className="border-border bg-card flex items-center gap-3 rounded-xl border px-4 py-3">
								<button
									aria-label={`Include ${m.id === currentUserId ? "You" : m.name}`}
									aria-pressed={includedMembers.includes(m.id)}
									onClick={() => {
										toggleMember(m.id);
										if (errors.members) setErrors((p) => ({ ...p, members: "" }));
									}}
									className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
										includedMembers.includes(m.id) ? "bg-primary border-primary" : "border-muted-foreground"
									}`}
								>
									{includedMembers.includes(m.id) && <Check className="text-primary-foreground h-3 w-3" />}
								</button>

								<Avatar className="h-8 w-8 shrink-0">
									<AvatarImage src={m.image ?? ""} />
									<AvatarFallback>{m.name?.charAt(0)}</AvatarFallback>
								</Avatar>

								<div className="min-w-0 flex-1">
									<span className="block truncate text-sm font-medium">{m.id === currentUserId ? "You" : m.name}</span>
									{includedMembers.includes(m.id) && allocation.ok && (
										<output
											aria-label={`Share for ${m.id === currentUserId ? "You" : m.name}`}
											className="text-muted-foreground block text-sm tabular-nums"
										>
											₹{shareAmounts.get(m.id)}
										</output>
									)}
								</div>

								{includedMembers.includes(m.id) && splitType === "percentage" && (
									<div className="flex items-center gap-1">
										<input
											aria-label={`Percentage for ${m.id === currentUserId ? "You" : m.name}`}
											type="number"
											inputMode="decimal"
											placeholder="0"
											value={percentages[m.id] ?? ""}
											onChange={(e) => {
												setPercentages((p) => ({ ...p, [m.id]: e.target.value }));
												if (errors.splits) setErrors((p) => ({ ...p, splits: "" }));
											}}
											className="border-border w-16 border-b bg-transparent text-right text-sm outline-none"
										/>
										<span className="text-muted-foreground text-sm">%</span>
									</div>
								)}

								{includedMembers.includes(m.id) && splitType === "exact" && (
									<div className="flex items-center gap-1">
										<span className="text-muted-foreground text-sm">₹</span>
										<input
											aria-label={`Exact amount for ${m.id === currentUserId ? "You" : m.name}`}
											type="number"
											inputMode="decimal"
											placeholder="0.00"
											value={exactAmounts[m.id] ?? ""}
											onChange={(e) => {
												setExactAmounts((p) => ({ ...p, [m.id]: e.target.value }));
												if (errors.splits) setErrors((p) => ({ ...p, splits: "" }));
											}}
											className="border-border w-20 border-b bg-transparent text-right text-sm outline-none"
										/>
									</div>
								)}
							</div>
						))}
					</div>
					{errors.members && <p className="text-destructive text-xs">{errors.members}</p>}
					{errors.splits && <p className="text-destructive text-xs">{errors.splits}</p>}
					{!allocation.ok && allocation.remaining && (
						<p role="status" className="text-muted-foreground text-sm tabular-nums">
							{allocation.remaining.unit === "paise" ? "₹" : ""}
							{formatMoney(Math.abs(allocation.remaining.value))}
							{allocation.remaining.unit === "basisPoints" ? "%" : ""}
							{allocation.remaining.value > 0 ? " left to allocate" : " over allocated"}
						</p>
					)}
				</div>

				{errors.submit && <p className="text-destructive text-sm">{errors.submit}</p>}
				{savedOffline && <p role="status">Saved on this device. Reconnect to sync.</p>}
				<PendingMutations groupId={group.id} />
			</div>

			{/* Footer */}
			<div className="border-border bg-background absolute right-0 bottom-15 left-0 mx-auto max-w-md border-t px-4 py-4">
				<Button onClick={handleSubmit} disabled={loading} className="w-full" size="lg">
					{loading ? "Adding..." : "Add Expense"}
				</Button>
			</div>
		</div>
	);
}
