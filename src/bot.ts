import { Client } from "@discordjs/core";
import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import { GatewayDispatchEvents, GatewayIntentBits, Routes, type RESTGetAPIGatewayBotResult } from "discord-api-types/v10";
import * as db from "./db";
import { commands } from "./commands";
import features from "./feature";

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error("DISCORD_TOKEN environment variable not set.");
let applicationId = atob(process.env.DISCORD_TOKEN?.split(".")[0]!); // i bet most didn’t know this fact about discord tokens

process.title = "The Fire Bot (riskymh.dev)";

db.initDb();

process.on('uncaughtException', (err) => {
    console.error(`Unhandled Exception: ${err}`);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

const rest = new REST({ version: "10" }).setToken(token);
const gateway = new WebSocketManager({
    token,
    intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages | GatewayIntentBits.MessageContent | GatewayIntentBits.GuildMembers | GatewayIntentBits.GuildVoiceStates,
    fetchGatewayInformation: () => rest.get(Routes.gatewayBot()) as Promise<RESTGetAPIGatewayBotResult>,
    shardCount: null,
});

const client = new Client({ rest, gateway });

client.on(GatewayDispatchEvents.GuildDelete, async ({ data: guild, api }) => {
    if (!guild.id) return;
    await db.removeGuild(guild.id);
});

const commandIds = {} as Record<string, string>;
client.once(GatewayDispatchEvents.Ready, async (c) => {
    console.log(`${c.data.user.username}#${c.data.user.discriminator} is ready!`);
    applicationId = c.data.user.id;

    const commandsRes = await c.api.applicationCommands.bulkOverwriteGlobalCommands(c.data.user.id, commands);
    for (const cmd of commandsRes) commandIds[cmd.name] = cmd.id;
});


for (const feature of features) {
    for (const [event, handler] of Object.entries(feature.handlers)) {
        client.on(event, async (payload) => {
            try {
                await handler({
                    data: payload.data,
                    api: client.api,
                    applicationId,
                    db,
                    commandIds,
                } as any);
            } catch (err) {
                console.error(`Error in feature ${feature.name} handling event ${event}: ${err}`);
            }
        });
    }
}


gateway.connect();
