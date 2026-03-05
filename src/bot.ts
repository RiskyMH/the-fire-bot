import { Client } from "@discordjs/core";
import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import {
    InteractionType, GatewayDispatchEvents, GatewayIntentBits, MessageFlags, ApplicationCommandType, ApplicationIntegrationType, InteractionContextType, PermissionFlagsBits, ApplicationCommandOptionType, ComponentType,
    type APIChatInputApplicationCommandInteractionData, type APIApplicationCommandInteractionDataOption, type RESTPostAPIChannelMessageJSONBody,
} from "discord-api-types/v10";
import { getCounting, setCounting, unsetCounting, resetCounting, initDb, updateCounting, setUserTimezone, removeUserTimezone, getGuildTimezones, removeGuild, setGuildTimezoneMessage, getGuildTimezoneMessage, getTimezoneMessages } from "./db";
import { getTimeZones, type Timezone } from "./timezones" with {type: "macro"};
const _timezones = getTimeZones();
const getTimezones = () => _timezones;

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error("DISCORD_TOKEN environment variable not set.");
let applicationId = atob(process.env.DISCORD_TOKEN?.split(".")[0]!); // i bet most didn’t know this fact about discord tokens

process.title = "The Fire Bot (riskymh.dev)";

initDb();

process.on('uncaughtException', (err) => {
    console.error(`Unhandled Exception: ${err}`);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

const rest = new REST({ version: "10" }).setToken(token);
const gateway = new WebSocketManager({
    token,
    intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages | GatewayIntentBits.MessageContent | GatewayIntentBits.GuildMembers,
    rest,
    shardCount: null,
});

const client = new Client({ rest, gateway });

client.on(GatewayDispatchEvents.GuildDelete, async ({ data: guild, api }) => {
    if (!guild.id) return;
    await removeGuild(guild.id);
});

client.on(GatewayDispatchEvents.GuildMemberRemove, async ({ data: member, api }) => {
    if (!member.guild_id || !member.user?.id) return;
    await removeUserTimezone(member.guild_id, member.user.id);
});

client.on(GatewayDispatchEvents.MessageCreate, async ({ data: message, api }) => {
    try {
        let lowerContent = (message.content || '').toLowerCase();
        if ((lowerContent === 'hi' || lowerContent === 'hello')) {
            await api.channels.addMessageReaction(message.channel_id, message.id, '👋');
            return;
        }

        countingModule: {
            if (!message.guild_id || !message.channel_id || message.author?.bot) break countingModule;
            const counting = await getCounting(message.channel_id);
            if (!counting) break countingModule;

            const { count, highscore, last_msg } = counting;
            let lastUser = last_msg?.author_id;

            if (lowerContent.includes('what is the count') || lowerContent.includes('what are we up to')) {
                await api.channels.createMessage(message.channel_id, {
                    content: `We are up to ${count.toLocaleString()}, so next number is **${(count + 1).toLocaleString()}!**`,
                    message_reference: { message_id: message.id }
                });
                break countingModule;
            }

            // Respond to cheaty emoji
            if (message.content?.includes('☑️') || message.content?.includes('✅')) {
                await api.channels.addMessageReaction(message.channel_id, message.id, '🤨');
                break countingModule;
            }

            const num = Number.parseInt(message.content);
            if (isNaN(num) || !num || num === 0) break countingModule;
            if (lastUser && (message.author.id === lastUser)) {
                await api.channels.createMessage(message.channel_id, {
                    content: `⚠️ <@${message.author.id}> Wait for someone else to send **${(count + 1).toLocaleString()}.**`,
                    message_reference: { message_id: message.id }
                });
                await api.channels.addMessageReaction(message.channel_id, message.id, '⚠️');
                break countingModule;
            }
            if (num === count + 2 || num === count) {
                await api.channels.createMessage(message.channel_id, {
                    content: `⚠️ <@${message.author.id}> You're close, but you actually need to send **${(count + 1).toLocaleString()}.**`,
                    message_reference: { message_id: message.id }
                });
                await api.channels.addMessageReaction(message.channel_id, message.id, '⚠️');
                break countingModule;
            }
            if (num !== count + 1) {
                const punishmentNumber = Math.max(0, Math.min(Math.round(count * (1 - count > 25 ? 0.15 : 0.5)), count - 1));
                await updateCounting(message.channel_id, { count: punishmentNumber, last_msg: null });
                await api.channels.createMessage(message.channel_id, {
                    content: `⚠️ <@${message.author.id}> RUINED IT AT **${count.toLocaleString()}**!! Now next number is **${punishmentNumber + 1}.**`,
                    message_reference: { message_id: message.id }
                });
                await api.channels.addMessageReaction(message.channel_id, message.id, '❌');
                break countingModule;
            }

            let nextMsg = { message_id: message.id, author_id: message.author.id, number: num };
            await updateCounting(message.channel_id, {
                count: count + 1,
                highscore: Math.max(highscore ?? 0, count + 1),
                last_msg: nextMsg
            });
            await api.channels.addMessageReaction(message.channel_id, message.id, highscore ?? 0 <= count + 1 ? '✅' : '☑️');
        }
    } catch (err) {
        console.error(`Error handling messageCreate: ${err}`);
    }
});

client.on(GatewayDispatchEvents.MessageDelete, async ({ data: msgDelete, api }) => {
    try {
        const channelId = msgDelete.channel_id;
        const counting = await getCounting(channelId);
        if (!counting) return;
        let latest = counting.last_msg;
        if (!latest || latest.message_id !== msgDelete.id) return;
        await api.channels.createMessage(channelId, {
            content: `<@${latest.author_id}> why u delete **"${latest.number.toLocaleString()}"**?`
        });
    } catch (err) {
        console.error(`Error handling messageDelete: ${err}`)
    };
});

client.on(GatewayDispatchEvents.MessageUpdate, async ({ data: msgUpdate, api }) => {
    try {
        const channelId = msgUpdate.channel_id;
        const counting = await getCounting(channelId);
        if (!counting) return;
        let latest = counting.last_msg;
        if (!latest || latest.message_id !== msgUpdate.id) return;
        const newNumber = Number.parseInt(msgUpdate.content);
        if (isNaN(newNumber) || newNumber === latest.number) return;
        await api.channels.createMessage(channelId, {
            content: `<@${latest.author_id}> why change ur msg from **"${latest.number.toLocaleString()}"**?`
        });
    } catch (err) { console.error(`Error handling messageUpdate: ${err}`) }
});

type OptionValue = string | number | boolean;
type OptionsRecord = Record<string, OptionValue>;
function flattenOptions(opts?: APIApplicationCommandInteractionDataOption[]): OptionsRecord {
    const result: OptionsRecord = {};
    if (!opts) return result;
    for (const opt of opts) {
        if ("value" in opt) result[opt.name] = opt.value;
    }
    return result;
}

function getSubcommandAndOptions(data: APIChatInputApplicationCommandInteractionData): {
    subcommand: string | null;
    subcommandGroup: string | null;
    options: OptionsRecord;
} {
    for (const option of data.options || []) {
        if (option.type === ApplicationCommandOptionType.Subcommand) {
            return { subcommand: option.name, subcommandGroup: null, options: flattenOptions(option.options) };
        } else if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
            for (const sub of option.options || []) {
                if (sub.type === ApplicationCommandOptionType.Subcommand) {
                    return { subcommand: sub.name, subcommandGroup: option.name, options: flattenOptions(sub.options) };
                }
            }
        } else {
            return { subcommand: null, subcommandGroup: null, options: flattenOptions(data.options) };
        }
    }
    return { subcommand: null, subcommandGroup: null, options: {} };
}

function getFocusedAutoCompleteOption(opts: APIApplicationCommandInteractionDataOption[]): APIApplicationCommandInteractionDataOption | null {
    let foundOption: APIApplicationCommandInteractionDataOption | undefined;
    if (ApplicationCommandOptionType.Subcommand === opts[0]?.type) {
        foundOption = opts[0].options?.find(o => 'focused' in o && o.focused);
    }
    else if (ApplicationCommandOptionType.SubcommandGroup === opts?.[0]?.type) {
        foundOption = opts?.[0]?.options?.[0]?.options?.find(o => 'focused' in o && o.focused);
    } else {
        foundOption = opts?.find(o => 'focused' in o && o.focused);
    }
    return foundOption || null;
}


async function generateTimezoneMessage(guildId: string): Promise<RESTPostAPIChannelMessageJSONBody | null> {
    const timezoneRows = await getGuildTimezones(guildId);
    if (!timezoneRows.length) return null;

    const now = Date.now();
    const lines: string[] = [];

    const tzs = timezoneRows
        .reduce((acc: ({ canonical: Timezone; user_ids: string[] })[], r) => {
            const canonical = getTimezones().find(e => e.name === r.timezone);
            if (!canonical) return acc;
            const existing = acc.find(e => e.canonical.name === canonical.name);
            if (existing) {
                existing.user_ids.push(r.user_id);
            } else {
                acc.push({ ...r, user_ids: [r.user_id], canonical });
            }
            return acc;
        }, [])
        .sort((a, b) => a.canonical.offset - b.canonical.offset);


    // sort by offset: so -10 first and 10 last
    for (const row of tzs) {
        const mention = row.user_ids.map(id => `<@${id}>`).join(" ");
        let localTime = "?";
        let offsetStr = "";
        try {
            localTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: row.canonical.name }).format(now);
            offsetStr = new Intl.DateTimeFormat('en-US', { timeZone: row.canonical.name, timeZoneName: 'shortOffset' }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value || '';
        } catch { }
        lines.push(`* \`${localTime}\`  ${offsetStr}  •  ${mention}`);
    }

    // lines.sort();
    const withHowTo = commandIds["timezone"] ? `\n-# Use </timezone set:${commandIds["timezone"]}> to set your own timezone!` : "";
    const result = `### <a:fire_anim:1466557778071126300> Server member timezones:\n` + lines.join("\n") + withHowTo;

    return {
        flags: MessageFlags.IsComponentsV2,
        allowed_mentions: {},
        components: [
            {
                type: ComponentType.Container,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: result,
                    }
                ]
            }
        ],
        content: "",
    }
}

async function updateExistingTimezoneMessage(api: Client["api"]): Promise<void> {
    const guilds = await getTimezoneMessages();
    for (const guild of guilds) {
        const newContent = await generateTimezoneMessage(guild.guild_id);
        if (!newContent) return;
        await api.channels.editMessage(guild.channel_id, guild.message_id, {
            ...newContent,
            allowed_mentions: {},
        }).catch(console.error);
    }
}

const timeTillNextMinute = 60000 - (Date.now() % 60000);
setTimeout(() => {
    updateExistingTimezoneMessage(client.api).catch(console.error);
    setInterval(() => {
        updateExistingTimezoneMessage(client.api).catch(console.error);
    }, 60000);
}, timeTillNextMinute);



client.on(GatewayDispatchEvents.InteractionCreate, async ({ data: interaction, api }) => {
    if (interaction.type === InteractionType.ApplicationCommandAutocomplete && interaction.data?.name === "timezone") {
        const focused = getFocusedAutoCompleteOption(interaction.data.options);
        if (focused?.type !== ApplicationCommandOptionType.String) return;

        const value = typeof focused?.value === "string" ? focused.value.toLowerCase() : "";
        const results = searchTimezones(value)
            .slice(0, 25)
            .map(tz => ({
                name: trim(`[${offsetToString(tz.offset)}] ${tz.displayName} - ${tz.cities?.join(", ") || ""} ${tz.hasDST ? " (DST)" : ""}`, 100),
                value: tz.name
            }))
        await api.interactions.createAutocompleteResponse(interaction.id, interaction.token, { choices: results });
        return;
    }
    if (!interaction.guild_id) return;

    try {
        if (
            interaction.type === InteractionType.ApplicationCommand &&
            interaction.data.type === ApplicationCommandType.ChatInput
        ) {
            switch (interaction.data.name) {
                case "counting": {
                    const { subcommand, options } = getSubcommandAndOptions(interaction.data);
                    const channelId = interaction.channel.id;
                    const guildId = interaction.guild_id;
                    if (subcommand === "set") {
                        const start = Number(options.start) || 0;
                        const highscore = Number(options.highscore) || start || 0;
                        await setCounting(channelId, guildId, start, highscore, undefined);
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `✅ This channel is now a counting channel starting at **${start + 1}**!`,
                        });
                    } else if (subcommand === "unset") {
                        await unsetCounting(channelId);
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `🚫 This channel is no longer a counting channel.`,
                        });
                    } else if (subcommand === "reset") {
                        await resetCounting(channelId, 0);
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `🔄 The count for this channel has been reset to **0**.`,
                        });
                    } else if (subcommand === "view") {
                        const count = await getCounting(channelId);
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: count?.count === count?.highscore ?
                                `🏆 The current count for this channel is **${count?.count || 0}** (current highscore!)` :
                                `🔥 The current count for this channel is **${count?.count || 0}** with a highscore of **${count?.highscore || count?.count || 0}**.`,
                        });
                    }
                    break;
                }
                case "timezone": {
                    const { subcommand, options } = getSubcommandAndOptions(interaction.data);
                    const guildId = interaction.guild_id;
                    const updateTimezoneMessage = async () => {
                        const timezoneMsg = await getGuildTimezoneMessage(guildId);
                        if (!timezoneMsg) return;
                        const newContent = await generateTimezoneMessage(guildId);
                        if (!newContent) return;
                        await api.channels.editMessage(timezoneMsg.channel_id, timezoneMsg.message_id, {
                            ...newContent,
                            allowed_mentions: {},
                        }).catch(console.error);
                    };

                    if (subcommand === "set") {
                        const userId = interaction.user?.id ?? interaction.member?.user?.id;
                        const timezoneInput = typeof options.timezone === 'string' ? options.timezone : undefined;
                        const match = timezoneInput ? findTimezoneMatch(timezoneInput) : undefined;
                        if (!timezoneInput || !match) {
                            await api.interactions.reply(interaction.id, interaction.token, {
                                content: `❌ Invalid timezone. Make sure to use a valid canonical timezone provided by autocomplete.`,
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        await setUserTimezone(guildId, userId ?? '', match.name);
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content:
                                `✅ Your timezone has been set to **${match.displayName}**` +
                                `\n-# (Timezone abbreviation: \`${match.abbr ?? 'N/A'}\`, Offset: \`${offsetToString(match.offset)}\`${match.hasDST ? ', observes DST' : ''})`,
                            flags: MessageFlags.Ephemeral
                        });
                        await updateTimezoneMessage();
                    }
                    else if (subcommand === "remove") {
                        const userId = interaction.user?.id ?? interaction.member?.user?.id;
                        const guildId = interaction.guild_id;
                        if (!guildId) {
                            await api.interactions.reply(interaction.id, interaction.token, {
                                content: `❌ This command can only be used in a server.`,
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }
                        const removed = await removeUserTimezone(guildId, userId ?? '');
                        if (removed) {
                            await api.interactions.reply(interaction.id, interaction.token, {
                                content: `🗑️ Your timezone setting has been removed.`,
                                flags: MessageFlags.Ephemeral
                            });
                            await updateTimezoneMessage();
                        } else {
                            await api.interactions.reply(interaction.id, interaction.token, {
                                content: `ℹ️ You didn't have a timezone set.`,
                                flags: MessageFlags.Ephemeral
                            });
                        }
                    }
                    else if (subcommand === "view") {
                        const guildId = interaction.guild_id;
                        if (!guildId) {
                            await api.interactions.reply(interaction.id, interaction.token, {
                                content: `❌ This command can only be used in a server.`,
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }
                        const result = await generateTimezoneMessage(guildId);
                        if (!result) {
                            await api.interactions.reply(interaction.id, interaction.token, {
                                content: `ℹ️ No members in this server have set a timezone yet! Use "/timezone set" to get started.`,
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }
                        await api.interactions.reply(interaction.id, interaction.token, {
                            ...result,
                            flags: (result.flags || 0) | MessageFlags.Ephemeral,
                            allowed_mentions: {},
                        });
                    }
                    break;
                }
                case "updating-timezone-message": {
                    const guildId = interaction.guild_id;
                    try {
                        const result = await generateTimezoneMessage(guildId);
                        if (!result) {
                            await api.interactions.reply(interaction.id, interaction.token, {
                                content: `ℹ️ No members in this server have set a timezone yet! Use "/timezone set" to get started.`,
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        const sent = await api.interactions.reply(interaction.id, interaction.token, {
                            ...result,
                            allowed_mentions: {},
                            with_response: true,
                        });

                        const existing = await getGuildTimezoneMessage(guildId);

                        await setGuildTimezoneMessage(guildId, interaction.channel.id, sent?.interaction.response_message_id!);

                        if (existing) {
                            const oldMsg = await api.channels.getMessage(existing.channel_id, existing.message_id).catch(() => null);
                            if (oldMsg) {
                                const msg = `-# \`⚠️\` This message has been replaced by a new one, please refer to the [new message](https://discord.com/channels/${guildId}/${interaction.channel.id}/${sent?.interaction.response_message_id}) for updated timezone info.`
                                if (hasBitfield(oldMsg.flags ?? 0, MessageFlags.IsComponentsV2)) {
                                    await api.channels.editMessage(existing.channel_id, existing.message_id, {
                                        components: oldMsg.components?.concat([{
                                            type: ComponentType.TextDisplay,
                                            content: msg,
                                        }]),
                                        allowed_mentions: {},
                                    }).catch(() => null);
                                } else if (typeof oldMsg.content === "string") {
                                    await api.channels.editMessage(existing.channel_id, existing.message_id, {
                                        content: oldMsg.content + "\n\n" + msg,
                                        allowed_mentions: {},
                                    }).catch(() => null);
                                }
                            }
                        }
                    } catch (err: any) {
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `❌ Failed to create/update timezone message???`,
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    break;
                }
            }
        }
    } catch (err) {
        console.error(`Error handling interactionCreate: ${err}`);
    }
});


const commandIds = {} as Record<string, string>;
client.once(GatewayDispatchEvents.Ready, async (c) => {
    console.log(`${c.data.user.username}#${c.data.user.discriminator} is ready!`);
    applicationId = c.data.user.id;

    const commandsRes = await c.api.applicationCommands.bulkOverwriteGlobalCommands(c.data.user.id, [
        {
            name: "counting",
            description: "Configure counting channels",
            type: ApplicationCommandType.ChatInput,
            options: [
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: "set",
                    description: "Set this channel as a counting channel",
                    options: [
                        {
                            type: ApplicationCommandOptionType.Integer,
                            name: "start",
                            description: "The starting number for the counting channel (default: 0)",
                            required: false,
                            min_value: 0,
                        },
                        {
                            type: ApplicationCommandOptionType.Integer,
                            name: "highscore",
                            description: "The high score for the counting channel (default: 0)",
                            required: false,
                            min_value: 0,
                        },
                    ]
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: "unset",
                    description: "Unset the counting channel",
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: "reset",
                    description: "Reset the counting channel",
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: "view",
                    description: "View the current count in the counting channel",
                },
            ],
            default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
            integration_types: [ApplicationIntegrationType.GuildInstall],
            contexts: [InteractionContextType.Guild],
        },
        {
            name: "timezone",
            description: "Configure your timezone to show",
            type: ApplicationCommandType.ChatInput,
            options: [
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: "set",
                    description: "Set your timezone",
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: "timezone",
                            description: "Your current timezone that you want to set to be shown publically",
                            required: true,
                            autocomplete: true,
                        },
                    ]
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: "remove",
                    description: "Unset your timezone",
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: "view",
                    description: "View all user's timezones in this server",
                },
            ],
            integration_types: [ApplicationIntegrationType.GuildInstall],
            contexts: [InteractionContextType.Guild],
        },
        {
            name: "updating-timezone-message",
            description: "Create a updating message showing the current time in all users' timezones (only one per server)",
            type: ApplicationCommandType.ChatInput,
            options: [],
            default_member_permissions: PermissionFlagsBits.PinMessages.toString(),
            integration_types: [ApplicationIntegrationType.GuildInstall],
            contexts: [InteractionContextType.Guild],
        },
    ]);

    for (const cmd of commandsRes) {
        commandIds[cmd.name] = cmd.id;
    }

    updateExistingTimezoneMessage(client.api).catch(console.error);
});


function offsetToString(offset: number): string {
    if (offset === 0) return "UTC±0";
    const sign = offset > 0 ? "+" : "-";
    const hours = Math.floor(Math.abs(offset));
    const minutes = Math.round((Math.abs(offset) - hours) * 60);
    return `UTC${sign}${hours.toString().padStart(0, '0')}${minutes === 0 ? '' : `:${minutes.toString().padStart(2, '0')}`}`;
}


function findTimezoneMatch(z: string): Timezone | undefined {
    if (!z) return undefined;
    const input = String(z).trim().toLowerCase();
    const exact = getTimezones().find(tz =>
        tz.name.toLowerCase() === input
    );
    if (exact) return exact;
    return searchTimezones(input)[0];
}

function searchTimezones(query: string): Timezone[] {
    const input = String(query).trim().toLowerCase();
    // todo make this smarter and somehow make some give more search ranging like name === query is instant match but others less so
    return getTimezones().filter(tz =>
        tz.name.toLowerCase().includes(input) ||
        tz.displayName.toLowerCase().includes(input) ||
        tz.abbr.toLowerCase().includes(input) ||
        tz.offset.toString() === input ||
        offsetToString(tz.offset) === input ||
        (tz.cities && tz.cities.some((u: string) => u.toLowerCase().includes(input))) ||
        (tz.country && tz.country.toLowerCase().includes(input))
    ).sort((a, b) => {
        const aPopular = a.popular ? 1 : 0;
        const bPopular = b.popular ? 1 : 0;
        if (aPopular !== bPopular) return bPopular - aPopular;
        return 0;
    })
};

const trim = (str: string, max: number) => str.length > max ? str.slice(0, max - 1) + "…" : str;
const hasBitfield = (flags: number, bitfield: number) => (flags & bitfield) === bitfield;

gateway.connect();
