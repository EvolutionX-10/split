import { signIn } from "@/auth";
import GoogleIcon from "@/components/icons/google";

export default async function LoginPage() {
	return (
		<main className="flex min-h-screen items-center justify-center px-6">
			<div className="border-border w-full max-w-sm rounded-2xl border p-8 shadow-sm">
				<h1 className="text-center text-2xl font-semibold">Sign in</h1>

				<p className="text-muted-foreground mt-2 text-center text-sm">Continue with your Google account</p>
				<form
					action={async () => {
						"use server";
						await signIn("google");
					}}
				>
					<button
						type="submit"
						className="border-border bg-background text-foreground hover:bg-muted mt-6 flex w-full items-center justify-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition"
					>
						<GoogleIcon />
						Continue with Google
					</button>
				</form>
			</div>
		</main>
	);
}
