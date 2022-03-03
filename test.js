const Centra = require("centra"),
    { join } = require("path");

(async () => {
console.log(await Centra(
    "https://discord.com/api/v9/users/@me",
    "GET",
)
    .header("Content-Type", "application/json")
    .header("Authorization", "Bot NzMwMjk3MzUwMDgxNDc4NzA3.XwVcaA.w0KtiGg_yfQC3gfIFNR6F57cl1g")
    .send()
    .then((res) => res.json()));
})();