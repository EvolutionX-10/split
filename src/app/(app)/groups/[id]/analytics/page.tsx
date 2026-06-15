import { getGroupAnalyticsAction } from "@/lib/actions/groups";
import { notFound } from "next/navigation";
import AnalyticsClient from "@/components/analytics-client";
import { type Period } from "@/lib/cache/groups";

type Props = {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ period?: string }>;
};

export default async function AnalyticsPage({ params, searchParams }: Props) {
	const { id } = await params;
	const { period } = await searchParams;
	const validPeriod = (["week", "month", "6months", "year", "all"].includes(period ?? "") ? period : "month") as Period;

	let data;
	try {
		data = await getGroupAnalyticsAction(id, validPeriod);
	} catch (e) {
		console.log("Error fetching group analytics:", e);
		notFound();
	}

	return <AnalyticsClient data={data} groupId={id} period={validPeriod} />;
}
