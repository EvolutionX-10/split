import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export default async function HomePage() {
	const session = await auth();
	if (session) redirect("/dashboard");

	return (
		<main className="flex min-h-dvh flex-col bg-zinc-950 text-white">
			{/* Nav */}
			<nav className="flex items-center justify-between px-6 pt-8">
				<div className="flex items-center gap-2">
					<Image src="/icons/icon-192.png" alt="Split Logo" width={32} height={32} className="rounded-lg" />
					<span className="font-semibold tracking-tight">Split</span>
				</div>
				<Button
					asChild
					size="sm"
					variant="outline"
					className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
				>
					<Link href="/login">Sign in</Link>
				</Button>
			</nav>

			{/* Hero */}
			<section className="flex flex-1 flex-col items-center justify-center px-6 pt-12 pb-8 text-center">
				{/* Floating cards — signature element */}
				<div className="relative mb-10 h-48 w-full max-w-xs">
					{/* Card 1 */}
					<div
						className="absolute top-4 left-0 w-52 animate-[float_6s_ease-in-out_infinite] rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-left shadow-xl"
						style={{ animationDelay: "0s" }}
					>
						<p className="mb-1 text-xs text-zinc-500">Goa trip 🏖️</p>
						<p className="text-sm font-medium text-white">Hotel booking</p>
						<div className="mt-2 flex items-center justify-between">
							<p className="text-xs text-zinc-400">Priya owes you</p>
							<p className="text-sm font-semibold text-emerald-400">+₹1,240</p>
						</div>
					</div>

					{/* Card 2 */}
					<div
						className="absolute top-0 right-0 w-48 animate-[float_6s_ease-in-out_infinite] rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-left shadow-xl"
						style={{ animationDelay: "2s" }}
					>
						<p className="mb-1 text-xs text-zinc-500">Dinner 🍕</p>
						<p className="text-sm font-medium text-white">Pizza Palace</p>
						<div className="mt-2 flex items-center justify-between">
							<p className="text-xs text-zinc-400">You owe Raj</p>
							<p className="text-sm font-semibold text-rose-400">-₹380</p>
						</div>
					</div>

					{/* Card 3 */}
					<div
						className="absolute bottom-0 left-6 w-52 animate-[float_6s_ease-in-out_infinite] rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-left shadow-xl"
						style={{ animationDelay: "4s" }}
					>
						<div className="flex items-center gap-2">
							<div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-medium text-indigo-400">
								A
							</div>
							<div>
								<p className="text-xs font-medium text-white">Arjun settled up</p>
								<p className="text-xs text-zinc-500">₹560 · just now</p>
							</div>
						</div>
					</div>
				</div>

				<h1 className="mb-4 text-4xl leading-tight font-bold tracking-tight">
					Split the bill.
					<br />
					<span className="text-indigo-400">Not the friendship.</span>
				</h1>

				<p className="mb-8 max-w-xs text-base leading-relaxed text-zinc-400">
					Add expenses, split them your way, and settle up — without the awkward follow-ups.
				</p>

				<Button asChild size="lg" className="w-full max-w-xs bg-indigo-500 font-medium text-white hover:bg-indigo-600">
					<Link href="/login">Get started free</Link>
				</Button>

				<p className="mt-3 text-xs text-zinc-600">Sign in with Google · No credit card needed</p>
			</section>

			{/* Features */}
			<section className="px-6 pb-12">
				<div className="mx-auto flex max-w-xs flex-col gap-3">
					{[
						{ emoji: "⚡", label: "Add expenses in seconds", sub: "Equal, percentage, or exact splits" },
						{ emoji: "📊", label: "See who owes what", sub: "Live balances across all your groups" },
						{ emoji: "📱", label: "Works offline too", sub: "Add expenses without internet, syncs later" },
					].map((f) => (
						<div
							key={f.label}
							className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
						>
							<span className="text-2xl">{f.emoji}</span>
							<div>
								<p className="text-sm font-medium text-white">{f.label}</p>
								<p className="text-xs text-zinc-500">{f.sub}</p>
							</div>
						</div>
					))}
				</div>
			</section>

			<style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
		</main>
	);
}
