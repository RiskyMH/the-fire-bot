import { ApplicationCommandOptionType, ApplicationCommandType, ComponentType, GatewayDispatchEvents, InteractionType, MessageFlags, type RESTPostAPIChannelMessageJSONBody } from "discord-api-types/v10";
import type { EventModule } from "../feature";
import { getFocusedAutoCompleteOption, getSubcommandAndOptions, hasBitfield, trim } from "../utils";

import { getTimeZones, type Timezone } from "../timezones" with {type: "macro"};
import type { API } from "@discordjs/core";
const _timezones = getTimeZones();
const timezones = _timezones;

const timezoneModule: EventModule = {
    name: "timezone",
    handlers: {
        [GatewayDispatchEvents.Ready]: async ({ data, api, db, commandIds }) => {
            const timeTillNextMinute = 60000 - (Date.now() % 60000);
            await updateExistingTimezoneMessage(api, db, commandIds).catch(console.error);
            setTimeout(() => {
                updateExistingTimezoneMessage(api, db, commandIds).catch(console.error);
                setInterval(() => {
                    updateExistingTimezoneMessage(api, db, commandIds).catch(console.error);
                }, 60_000);
            }, timeTillNextMinute);
        },
        [GatewayDispatchEvents.MessageDelete]: async ({ data: message, api, db }) => {
            await db.removeGuildTimezoneMessageByMsgId(message.guild_id!, message.id);
        },
        [GatewayDispatchEvents.GuildMemberRemove]: async ({ data: member, api, db }) => {
            await db.removeUserTimezone(member.guild_id, member.user.id);
        },
        [GatewayDispatchEvents.ChannelDelete]: async ({ data: channel, api, db }) => {
            if (!channel.guild_id || !channel.id) return;
            await db.removeGuildTimezoneMessageByChannelId(channel.guild_id, channel.id);
        },
        [GatewayDispatchEvents.InteractionCreate]: async ({ data: interaction, api, db, commandIds }) => {
            if (!interaction.guild_id) return;

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

            if (
                interaction.type === InteractionType.ApplicationCommand &&
                interaction.data.type === ApplicationCommandType.ChatInput
            ) {
                if (interaction.data.name === "timezone") {
                    const { subcommand, options } = getSubcommandAndOptions(interaction.data);
                    const guildId = interaction.guild_id;
                    const updateTimezoneMessage = async () => {
                        const timezoneMsg = await db.getGuildTimezoneMessage(guildId);
                        if (!timezoneMsg) return;
                        const newContent = await generateTimezoneMessage(db, guildId, null, commandIds);
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

                        await db.setUserTimezone(guildId, userId ?? '', match.name);
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content:
                                `✅ Your timezone has been set to **${match.displayName}**` +
                                `\n-# (Timezone abbreviation: \`${match.abbr ?? 'N/A'}\`, Offset: \`${offsetToString(match.offset)}\`${match.hasDST ? ', observes DST' : ''})`,
                            // flags: MessageFlags.Ephemeral
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
                        const removed = await db.removeUserTimezone(guildId, userId ?? '');
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
                        const userid = typeof options.highlight === 'string' ? options.highlight : interaction.user?.id ?? interaction.member?.user?.id;
                        const result = await generateTimezoneMessage(db, guildId, userid, commandIds);
                        if (!result) {
                            await api.interactions.reply(interaction.id, interaction.token, {
                                content: `ℹ️ No members in this server have set a timezone yet! Use "/timezone set" to get started.`,
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }
                        await api.interactions.reply(interaction.id, interaction.token, {
                            ...result,
                            // flags: (result.flags || 0) | MessageFlags.Ephemeral,
                            allowed_mentions: {},
                        });
                    }
                    else if (subcommand === "compare") {
                        const requesterId = interaction.member!.user.id;
                        const userId1 = options.user as string;
                        const userId2: string = typeof options.user2 === 'string' ? options.user2 : requesterId;

                        const guildId = interaction.guild_id;
                        if (!guildId) {
                            await api.interactions.reply(interaction.id, interaction.token, {
                                content: `❌ This command can only be used in a server.`,
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        const tz1 = await db.getUserTimezone(guildId, userId1);
                        if (!tz1) {
                            const mention = commandIds?.['timezone set'] ? `</timezone set:${commandIds['timezone set']}>` : '"/timezone set"';
                            await api.interactions.reply(interaction.id, interaction.token, {
                                content: `ℹ️ <@${userId1}> doesn't have a timezone set yet! They should use ${mention} to get started.`,
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        const tz2 = await db.getUserTimezone(guildId, userId2);
                        if (!tz2) {
                            const mention = commandIds?.['timezone set'] ? `</timezone set:${commandIds['timezone set']}>` : '"/timezone set"';
                            const isSelf = userId2 === requesterId;
                            await api.interactions.reply(interaction.id, interaction.token, {
                                content: `ℹ️ ${isSelf ? "You haven't" : `<@${userId2}> hasn't`} set a timezone yet! ${isSelf ? "You" : "They"} should use ${mention} to get started.`,
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        const match1 = timezones.find(tz => tz.name === tz1);
                        const match2 = timezones.find(tz => tz.name === tz2);
                        if (!match1 || !match2) return;

                        const now = Date.now();
                        const fmtTime = (tz: Timezone) => {
                            const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz.name }).format(now);
                            const offsetStr = new Intl.DateTimeFormat('en-US', { timeZone: tz.name, timeZoneName: 'shortOffset' }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value || '';
                            const offsetMatch = offsetStr.match(/([+-])(\d+)(?::(\d+))?/);
                            const offsetNum = offsetMatch
                                ? parseInt(offsetMatch[1]! + offsetMatch[2]!) + (parseInt(offsetMatch[3] ?? "0") / 60)
                                : tz.offset;
                            return { time, offsetStr, offsetNum };
                        };

                        const r1 = fmtTime(match1);
                        const r2 = fmtTime(match2);

                        const diffMinutes = Math.round((r2.offsetNum - r1.offsetNum) * 60);
                        const absDiff = Math.abs(diffMinutes);
                        const diffHours = Math.floor(absDiff / 60);
                        const diffMins = absDiff % 60;
                        const diffStr = diffMinutes === 0
                            ? "the same time"
                            : `**${diffHours > 0 ? `${diffHours} hour${diffHours > 1 ? "s" : ""}` : ""}${diffHours > 0 && diffMins > 0 ? " and " : ""}${diffMins > 0 ? `${diffMins} minute${diffMins > 1 ? "s" : ""}` : ""} ${diffMinutes > 0 ? "ahead" : "behind"}**`;

                        const label1 = match1.abbr && match1.abbr !== offsetToString(match1.offset) ? ` ${match1.abbr}` : "";
                        const label2 = match2.abbr && match2.abbr !== offsetToString(match2.offset) ? ` ${match2.abbr}` : "";
                        const content = [
                            `### Timezone Comparison`,
                            `**<@${userId1}>** — ${match1.displayName} · \`${r1.time}\`${label1} (${r1.offsetStr.replace("GMT", "")})`,
                            `**<@${userId2}>** — ${match2.displayName} · \`${r2.time}\`${label2} (${r2.offsetStr.replace("GMT", "")})`,
                            `-# Time difference: ${diffStr}`
                        ].join("\n");

                        await api.interactions.reply(interaction.id, interaction.token, {
                            content,
                            allowed_mentions: {},
                        });
                    }
                } else if (interaction.data.name === "updating-timezone-message") {
                    const guildId = interaction.guild_id;
                    try {
                        const result = await generateTimezoneMessage(db, guildId, null, commandIds);;
                        if (!result) {
                            await api.interactions.reply(interaction.id, interaction.token, {
                                content: `ℹ️ No members in this server have set a timezone yet! Use ${commandIds?.['timezone set'] ? `</${commandIds['timezone set']}>` : '"/timezone set"'} to get started.`,
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }

                        const sent = await api.interactions.reply(interaction.id, interaction.token, {
                            ...result,
                            allowed_mentions: {},
                            with_response: true,
                        });

                        const existing = await db.getGuildTimezoneMessage(guildId);

                        await db.setGuildTimezoneMessage(guildId, interaction.channel.id, sent?.interaction.response_message_id!);

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
                }
            }

        },
    },
};

export default timezoneModule;


async function generateTimezoneMessage(db: typeof import("../db.ts"), guildId: string, highlightUserId?: string | null, commandIds?: Record<string, string>): Promise<RESTPostAPIChannelMessageJSONBody | null> {
    const timezoneRows = await db.getGuildTimezones(guildId);
    if (!timezoneRows.length) return null;

    const now = Date.now();

    const tzs = timezoneRows
        .sort((a, b) => {
            if (a.user_id.length === b.user_id.length) {
                return a.user_id.localeCompare(b.user_id);
            }
            return a.user_id.length - b.user_id.length;
        })
        .reduce((acc: ({ localTime: string, offsetStr: string, user_ids: string[], offsetNum: number })[], r) => {
            const canonical = timezones.find(e => e.name === r.timezone);
            if (!canonical) return acc;

            let localTime = "?";
            let offsetStr = "";
            try {
                localTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: canonical.name }).format(now);
                offsetStr = new Intl.DateTimeFormat('en-US', { timeZone: canonical.name, timeZoneName: 'shortOffset' }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value || '';
            } catch { }

            const existing = acc.find(e => e.localTime === localTime);
            if (existing) {
                existing.user_ids.push(r.user_id);
            } else {
                acc.push({ ...r, user_ids: [r.user_id], localTime, offsetStr, offsetNum: canonical.offset });
            }
            return acc;
        }, [])
        .sort((a, b) => a.offsetNum - b.offsetNum);

    const lines = tzs.map(row => `* \`${row.localTime}\`  ${row.offsetStr}  •  ${row.user_ids.map(id => id === highlightUserId ? `__***<@${id}>***__` : `<@${id}>`).join(" ")}`);
    const withHowTo = commandIds?.["timezone"]
        ? `\n-# Use </timezone set:${commandIds["timezone"]}> to set your own timezone!`
        : "\n-# Use `/timezone set` to set your own timezone!";
    const result = `### <a:fire:1466557778071126300> Server member timezones:\n` + lines.join("\n") + withHowTo;

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

async function updateExistingTimezoneMessage(api: API, db: typeof import("../db.ts"), commandIds: Record<string, string>): Promise<void> {
    const guilds = await db.getTimezoneMessages();
    for (const guild of guilds) {
        const newContent = await generateTimezoneMessage(db, guild.guild_id, null, commandIds);
        if (!newContent) return;
        await api.channels.editMessage(guild.channel_id, guild.message_id, {
            ...newContent,
            allowed_mentions: {},
        }).catch(console.error);
    }
}

function findTimezoneMatch(z: string): Timezone | undefined {
    if (!z) return undefined;
    const input = String(z).trim().toLowerCase();
    const exact = timezones.find(tz =>
        tz.name.toLowerCase() === input
    );
    if (exact) return exact;
    return searchTimezones(input)[0];
}

function searchTimezones(query: string): Timezone[] {
    const input = String(query).trim().toLowerCase();
    // todo make this smarter and somehow make some give more search ranging like name === query is instant match but others less so
    return timezones.filter(tz =>
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

function offsetToString(offset: number): string {
    if (offset === 0) return "UTC±0";
    const sign = offset > 0 ? "+" : "-";
    const hours = Math.floor(Math.abs(offset));
    const minutes = Math.round((Math.abs(offset) - hours) * 60);
    return `UTC${sign}${hours.toString().padStart(0, '0')}${minutes === 0 ? '' : `:${minutes.toString().padStart(2, '0')}`}`;
}

