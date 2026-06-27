"use client";

import { useEffect, useState } from "react";

const STAGES = ["Splitting the bill...", "Counting coins...", "Settling up...", "Almost there..."];

export default function FunkyLoader() {
	const [stage, setStage] = useState(0);

	useEffect(() => {
		const id = setInterval(() => {
			setStage((s) => (s + 1) % STAGES.length);
		}, 1400);
		return () => clearInterval(id);
	}, []);

	return (
		<div className="flex h-screen flex-col items-center justify-center gap-3 px-6">
			<div className="relative h-40 w-32 animate-[receipt_2.6s_ease-in-out_infinite]">
				<div className="absolute inset-x-0 bottom-0 w-full rounded-t-md bg-linear-to-b from-white to-zinc-100 px-3 pt-3 shadow-lg ring-1 ring-zinc-200 dark:from-zinc-800 dark:to-zinc-900 dark:ring-zinc-700">
					<div className="flex flex-col gap-1.5">
						<div className="mx-auto h-1.5 w-14 rounded-full bg-zinc-200 dark:bg-zinc-700" />
						<div
							className="mt-1.5 h-px w-full bg-zinc-200 dark:bg-zinc-700"
							style={{
								backgroundImage:
									"repeating-linear-gradient(90deg, transparent, transparent 4px, currentColor 4px, currentColor 6px)",
								color: "rgb(228 228 231)",
								opacity: 0.5,
							}}
						/>
						{[1, 2, 3].map((i) => (
							<div key={i} className="flex items-center justify-between">
								<div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700" style={{ width: `${35 + i * 12}%` }} />
								<div className="h-1.5 w-6 rounded-full bg-zinc-300 dark:bg-zinc-600" />
							</div>
						))}
						<div className="mt-1 h-px w-full bg-zinc-200 dark:bg-zinc-700" />
						<div className="flex items-center justify-between pb-1">
							<div className="h-2 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
							<div className="h-2 w-8 rounded-full bg-zinc-800 dark:bg-zinc-200" />
						</div>
					</div>
					<div className="mx-auto flex h-2 w-full justify-between px-0">
						{Array.from({ length: 10 }).map((_, i) => (
							<div
								key={i}
								className="h-1.5 w-1.5 rounded-full bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700"
							/>
						))}
					</div>
				</div>
			</div>

			<div className="relative flex h-1 w-28 items-end justify-center">
				{["🪙", "💰", "🪙"].map((coin, i) => (
					<span
						key={i}
						className="absolute text-xl"
						style={{
							animation: `coin-bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
							left: `${6 + i * 40}px`,
						}}
					>
						{coin}
					</span>
				))}
			</div>

			<div className="relative h-1.5 w-44 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
				<div
					className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-violet-500 via-fuchsia-500 to-amber-400"
					style={{
						animation: "slide-bar 1.8s ease-in-out infinite",
					}}
				/>
			</div>

			<div className="relative h-5 w-56 overflow-hidden">
				<p
					key={stage}
					className="text-center text-xs font-medium text-zinc-500 dark:text-zinc-400"
					style={{ animation: "text-pop 0.5s ease-out" }}
				>
					{STAGES[stage]}
				</p>
			</div>
		</div>
	);
}
