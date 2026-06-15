"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart, Cell, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { CATEGORY_ICONS, CATEGORIES } from "@/lib/constants";
import { type Period } from "@/lib/cache/groups";

type Props = {
	groupId: string;
	period: Period;
	data: {
		summary: { totalSpent: number; youPaid: number; yourShare: number };
		byCategory: { category: string; amount: number }[];
		byMember: { name: string; amount: number }[];
		balanceOverTime: { date: string; balance: number }[];
	};
};

const PERIODS: { label: string; value: Period }[] = [
	{ label: "Week", value: "week" },
	{ label: "Month", value: "month" },
	{ label: "6M", value: "6months" },
	{ label: "Year", value: "year" },
	{ label: "All", value: "all" },
];

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const categoryChartConfig = {
	amount: { label: "Amount" },
} satisfies ChartConfig;

const memberChartConfig = {
	amount: { label: "Paid" },
} satisfies ChartConfig;

const balanceChartConfig = {
	balance: { label: "Net Balance", color: "var(--chart-1)" },
} satisfies ChartConfig;

export default function AnalyticsClient({ data, groupId, period }: Props) {
	const router = useRouter();

	function setPeriod(p: Period) {
		router.push(`/groups/${groupId}/analytics?period=${p}`);
	}

	const { summary, byCategory, byMember, balanceOverTime } = data;

	return (
		<div className="flex flex-col gap-6 px-4 py-4 pb-24">
			{/* Period filter */}
			<div className="border-border flex overflow-hidden rounded-xl border">
				{PERIODS.map((p) => (
					<button
						key={p.value}
						onClick={() => setPeriod(p.value)}
						className={`flex-1 py-2 text-sm font-medium transition-colors ${
							period === p.value ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
						}`}
					>
						{p.label}
					</button>
				))}
			</div>

			{/* Summary cards */}
			<div className="grid grid-cols-3 gap-3">
				{[
					{ label: "Total Spent", value: summary.totalSpent },
					{ label: "You Paid", value: summary.youPaid },
					{ label: "Your Share", value: summary.yourShare },
				].map((s) => (
					<div key={s.label} className="border-border bg-card flex flex-col gap-1 rounded-xl border px-3 py-3">
						<p className="text-muted-foreground text-xs">{s.label}</p>
						<p className="text-base font-semibold">₹{s.value.toFixed(0)}</p>
					</div>
				))}
			</div>

			{byCategory.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<p className="font-medium">No expenses in this period</p>
					<p className="text-muted-foreground mt-1 text-sm">Try selecting a different time range</p>
				</div>
			) : (
				<>
					{/* Spending by category — pie chart */}
					<div className="flex flex-col gap-3">
						<p className="text-sm font-medium">Spending by Category</p>
						<ChartContainer config={categoryChartConfig} className="min-h-55 w-full">
							<PieChart>
								<Pie
									data={byCategory}
									dataKey="amount"
									nameKey="category"
									cx="50%"
									cy="50%"
									outerRadius={80}
									label={(props) =>
										`${CATEGORY_ICONS[props.name as keyof typeof CATEGORY_ICONS] ?? "💸"} ${((props.percent ?? 0) * 100).toFixed(0)}%`
									}
								>
									{byCategory.map((_, index) => (
										<Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
									))}
								</Pie>
								<ChartTooltip
									content={
										<ChartTooltipContent
											formatter={(value, name) => [
												`₹${Number(value).toFixed(2)}`,
												CATEGORIES.find((c) => c.value === name)?.label ?? name,
											]}
										/>
									}
								/>
							</PieChart>
						</ChartContainer>
						{/* Legend */}
						<div className="flex flex-wrap gap-2">
							{byCategory.map((c, i) => (
								<div key={c.category} className="flex items-center gap-1.5 text-xs">
									<div
										className="h-2.5 w-2.5 rounded-full"
										style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
									/>
									<span>
										{CATEGORY_ICONS[c.category as keyof typeof CATEGORY_ICONS]}{" "}
										{CATEGORIES.find((cat) => cat.value === c.category)?.label ?? c.category}
									</span>
								</div>
							))}
						</div>
					</div>

					{/* Member contributions — bar chart */}
					<div className="flex flex-col gap-3">
						<p className="text-sm font-medium">Who Paid</p>
						<ChartContainer config={memberChartConfig} className="min-h-45 w-full">
							<BarChart data={byMember} accessibilityLayer>
								<CartesianGrid vertical={false} />
								<XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
								<YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} width={50} />
								<ChartTooltip
									content={<ChartTooltipContent formatter={(v) => [`₹${Number(v).toFixed(2)}`, "Paid"]} />}
								/>
								<Bar dataKey="amount" radius={6}>
									{byMember.map((_, i) => (
										<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
									))}
								</Bar>
							</BarChart>
						</ChartContainer>
					</div>

					{/* Balance over time — line chart */}
					{balanceOverTime.length > 1 && (
						<div className="flex flex-col gap-3">
							<p className="text-sm font-medium">Your Balance Over Time</p>
							<ChartContainer config={balanceChartConfig} className="min-h-45 w-full">
								<LineChart data={balanceOverTime} accessibilityLayer>
									<CartesianGrid vertical={false} />
									<XAxis
										dataKey="date"
										tickLine={false}
										axisLine={false}
										tickMargin={8}
										tickFormatter={(v) => new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
									/>
									<YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} width={50} />
									<ChartTooltip
										content={
											<ChartTooltipContent
												formatter={(v) => [
													<span className={Number(v) >= 0 ? "text-emerald-500" : "text-rose-500"}>
														{Number(v) >= 0 ? "+" : ""}₹{Number(v).toFixed(2)}
													</span>,
													"Net Balance",
												]}
											/>
										}
									/>
									<Line type="monotone" dataKey="balance" stroke="var(--color-balance)" strokeWidth={2} dot={false} />
								</LineChart>
							</ChartContainer>
							<p className="text-muted-foreground text-xs">Positive = you're owed · Negative = you owe</p>
						</div>
					)}
				</>
			)}
		</div>
	);
}
