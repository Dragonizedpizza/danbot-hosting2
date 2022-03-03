import { join } from "path";
import Centra from "centra";
import { Constants } from "./Constants";

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
	token: string;
}

export interface ErisClient {
	user: User;
	guilds: MapLike;
	users: MapLike;
	token: string;
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
	token?: string;
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
	token?: string;
	id: string;
	guildCount: number;
	userCount: number;
}

export interface ClientUserInfo {
	id: string,
	username: string,
	discriminator: string,
	avatar: string,
	bot: boolean,
	verified: boolean,
	bio: string,
};

/**
 * The DanBot client, for checking node statuses or posting stats to the API.
 */

export class DanBotClient {
	public APIKey!: string;
	public client: Client;
	public options: ExtraOptions;

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
			join(Constants.BOT_STATS_URL.replace("CLIENT_ID", this.client.id), this.client.id),
			"POST",
		)
			.body(
				{
					servers: guildCount ?? this.client.guildCount,
					users: userCount ?? this.client.userCount,
					id: this.client.id,
					clientInfo: this.client.rawClient ? this.client.rawClient.user : await this.fetchUserInfo(),
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
		else if (res.status === 400 && res.error)
			throw RequestError("BadRequest", res.error);
		else if (res.status === 429 && res.error)
			throw RequestError("RateLimit", res.error);
		else RequestError("Unknown", "An unknown error occured", res.status);
	}
	private async fetchUserInfo(): Promise<ClientUserInfo> {
		const Raw = await Centra(
			Constants.USERINFO_URL,
			"GET",
		)
			.header("Content-Type", "application/json")
			.header("Authorization", "Bot " + this.client.token!)
			.send()
			.then((res) => res.json());

		return {
			id: Raw.id,
			username: Raw.username,
			discriminator: Raw.discriminator,
			avatar: Raw.avatar,
			bot: Raw.bot,
			verified: Raw.verified,
			bio: Raw.bio,
		};
	}
	private static transformClient(
		client: LibraryClient | ClientWithoutLibraryOptions,
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
				return DanBotClient.nonEnumerableProperty({
					rawClient: <ErisClient>client,
					id: (<ErisClient>client).user.id,
					get guildCount(): number {
						return (<ErisClient>client).guilds.size;
					},
					get userCount(): number {
						return (<ErisClient>client).users.size;
					},
				}, "token", (<ErisClient>client).token);
		} else
			return DanBotClient.nonEnumerableProperty({
				id: (<ClientWithoutLibraryOptions>client).id,
				guildCount: (<ClientWithoutLibraryOptions>client).guildCount,
				userCount: (<ClientWithoutLibraryOptions>client).userCount,
			}, "token", (<ClientWithoutLibraryOptions>client).token);
	}
	private static nonEnumerableProperty(target: any, key: string, value: any): any {
		Object.defineProperty(target, key, {
			value,
			enumerable: false,
			writable: true,
		});

		return target;
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
}
