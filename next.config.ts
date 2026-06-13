import { withSerwist } from "@serwist/turbopack";

export default withSerwist({
	reactCompiler: true,
	cacheComponents: true,
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
				port: "",
				pathname: "/a/**",
			},
		],
	},
});
