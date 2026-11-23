import { cpus } from "node:os";
import { calculateSplits } from "../src/lib/ledger/splits";

const warmup = 200;
const samples = 200;
const batchSize = 20;
const results = [];
let checksum = 0;
for (const members of [2, 10, 50, 100]) {
	for (const splitType of ["equal", "percentage"] as const) {
		const input = {
			amount: "99999999.99",
			splitType,
			splits: Array.from({ length: members }, (_, index) => ({
				userId: `member-${index}`,
				percentage: String(100 / members),
			})),
		};
		for (let i = 0; i < warmup; i++) calculateSplits(input);
		const timings = [];
		for (let sample = 0; sample < samples; sample++) {
			const start = performance.now();
			for (let i = 0; i < batchSize; i++) {
				const allocation = calculateSplits(input);
				if (!allocation.ok) throw new Error(allocation.message);
				checksum += allocation.shares[0].minor;
			}
			timings.push((performance.now() - start) / batchSize);
		}
		timings.sort((a, b) => a - b);
		results.push({ members, splitType, p50_ms: timings[100], p95_ms: timings[190] });
	}
}
console.log(
	JSON.stringify(
		{
			runtime: `Bun ${Bun.version}`,
			cpu: cpus()[0]?.model,
			warmup,
			samples,
			batchSize,
			checksum,
			scope: "calculation only; excludes rendering and network; not a CI performance gate",
			results,
		},
		null,
		2,
	),
);
