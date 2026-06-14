import { withSerwist } from "@serwist/turbopack";

export default withSerwist({
	reactCompiler: true,
	cacheComponents: true,
	devIndicators: false,
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
