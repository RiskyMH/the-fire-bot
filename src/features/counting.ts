import { ApplicationCommandType, GatewayDispatchEvents, InteractionType, MessageFlags } from "discord-api-types/v10";
import type { EventModule } from "../feature";
import { getCounting } from "../db";
import { getSubcommandAndOptions } from "../utils";

const useCustomEmoji = true;

const countingModule: EventModule = {
    name: "counting",
    handlers: {
        [GatewayDispatchEvents.MessageCreate]: async ({ data: message, api, db }) => {
            if (!message.guild_id || message.author?.bot) return;
            const counting = await getCounting(message.channel_id);
            if (!counting) return;

            const { count, highscore, last_msg } = counting;
            let lastUser = last_msg?.author_id;

            let lowerContent = (message.content || '').toLowerCase();
            if (lowerContent.includes('what is the count') || lowerContent.includes('what are we up to')) {
                await api.channels.createMessage(message.channel_id, {
                    content: `We are up to ${count.toLocaleString()}, so next number is **${(count + 1).toLocaleString()}!**`,
                    message_reference: { message_id: message.id }
                });
                return;
            }

            // Respond to cheaty emojis
            if (message.content?.includes('☑️') || message.content?.includes('✅')) {
                // hopefully be cheaty only after the normal tick reaction is added
                setTimeout(api.channels.addMessageReaction.bind(null, message.channel_id, message.id, '🤨'), 200);
                // intentionally not breaking here so that it also checks the number but still reacts with the cheaty emoji
            }

            const num = Number.parseInt(message.content.replaceAll(',', ''));
            if (isNaN(num) || !num || num === 0) return;
            if (lastUser && last_msg?.failed !== true && (message.author.id === lastUser)) {
                await api.channels.createMessage(message.channel_id, {
                    content: `⚠️ <@${message.author.id}> Wait for someone else to send **${(count + 1).toLocaleString()}.**`,
                    message_reference: { message_id: message.id }
                });
                // await api.channels.addMessageReaction(message.channel_id, message.id, '⚠️');
                await api.channels.addMessageReaction(message.channel_id, message.id, useCustomEmoji ? 'warning:1483352438525399081' : '⚠️');
                return;
            }
            if (num === count + 2 || num === count) {
                await api.channels.createMessage(message.channel_id, {
                    content: `⚠️ <@${message.author.id}> You're close, but you actually need to send **${(count + 1).toLocaleString()}.**`,
                    message_reference: { message_id: message.id }
                });
                // await api.channels.addMessageReaction(message.channel_id, message.id, '⚠️');
                await api.channels.addMessageReaction(message.channel_id, message.id, useCustomEmoji ? 'warning:1483352438525399081' : '⚠️');
                return;
            }
            if (num !== count + 1) {
                if (lastUser && last_msg?.failed && (message.author.id === lastUser)) {
                    // don't let them get away with 2 failes in a row - just ignore them
                    await api.channels.addMessageReaction(message.channel_id, message.id, useCustomEmoji ? 'cross:1483351988199620648' : '❌');
                    return;
                }

                const punishmentNumber = Math.max(
                    // dont let it go negative
                    0,
                    Math.min(
                        Math.max(
                            // do either how much they were off by or % based on the count (to not fully die)
                            (count - Math.round(Math.abs(count - num) * ((Math.random() * 2) + 1.35))),
                            Math.round(count * (1 - (count > 25 ? 0.15 : 0.5))),
                        ),
                        // always at least punish a little bit
                        count - 1
                    )
                );
                let nextMsg = { message_id: message.id, author_id: message.author.id, number: num, failed: true };
                await db.updateCounting(message.channel_id, { count: punishmentNumber, last_msg: nextMsg });
                await api.channels.createMessage(message.channel_id, {
                    content: `⚠️ <@${message.author.id}> RUINED IT AT **${count.toLocaleString()}**!! Now next number is **${punishmentNumber + 1}.**`,
                    message_reference: { message_id: message.id }
                });
                // await api.channels.addMessageReaction(message.channel_id, message.id, '❌');
                await api.channels.addMessageReaction(message.channel_id, message.id, useCustomEmoji ? 'cross:1483351988199620648' : '❌');
                return;
            }

            let nextMsg = { message_id: message.id, author_id: message.author.id, number: num };
            await db.updateCounting(message.channel_id, {
                count: count + 1,
                highscore: Math.max(highscore ?? 0, count + 1),
                last_msg: nextMsg
            });
            await api.channels.addMessageReaction(message.channel_id, message.id,
                // (highscore ?? 0) <= (count + 1) ? '☑️' : '✅'
                (highscore ?? 0) <= (count + 1) ? (useCustomEmoji ? 'fire_anim:1466557778071126300' : '☑️') : (useCustomEmoji ? 'fire:1281081113338450012' : '✅')
            );
        },
        [GatewayDispatchEvents.MessageUpdate]: async ({ data: message, api, db }) => {
            const channelId = message.channel_id;
            const counting = await getCounting(channelId);
            if (!counting) return;
            let latest = counting.last_msg;
            if (!latest || latest.message_id !== message.id) return;
            const newNumber = Number.parseInt(message.content);
            if (isNaN(newNumber) || newNumber === latest.number) return;
            await api.channels.createMessage(channelId, {
                content: `<@${latest.author_id}> why change ur msg from **"${latest.number.toLocaleString()}"**?`
            });
        },
        [GatewayDispatchEvents.MessageDelete]: async ({ data: message, api, db }) => {
            const channelId = message.channel_id;
            const counting = await getCounting(channelId);
            if (!counting) return;
            let latest = counting.last_msg;
            if (!latest || latest.message_id !== message.id) return;
            await api.channels.createMessage(channelId, {
                content: `<@${latest.author_id}> why u delete **"${latest.number.toLocaleString()}"**?`
            });
        },
        [GatewayDispatchEvents.MessageDeleteBulk]: async ({ data: { ids, channel_id }, api, db }) => {
            const counting = await getCounting(channel_id);
            if (!counting) return;
            let latest = counting.last_msg;
            if (!latest || !ids.includes(latest.message_id)) return;
            await api.channels.createMessage(channel_id, {
                content: `<@${latest.author_id}> why u delete **"${latest.number.toLocaleString()}"**?`
            });
        },
        [GatewayDispatchEvents.ChannelDelete]: async ({ data: channel, api, db }) => {
            // @ts-expect-error - somehow the types are broken for channel*
            if (!channel.guild_id || !channel.id) return;
            // @ts-expect-error - somehow the types are broken for channel*
            await db.removeCountingByChannelId(channel.guild_id, channel.id);
        },
        [GatewayDispatchEvents.InteractionCreate]: async ({ data: interaction, api, db, commandIds }) => {
            if (!interaction.guild_id) return;
            if (
                interaction.type === InteractionType.ApplicationCommand &&
                interaction.data.type === ApplicationCommandType.ChatInput && 
                interaction.data.name === "counting"
            ) {
                const { subcommand, options } = getSubcommandAndOptions(interaction.data);
                const channelId = interaction.channel.id;
                const guildId = interaction.guild_id;
                if (subcommand === "set") {
                    const start = Number(options.start) || 0;
                    const highscore = Number(options.highscore) || start || 0;
                    await db.setCounting(channelId, guildId, start, highscore, undefined);
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `✅ This channel is now a counting channel starting at **${start + 1}**!`,
                    });
                } else if (subcommand === "unset") {
                    await db.unsetCounting(channelId);
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `🚫 This channel is no longer a counting channel.`,
                    });
                } else if (subcommand === "reset") {
                    await db.resetCounting(channelId, 0);
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `🔄 The count for this channel has been reset to **0**.`,
                    });
                } else if (subcommand === "view") {
                    const count = await db.getCounting(channelId);
                    if (!count) {
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `ℹ️ This channel is not a counting channel yet. Use </counting set:${commandIds.counting}> to set it up!`,
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: count.count === count.highscore ?
                            `🏆 The current count for this channel is **${count?.count || 0}** (current highscore!)` :
                            `🔥 The current count for this channel is **${count?.count || 0}** with a highscore of **${count?.highscore || count?.count || 0}**.`,
                    });
                }
            }
        },
    },
};

export default countingModule;
