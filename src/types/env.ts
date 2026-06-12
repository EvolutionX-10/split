declare module "bun" {
	interface Env {
		DATABASE_URL: string;

		AUTH_SECRET: string;
		AUTH_GOOGLE_ID: string;
		AUTH_GOOGLE_SECRET: string;
	}
}
