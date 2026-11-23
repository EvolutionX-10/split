import { auth } from "@/auth";
export async function GET() {
	const session = await auth();
	return Response.json({ userId: session?.user?.id ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}
