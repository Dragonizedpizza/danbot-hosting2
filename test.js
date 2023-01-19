const Centra = require("centra"),
	{ join } = require("path");

(async () => {
	console.log(
		await Centra("https://discord.com/api/v9/users/@me/guilds", "GET")
			.header("Content-Type", "application/json")
			.header(
				"Authorization",
				"OTY4ODAyODMwNjI0Mzc0ODE1.G-CDXU.wc1-ebsmkKwKsEpkI6_942G91_AG-JT6MBddRc",
			)
			.send()
			.then((res) => res.json()),
	);
})();


