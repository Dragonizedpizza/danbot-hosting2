export const Constants = {
	BASE_URL: "https://danbot.host/api",
	BOT_STATS_URL: "https://danbot.host/api/bot/CLIENT_ID/stats",
	NODE_STATUS_URL: "https://status.danbot.host/json/stats.json",
	USERINFO_URL: "https://discord.com/api/v9/users/@me",
	GUILDS_URL: "https://discord.com/api/v9/users/@me/guilds",
	UNAUTHORIZED_DISCORD_ERROR: "401: Unauthorized",
	ErrorCodes: {
		InternalServerError: "INTERNAL_SERVER_ERROR",
		BadRequest: "BAD_REQUEST",
		RateLimit: "RATE_LIMIT",
		Unknown: "UNKNOWN",
		InvalidUserCount: "INVALID_USER_COUNT",
		ClientNotReady: "CLIENT_NOT_READY",
		InvalidDiscordToken: "INVALID_DISCORD_TOKEN",
		CloudflareRestricted: "CLOUDFLARE_RESTRICTED",
	},
};
