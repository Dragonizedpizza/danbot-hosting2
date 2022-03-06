import Centra from "centra";
import { Constants } from "./Constants";
import EventEmitter from "events";

export type LibraryClient = DiscordJSClient | ErisClient;
export type UserCount = "RANDOM" | "ALL" | [number, number] | number;
export type ClientWithoutLibraryOptions =
	| ClientWithoutLibraryUsingTokenOptions
	| ClientWithoutLibraryUsingUserDefinedOptions;

export interface MapLike {
	size: number;
}

export interface CacheManager {
	cache: MapLike;
}

export interface BaseLibraryClient {
	user: ClientUser;
}

export interface DiscordJSClient extends BaseLibraryClient {
	guilds: CacheManager;
	users: CacheManager;
	token: string;
	readyAt?: number;
}

export interface ErisClient extends BaseLibraryClient {
	guilds: MapLike;
	users: MapLike;
	_token: string;
	ready: boolean;
}

export interface IncrementOptions {
	by?: number;
	timeout?: number;
}

export interface ExtraOptions {
	fetch?: {
		guilds?: {
			everyPost?: boolean;
			firstTime?: boolean;
		};
	};
	autopostTimeout?: number;
	increment?: {
		user?: IncrementOptions;
		guild?: IncrementOptions;
	};
}

export interface BaseOptions {
	APIKey: string;
	options?: ExtraOptions;
}

export interface ClientWithLibraryOptions extends BaseOptions {
	APIKey: string;
	client: DiscordJSClient | ErisClient;
	options?: ExtraOptions;
	guildCount?: number;
	userCount?: number;
}

export interface ClientWithoutLibraryUsingTokenOptions extends BaseOptions {
	guildCount?: number;
	userCount: UserCount;
	token: string;
}

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

export interface ClientUser {
	id: string;
	username: string;
	avatar: string;
}

export interface Client {
	rawClient?: LibraryClient;
	clientInfo: ClientUser;
	token?: string;
	id: string;
	guildCount: number;
	userCount: number;
}

/**
 * The DanBot client, for checking node statuses or posting stats to the API.
 */

export class DanBotClient extends EventEmitter {
	public APIKey!: string;
	public client!: Client;
	public options: ExtraOptions;
	public ready!: boolean;
	public promise: Promise<void>;

	/**
	 * Creates a new DanBotClient.
	 * @param {ClientWithLibraryOptions | ClientWithoutLibraryOptions} options The options for the client.
	 * @returns {DanBotClient} The new DanBotClient.
	 */

	public constructor(
		args: ClientWithLibraryOptions | ClientWithoutLibraryOptions,
	) {
		super();

		let resolver: () => void;

		this.promise = new Promise((resolve) => (resolver = resolve));

		const { options = {} } = args;

		/**
		 * The DanBot client API key, for posting stats to the API.
		 * @name DanBotClient#APIKey
		 * @type {String?}
		 * @readonly
		 * @private
		 */

		Object.defineProperty(this, "APIKey", {
			value: args.APIKey,
			enumerable: false,
		});

		/**
		 * The library client, or an object containing data relative to the API.
		 * @name DanBotClient#client
		 * @type {Client?}
		 */

		DanBotClient.transformClient(
			(<ClientWithLibraryOptions>args).client
				? (<ClientWithLibraryOptions>args).client
				: <ClientWithoutLibraryOptions>args,
		).then(async (client) => {
			this.client = client;

			if (options.fetch?.guilds?.firstTime)
				this.client.guildCount = await DanBotClient.fetchGuildCount(
					this.client.token!,
				);

			if (options.increment?.guild)
				setTimeout(
					() =>
						(this.client.guildCount +=
							options.increment?.guild?.by ?? 2),
					options.increment?.guild?.timeout ?? 300000, // Add an amount (default = 2) of guilds every timeout (default = 1 hour)
				);

			if (options?.increment?.user)
				setTimeout(
					() =>
						(this.client.userCount +=
							options.increment?.user?.by ?? 30),
					options.increment?.user?.timeout ?? 3600000, // Add an amount (default = 30) of users every timeout (default = 5 minutes)
				);

			resolver();

			this.ready = true;
			this.emit("ready", this);
		});

		/**
		 * Extra options for the client.
		 * @type {ExtraOptions?}
		 */

		this.options = options;
	}
	public async post({
		guildCount,
		userCount,
	}: { guildCount?: number; userCount?: number } = {}) {
		if (!this.ready) await this.promise;

		if (this.options.fetch?.guilds?.firstTime)
			this.client.guildCount = await DanBotClient.fetchGuildCount(
				this.client.token!,
			);

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
			.then((resv) => resv.json())
			.catch(() => {
				throw LibError(
					"CloudflareRestricted",
					"Unable to post statistics as Cloudflare is blocking the request",
				);
			});

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
		const raw = await Centra(Constants.USERINFO_URL, "GET")
			.header("Content-Type", "application/json")
			.header("Authorization", "Bot " + token)
			.send()
			.then((res) => res.json());

		if (raw.message === Constants.UNAUTHORIZED_DISCORD_ERROR)
			throw LibError(
				"InvalidDiscordToken",
				"An invalid Discord token was provided",
			);

		return {
			id: raw.id,
			username: raw.username,
			avatar: raw.avatar,
		};
	}
	private static async fetchGuildCount(token: string): Promise<number> {
		const raw = await Centra(Constants.GUILDS_URL, "GET")
			.header("Content-Type", "application/json")
			.header("Authorization", "Bot " + token)
			.send()
			.then((res) => res.json());

		if (raw.message === Constants.UNAUTHORIZED_DISCORD_ERROR)
			throw LibError(
				"InvalidDiscordToken",
				"An invalid Discord token was provided",
			);

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
						clientInfo: (<DiscordJSClient>client).user,
						get guildCount(): number {
							return (<DiscordJSClient>client).guilds.cache.size;
						},
						get userCount(): number {
							return (<DiscordJSClient>client).users.cache.size;
						},
						get token(): string {
							return (<DiscordJSClient>client).token;
						},
					};
				else
					throw LibError(
						"ClientNotReady",
						"The client is not ready. Please run this code in a ready event.",
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
						get token(): string {
							return (<ErisClient>client)._token;
						},
					};
				else
					throw LibError(
						"ClientNotReady",
						"The client is not ready. Please run this code in a ready event.",
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
					userCount: this.resolveUserCount(
						(<ClientWithoutLibraryUsingUserDefinedOptions>client)
							.userCount,
					),
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
