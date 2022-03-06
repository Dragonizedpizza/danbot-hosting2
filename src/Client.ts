import Centra from "centra";
import { Constants } from "./Constants";

export type LibraryClient = DiscordJSClient | ErisClient;

export interface MapLike {
	size: number;
}

export interface DiscordJSClient {
	user: ClientUser;
	guilds: {
		cache: MapLike;
	};
	users: {
		cache: MapLike;
	};
	token: string;
	readyAt?: number;
}

export interface ErisClient {
	user: ClientUser;
	guilds: MapLike;
	users: MapLike;
	token: string;
	ready: boolean;
}

export interface ClientWithLibraryOptions {
	APIKey: string;
	client: DiscordJSClient | ErisClient;
	options?: ExtraOptions;
	guildCount?: number;
	userCount?: number;
}

export type ClientWithoutLibraryOptions =
	| ClientWithoutLibraryUsingTokenOptions
	| ClientWithoutLibraryUsingUserDefinedOptions;

export interface ClientWithoutLibraryUsingTokenOptions {
	APIKey: string;
	guildCount?: number;
	userCount: UserCount;
	options?: ExtraOptions;
	token: string;
}

export type UserCount = "RANDOM" | "ALL" | [number, number] | number;

export interface ClientWithoutLibraryUsingUserDefinedOptions {
	APIKey: string;
	id: string;
	guildCount: number;
	userCount: UserCount;
	options?: ExtraOptions;
	clientInfo: {
		id: string;
		avatar: string;
		username: string;
	};
}

export interface ExtraOptions {
	fetchGuilds?: boolean;
	fetchUsers?: boolean;
	autopostTimeout?: number;
	increment?: {
		user?: number;
		guild?: number;
		guildTimeout?: number;
		userTimeout?: number;
	};
}

export interface Client {
	rawClient?: LibraryClient;
	clientInfo: ClientUser;
	token?: string;
	id: string;
	guildCount: number;
	userCount: number;
}

export interface ClientUser {
	id: string;
	username: string;
	avatar: string;
}

/**
 * The DanBot client, for checking node statuses or posting stats to the API.
 */

export class DanBotClient {
	public APIKey!: string;
	public client!: Client;
	public options: ExtraOptions;
	public ready!: boolean;

	/**
	 * Creates a new DanBotClient.
	 * @param {ClientWithLibraryOptions | ClientWithoutLibraryOptions} options The options for the client.
	 */

	public constructor(
		options: ClientWithLibraryOptions | ClientWithoutLibraryOptions,
	) {
		const { options: extraOptions = {}, APIKey } = options;

		/**
		 * The DanBot client API key, for posting stats to the API.
		 * @name DanBotClient#APIKey
		 * @type {String?}
		 * @readonly
		 * @private
		 */

		Object.defineProperty(this, "APIKey", {
			value: APIKey,
			enumerable: false,
		});

		/**
		 * The library client, or an object containing data relative to the API.
		 * @name DanBotClient#client
		 * @type {Client?}
		 */

		DanBotClient.transformClient(
			(<ClientWithLibraryOptions>options).client
				? (<ClientWithLibraryOptions>options).client
				: <ClientWithoutLibraryOptions>options,
		).then((client) => {
			this.client = client;

			if (client.rawClient) {
				setTimeout(
					() =>
						(this.client.guildCount +=
							extraOptions.increment?.guild ?? 30),
					extraOptions.increment?.guildTimeout ?? 300000, // Add an amount (default = 30) of users every timeout (default = 5 minutes)
				);

				setTimeout(
					() =>
						(this.client.userCount +=
							extraOptions.increment?.guild ?? 2),
					extraOptions.increment?.userTimeout ?? 3600000, // Add an amount (default = 2) of guilds every timeout (default = 1 hour)
				);
			}
		});

		/**
		 * Extra options for the client.
		 * @type {ExtraOptions?}
		 */

		this.options = extraOptions;
	}
	public async post({
		guildCount,
		userCount,
	}: { guildCount?: number; userCount?: number } = {}) {
		const res = await Centra(
			Constants.BOT_STATS_URL.replace("CLIENT_ID", this.client.id),
			"POST",
		)
			.body(
				{
					servers: guildCount ?? this.client.guildCount,
					users: userCount ?? this.client.userCount,
					id: this.client.id,
					key: this.APIKey,
					clientInfo: this.client.clientInfo,
				},
				"json",
			)
			.header("Content-Type", "application/json")
			.send()
			.then((resv) => resv.json());

		// Successful.
		if (res.status === 200) return res.body;
		else if (res.status >= 500)
			throw LibError(
				"InternalServerError",
				"An internal DanBot Hosting server error occured",
				res.status,
			);
		else if (res.status === 400 && res.error)
			throw LibError("BadRequest", res.message);
		else if (res.status === 429 && res.error)
			throw LibError("RateLimit", res.message);
		else LibError("Unknown", "An unknown error occured", res.status);
	}
	private static async fetchUserInfo(token: string): Promise<ClientUser> {
		const Raw = await Centra(Constants.USERINFO_URL, "GET")
			.header("Content-Type", "application/json")
			.header("Authorization", "Bot " + token)
			.send()
			.then((res) => res.json());

		return {
			id: Raw.id,
			username: Raw.username,
			avatar: Raw.avatar,
		};
	}
	private static async fetchGuildCount(token: string): Promise<number> {
		const raw = await Centra(Constants.GUILDS_URL, "GET")
			.header("Content-Type", "application/json")
			.header("Authorization", "Bot " + token)
			.send()
			.then((res) => res.json());

		let more = 0;

		if (raw.length === 200) more = await this.fetchGuildCount(token);

		return raw.length + more;
	}
	private static async transformClient(
		client: LibraryClient | ClientWithoutLibraryOptions,
	): Promise<Client> {
		if ((<LibraryClient>client).guilds) {
			if ((<DiscordJSClient>client).guilds.cache) {
				if ((<DiscordJSClient>client).readyAt)
					return {
						rawClient: <DiscordJSClient>client,
						id: (<DiscordJSClient>client).user.id,
						get guildCount(): number {
							return (<DiscordJSClient>client).guilds.cache.size;
						},
						get userCount(): number {
							return (<DiscordJSClient>client).users.cache.size;
						},
						clientInfo: (<DiscordJSClient>client).user,
					};
				else
					throw new Error(
						"[CLIENT_NOT_READY] The client is not ready. Please run this code in a ready event.",
					);
			} else {
				if ((<ErisClient>client).ready)
					return {
						rawClient: <ErisClient>client,
						id: (<ErisClient>client).user.id,
						clientInfo: (<ErisClient>client).user,
						get guildCount(): number {
							return (<ErisClient>client).guilds.size;
						},
						get userCount(): number {
							return (<ErisClient>client).users.size;
						},
					};
				else
					throw new Error(
						"[CLIENT_NOT_READY] The client is not ready. Please run this code in a ready event.",
					);
			}
		} else {
			if (
				(<ClientWithoutLibraryUsingUserDefinedOptions>client).clientInfo
			)
				return {
					id: (<ClientWithoutLibraryUsingUserDefinedOptions>client)
						.id,
					clientInfo: (<ClientWithoutLibraryUsingUserDefinedOptions>(
						client
					)).clientInfo,
					guildCount: (<ClientWithoutLibraryUsingUserDefinedOptions>(
						client
					)).guildCount,
					userCount: this.resolveUserCount((<ClientWithoutLibraryUsingUserDefinedOptions>(
						client
					)).userCount),
				};
			else {
				const userInfo = await DanBotClient.fetchUserInfo(
					(<ClientWithoutLibraryUsingTokenOptions>client).token,
				);

				return this.defineToken(
					{
						id: userInfo.id,
						clientInfo: userInfo,
						guildCount:
							(<ClientWithoutLibraryUsingTokenOptions>client)
								.guildCount ??
							(await this.fetchGuildCount(
								(<ClientWithoutLibraryUsingTokenOptions>client)
									.token,
							)),
						userCount: this.resolveUserCount(
							(<ClientWithoutLibraryUsingTokenOptions>client)
								.userCount,
						),
					},
					(<ClientWithoutLibraryUsingTokenOptions>client).token,
				);
			}
		}
	}
	private static resolveUserCount(userCount: UserCount): number {
		if (userCount === "ALL") return Infinity;
		else if (userCount === "RANDOM")
			return Math.floor(Math.random() * 150) + 1;
		else if (typeof userCount === "number") return userCount;
		else if (Array.isArray(userCount))
			return (
				Math.floor(Math.random() * userCount[1] - userCount[0]) +
				userCount[0]
			);
		else
			throw LibError(
				"InvalidUserCount",
				"The user count provided was invalid",
			);
	}
	private static defineToken(target: Client, value: string): Client {
		Object.defineProperty(target, "token", {
			value,
			enumerable: false,
			writable: true,
		});

		return target;
	}
}

function LibError(
	errorCode: keyof typeof Constants.ErrorCodes,
	message: string,
	status?: number,
): Error {
	return new Error(
		`[${Constants.ErrorCodes[errorCode]}] ${message}. ${
			status ? `Status: ${errorCode}` : ""
		}`,
	);
}
