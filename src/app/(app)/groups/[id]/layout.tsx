export default function GroupLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="border-border bg-card mx-auto mt-24 max-w-md rounded-2xl border p-8 shadow-sm">{children}</div>
	);
}
