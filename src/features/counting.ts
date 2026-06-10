import { ApplicationCommandType, ComponentType, GatewayDispatchEvents, InteractionType, MessageFlags, TextInputStyle, type APIModalInteractionResponseCallbackComponent, type APIModalInteractionResponseCallbackData } from "discord-api-types/v10";
import type { EventModule } from "../feature";
import { getCounting, type ICounting } from "../db";
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
                const count = await db.getCounting(interaction.channel.id);

                const modal: APIModalInteractionResponseCallbackData = {
                    title: "Counting",
                    custom_id: `counting_modal:${interaction.channel.id}`,
                    components: ([
                        {
                            type: ComponentType.TextDisplay,
                            content: `Configure the counting channel <#${interaction.channel.id}>:\n` + (count
                                ? `-# The current count is **${count?.count.toLocaleString()}** with a high score of **${count?.highscore?.toLocaleString() || count?.count.toLocaleString()}**.`
                                : `-# This channel is not a counting channel yet. Use the form below to set it up!`)
                        },
                        {
                            type: ComponentType.Label,
                            label: "Current Count",
                            description: "Set the current count for this counting channel",
                            component: {
                                type: ComponentType.TextInput,
                                custom_id: "current_count",
                                max_length: 10,
                                min_length: 1,
                                style: TextInputStyle.Short,
                                required: !!count,
                                value: count ? count.count?.toLocaleString() || "0" : undefined,
                                placeholder: count?.count?.toLocaleString() || "0"
                            }
                        },
                        {
                            type: ComponentType.Label,
                            label: "High Score",
                            description: "Set the high score for this counting channel",
                            component: {
                                type: ComponentType.TextInput,
                                custom_id: "high_score",
                                max_length: 10,
                                min_length: 1,
                                style: TextInputStyle.Short,
                                required: false,
                                value: count?.highscore?.toLocaleString() || undefined,
                                placeholder: count?.highscore?.toLocaleString() || "0"
                            }
                        },
                        count && {
                            type: ComponentType.Label,
                            label: "Disable Counting",
                            description: "If enabled, the bot will stop counting and reset the data.",
                            component: {
                                type: ComponentType.Checkbox,
                                custom_id: "reset_messages",
                                default: false
                            },
                        },
                    ] satisfies (APIModalInteractionResponseCallbackComponent | false | null)[]).filter(e => !!e)
                };
                await api.interactions.createModal(interaction.id, interaction.token, modal);

            } else if (
                interaction.type === InteractionType.ModalSubmit &&
                interaction.data.custom_id.startsWith("counting_modal:")
            ) {
                const channelId = interaction.channel?.id;
                if (!channelId) return;

                let newCount = 0;
                let newHighScore = 0;
                let resetMessages = false;

                for (const label of interaction.data.components) {
                    if (label.type !== ComponentType.Label) continue;
                    const c = (label).component ?? label;
                    if (!c) continue;
                    if (c.type === ComponentType.TextInput) {
                        if (c.custom_id === "current_count" && c.value) newCount = Number(c.value.replaceAll(',', ''));
                        if (c.custom_id === "high_score" && c.value) newHighScore = Number(c.value.replaceAll(',', ''));
                    } else if (c.type === ComponentType.Checkbox) {
                        if (c.custom_id === "reset_messages") resetMessages = c.value;
                    }
                }

                if (isNaN(newCount) || isNaN(newHighScore)) {
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `❌ Please enter valid numbers for count and high score.`,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                if (resetMessages) {
                    await db.unsetCounting(channelId);
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `🚫 Counting has been disabled for this channel and all data has been reset.`,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                await db.setCounting(channelId, interaction.guild_id, newCount, Math.max(newHighScore, newCount), undefined);
                await api.interactions.reply(interaction.id, interaction.token, {
                    content: `✅ Counting has been updated for this channel! The current count is now **${newCount.toLocaleString()}** with a high score of **${newHighScore.toLocaleString()}**.`,
                    allowed_mentions: {},
                });
            }
        },
    },
};

export default countingModule;
