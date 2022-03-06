const Centra = require("centra"),
	{ join } = require("path");

(async () => {
	console.log(
		await Centra("https://discord.com/api/v9/users/@me/guilds", "GET")
			.header("Content-Type", "application/json")
			.header(
				"Authorization",
				"Bot ",
			)
			.send()
			.then((res) => res.json()),
	);
})();


