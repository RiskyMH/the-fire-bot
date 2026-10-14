import { ApplicationCommandType, ComponentType, GatewayDispatchEvents, InteractionType, MessageFlags, PermissionFlagsBits, MessageType, type APIModalInteractionResponseCallbackData } from "discord-api-types/v10";
import type { EventModule } from "../feature";
import { hasBitfield2 } from "../utils";

const useCustomEmoji = true;
const waveEmoji = useCustomEmoji ? 'wave:1483351276862574763' : "👋";
const waveEmojiText = useCustomEmoji ? "<a:wave:1483351276862574763>" : "👋";

const waveModule: EventModule = {
    name: "wave",
    handlers: {
        [GatewayDispatchEvents.MessageCreate]: async ({ data: message, api, db }) => {
            if (!message.guild_id || message.author?.bot) return;
            const config = await db.getWaveConfig(message.guild_id);
            if (!config) return;

            const lowerContent = (message.content || '').toLowerCase();
            const isHi = lowerContent === 'hi' || lowerContent === 'hello';
            const isJoin = message.type === MessageType.UserJoin;

            if ((isHi && config.react_hi) || (isJoin && config.react_join)) {
                try {
                    await api.channels.addMessageReaction(message.channel_id, message.id, waveEmoji);
                } catch (err) {
                    console.error(`Failed to wave in ${message.channel_id}: ${err}`);
                }
            }
        },
        [GatewayDispatchEvents.InteractionCreate]: async ({ data: interaction, api, db }) => {
            if (!interaction.guild_id) return;
            if (
                interaction.type === InteractionType.ApplicationCommand &&
                interaction.data.type === ApplicationCommandType.ChatInput &&
                interaction.data.name === "wave"
            ) {
                const current = await db.getWaveConfig(interaction.guild_id);

                const modal: APIModalInteractionResponseCallbackData = {
                    title: "Auto Wave",
                    custom_id: `wave:${interaction.guild_id}`,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: "Automatically react " + waveEmojiText + " when someone says hi or joins the server." +
                                (current
                                    ? `\n-# - Currently: ${current.react_hi ? "waving at hi's" : "not waving at hi's"}, ${current.react_join ? "waving at join messages" : "not waving at join messages"}.`
                                    : "\n-# - Currently: disabled.")
                            ,
                        },
                        {
                            type: ComponentType.Label,
                            label: "React to hi's",
                            description: "Wave back when someone's message is just hi or hello",
                            component: {
                                type: ComponentType.Checkbox,
                                custom_id: "react_hi",
                                default: !!current?.react_hi,
                            },
                        },
                        {
                            type: ComponentType.Label,
                            label: "React to join messages",
                            description: "Wave at Discord's join messages when someone joins",
                            component: {
                                type: ComponentType.Checkbox,
                                custom_id: "react_join",
                                default: !!current?.react_join,
                            },
                        },
                    ],
                };
                await api.interactions.createModal(interaction.id, interaction.token, modal);
            } else if (
                interaction.type === InteractionType.ModalSubmit &&
                interaction.data.custom_id.startsWith("wave:")
            ) {
                const guildId = interaction.guild_id;
                let reactHi = false;
                let reactJoin = false;

                for (const component of interaction.data.components) {
                    if (component.type !== ComponentType.Label) continue;
                    if (component.component.custom_id === "react_hi" && component.component.type === ComponentType.Checkbox) {
                        reactHi = component.component.value;
                    } else if (component.component.custom_id === "react_join" && component.component.type === ComponentType.Checkbox) {
                        reactJoin = component.component.value;
                    }
                }

                if (!reactHi && !reactJoin) {
                    await db.removeWaveConfig(guildId);
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `🗑️ Auto wave has been disabled.`,
                        allowed_mentions: {},
                    });
                    return;
                }

                const requiredPerms = PermissionFlagsBits.AddReactions | PermissionFlagsBits.UseExternalEmojis;
                if (!hasBitfield2(interaction.app_permissions, requiredPerms)) {
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `❌ I need the **Add Reactions** and **Use External Emojis** permissions for this feature to work.`,
                        flags: MessageFlags.Ephemeral,
                        allowed_mentions: {},
                    });
                    return;
                }

                await db.setWaveConfig(guildId, reactHi, reactJoin);
                await api.interactions.reply(interaction.id, interaction.token, {
                    content: `✅ Auto wave has been updated!` +
                        (reactHi ? ` I'll wave at messages that just say hi.` : "") +
                        (reactJoin ? ` I'll wave at join messages.` : ""),
                    allowed_mentions: {},
                });
            }
        },
    },
};

export default waveModule;
