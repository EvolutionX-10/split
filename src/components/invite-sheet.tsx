"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import QRCode from "react-qr-code";

type Props = {
	groupId: string;
	groupName: string;
	accentColor: string;
	inviteToken: string;
};

export default function InviteSheet({ groupId, groupName, accentColor, inviteToken }: Props) {
	const [copied, setCopied] = useState(false);
	const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${inviteToken}`;

	async function handleCopy() {
		await navigator.clipboard.writeText(inviteUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	async function handleShare() {
		if (navigator.share) {
			await navigator.share({
				title: `Join ${groupName} on Split`,
				text: `You've been invited to join ${groupName}. Click to accept:`,
				url: inviteUrl,
			});
		} else {
			handleCopy();
		}
	}

	return (
		<Drawer>
			<DrawerTrigger asChild>
				<Button variant="outline" size="sm">
					<Share2 className="h-4 w-4" />
					Invite
				</Button>
			</DrawerTrigger>
			<DrawerContent className="px-6 pb-10">
				<DrawerHeader className="px-0">
					<DrawerTitle>Invite to {groupName}</DrawerTitle>
				</DrawerHeader>

				<div className="flex flex-col items-center gap-6">
					{/* QR Code */}
					<div className="rounded-2xl bg-white p-4">
						<QRCode value={inviteUrl} size={180} fgColor={accentColor} />
					</div>

					{/* URL pill */}
					<div className="border-border bg-muted flex w-full items-center gap-2 rounded-xl border px-4 py-3">
						<p className="text-muted-foreground flex-1 truncate text-sm">{inviteUrl}</p>
						<button onClick={handleCopy} className="shrink-0">
							{copied ? (
								<Check className="h-4 w-4 text-emerald-500" />
							) : (
								<Copy className="text-muted-foreground h-4 w-4" />
							)}
						</button>
					</div>

					{/* Actions */}
					<div className="flex w-full gap-3">
						<Button variant="outline" className="flex-1" onClick={handleCopy}>
							{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
							{copied ? "Copied!" : "Copy link"}
						</Button>
						<Button className="flex-1" onClick={handleShare}>
							<Share2 className="h-4 w-4" />
							Share
						</Button>
					</div>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
