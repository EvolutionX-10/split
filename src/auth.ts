import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { accounts, sessions, users } from "@/db/schema/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
	adapter: DrizzleAdapter(db, {
		accountsTable: accounts,
		usersTable: users,
		sessionsTable: sessions,
	}),
	providers: [Google],
});
