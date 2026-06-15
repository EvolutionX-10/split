import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const proxy = auth((req) => {
	const isLoggedIn = !!req.auth;
	const { pathname } = req.nextUrl;

	const protectedPrefixes = ["/dashboard", "/groups", "/expenses", "/profile", "/notifications"];
	const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

	if (isProtected && !isLoggedIn) {
		return NextResponse.redirect(new URL("/login", req.url));
	}

	if (isLoggedIn && pathname === "/login") {
		return NextResponse.redirect(new URL("/dashboard", req.url));
	}

	return NextResponse.next();
});

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons).*)"],
};
