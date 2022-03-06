const Centra = require("centra"),
	{ join } = require("path");

(async () => {
	console.log(
		await Centra("https://discord.com/api/v9/users/@me/guilds", "GET")
			.header("Content-Type", "application/json")
			.header(
				"Authorization",
				"SNzMwMjk3MzUwMDgxNDc4NzA3.XwVcaA.VJ5k7FMdM-tbDVub6k19aMck_VU",
			)
			.send()
			.then((res) => res.json()),
	);
})();


