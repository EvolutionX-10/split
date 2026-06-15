// components/MobileOnly.tsx
export default function MobileOnly({ children }: { children: React.ReactNode }) {
	return (
		<>
			<div className="fixed inset-0 z-50 hidden flex-col items-center justify-center bg-gray-900 p-8 text-center text-white md:flex">
				<h1 className="mb-4 text-2xl font-bold">Mobile Only Experience</h1>
				<p>
					This application is designed specifically for mobile devices. Please switch to a mobile browser or resize your
					window to view the content.
				</p>
			</div>

			<div className="hidden md:block lg:hidden xl:hidden">
				{/* This ensures the content is hidden when the overlay is active */}
			</div>

			<main className="md:hidden">{children}</main>
		</>
	);
}
