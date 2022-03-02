import { join } from "path";
import Centra from "centra";
import Constants from "./Constants";

export type LibraryClient = DiscordJSClient | ErisClient;

export interface MapLike {
	size: number;
}

export interface User {
	id: string;
}

export interface DiscordJSClient {
	user: User;
	guilds: {
		cache: MapLike;
	};
	users: {
		cache: MapLike;
	};
}

export interface ErisClient {
	user: User;
	guilds: MapLike;
	users: MapLike;
}

export interface ClientWithLibraryOptions {
	APIKey: string;
	client: DiscordJSClient | ErisClient;
	options?: ExtraOptions;
	guildCount?: number;
	userCount?: number;
}

export interface ClientWithoutLibraryOptions {
	APIKey: string;
	id: string;
	guildCount: number;
	userCount: number;
	options?: ExtraOptions;
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
	rawClient?: DiscordJSClient | ErisClient;
	id: string;
	guildCount: number;
	userCount: number;
}

/**
 * The DanBot client, for checking node statuses or posting stats to the API.
 */

export default class DanBotClient {
	public APIKey?: string;
	public client?: Client;
	public options?: ExtraOptions;

	/**
	 * Creates a new DanBotClient.
	 * @param {ClientWithLibraryOptions | ClientWithoutLibraryOptions} options The options for the client.
	 */

	public constructor(
		options?: ClientWithLibraryOptions | ClientWithoutLibraryOptions,
	) {
		if (!options) return;

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

		if ((<ClientWithLibraryOptions>options).client)
			this.client = DanBotClient.transformClient(
				(<ClientWithLibraryOptions>options).client,
			);
		else {
			this.client = DanBotClient.transformClient(
				<ClientWithoutLibraryOptions>options,
			);

			setTimeout(
				() =>
					(this.client!.guildCount +=
						extraOptions.increment?.guild ?? 30),
				extraOptions.increment?.guildTimeout ?? 300000, // Add an amount (default = 30) of users every timeout (default = 5 minutes)
			);

			setTimeout(
				() =>
					(this.client!.userCount +=
						extraOptions.increment?.guild ?? 2),
				extraOptions.increment?.userTimeout ?? 3600000, // Add an amount (default = 2) of guilds every timeout (default = 1 hour)
			);
		}

		/**
		 * Extra options for the client.
		 * @type {ExtraOptions?}
		 */

		this.options = extraOptions;
	}
	public async post({ guildCount, userCount }: { [x: string]: number }) {
		const res = await Centra(
			join(Constants.BOT_STATS_URL, this.client!.id),
			"POST",
		)
			.body(
				{
					servers: guildCount ?? this.client!.guildCount,
					users: userCount ?? this.client!.userCount,
					id: this.client!.id,
					clientInfo: {
						id: this.client!.id,
					},
				},
				"json",
			)
			.header("Content-Type", "application/json")
			.send()
			.then((resv) => resv.json());

		// Successful.
		if (res.status === 200) return res.body;
		else if (res.status >= 500)
			throw RequestError(
				"InternalServerError",
				"An internal DanBot Hosting server error occured",
				res.status,
			);
		else if (res.status === 400) {
			if (res.error) throw RequestError("BadRequest", res.error);
		} else if (res.status === 429) {
			if (res.error) throw RequestError("RateLimit", res.error);
		} else RequestError("Unknown", "An unknown error occured", res.status);
	}
	private static transformClient(
		client: DiscordJSClient | ErisClient | ClientWithoutLibraryOptions,
	): Client {
		if ((<LibraryClient>client).guilds) {
			if ((<DiscordJSClient>client).guilds.cache)
				return {
					rawClient: <DiscordJSClient>client,
					id: (<DiscordJSClient>client).user.id,
					get guildCount(): number {
						return (<DiscordJSClient>client).guilds.cache.size;
					},
					get userCount(): number {
						return (<DiscordJSClient>client).users.cache.size;
					},
				};
			else
				return {
					rawClient: <ErisClient>client,
					id: (<ErisClient>client).user.id,
					get guildCount(): number {
						return (<ErisClient>client).guilds.size;
					},
					get userCount(): number {
						return (<ErisClient>client).users.size;
					},
				};
		} else
			return {
				id: (<ClientWithoutLibraryOptions>client).id,
				guildCount: (<ClientWithoutLibraryOptions>client).guildCount,
				userCount: (<ClientWithoutLibraryOptions>client).userCount,
			};
	}
}

function RequestError(
	errorCode: keyof typeof Constants.ErrorCodes,
	message: string,
	status?: number,
): Error {
	return new Error(
		`[${Constants.ErrorCodes[errorCode]}] ${message}. ${
			status ? `Status: ${errorCode}` : ""
		}`,
	);
};