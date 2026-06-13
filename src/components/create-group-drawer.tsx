"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { createGroup } from "@/lib/actions/groups";

const ACCENT_COLORS = [
	"#6366f1", // indigo
	"#ec4899", // pink
	"#f97316", // orange
	"#10b981", // emerald
	"#3b82f6", // blue
	"#f59e0b", // amber
	"#8b5cf6", // violet
	"#14b8a6", // teal
];

export default function CreateGroupDrawer() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [accentColor, setAccentColor] = useState(ACCENT_COLORS[0]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit() {
		if (!name.trim()) return setError("Group name is required");
		setLoading(true);
		setError(null);
		try {
			const group = await createGroup({ name, description, accentColor });
			setOpen(false);
			router.push(`/groups/${group.id}`);
		} catch (e) {
			setError("Something went wrong. Try again.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<Drawer open={open} onOpenChange={setOpen}>
			<DrawerTrigger asChild>
				<Button size="sm">
					<Plus className="h-4 w-4" />
					New
				</Button>
			</DrawerTrigger>
			<DrawerContent className="px-6 pb-8">
				<DrawerHeader className="px-0">
					<DrawerTitle>Create a group</DrawerTitle>
				</DrawerHeader>

				<div className="flex flex-col gap-5">
					{/* Preview */}
					<div className="flex justify-center">
						<div
							className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white transition-colors"
							style={{ backgroundColor: accentColor }}
						>
							{name.charAt(0).toUpperCase() || "?"}
						</div>
					</div>

					{/* Name */}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="name">Group name</Label>
						<Input
							id="name"
							placeholder="Trip to Goa, Flat expenses..."
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={50}
						/>
					</div>

					{/* Description */}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="description">
							Description <span className="text-muted-foreground text-xs">(optional)</span>
						</Label>
						<Input
							id="description"
							placeholder="What's this group for?"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							maxLength={200}
						/>
					</div>

					{/* Accent color */}
					<div className="flex flex-col gap-2">
						<Label>Color</Label>
						<div className="flex flex-wrap gap-3">
							{ACCENT_COLORS.map((color) => (
								<button
									key={color}
									type="button"
									onClick={() => setAccentColor(color)}
									className="h-8 w-8 rounded-full transition-transform active:scale-90"
									style={{
										backgroundColor: color,
										outline: accentColor === color ? `3px solid ${color}` : "none",
										outlineOffset: "2px",
									}}
								/>
							))}
						</div>
					</div>

					{error && <p className="text-destructive text-sm">{error}</p>}

					<Button onClick={handleSubmit} disabled={loading} className="mt-2 w-full">
						{loading ? "Creating..." : "Create group"}
					</Button>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
