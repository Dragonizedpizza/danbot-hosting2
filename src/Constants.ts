export const Constants = {
	BASE_URL: "https://danbot.host/api",
	BOT_STATS_URL: (<any>this).BASE_URL + "/bot/CLIENT_ID/stats",
	NODE_STATUS_URL: "https://status.danbot.host/json/stats.json",
	USERINFO_URL: "https://discord.com/api/v9/users/@me",
	GUILDS_URL: "https://discord.com/api/v9/users/@me/guilds",
	ErrorCodes: {
		InternalServerError: "INTERNAL_SERVER_ERROR",
		BadRequest: "BAD_REQUEST",
		RateLimit: "RATE_LIMIT",
		Unknown: "UNKNOWN",
		InvalidUserCount: "INVALID_USER_COUNT",
	},
};
