import { ApplicationCommandType, ComponentType, GatewayDispatchEvents, GuildMemberFlags, InteractionType, MessageFlags, PermissionFlagsBits, TextInputStyle, type APIModalInteractionResponseCallbackData } from "discord-api-types/v10";
import type { EventModule } from "../feature.ts";
import { getSubcommandAndOptions, hasBitfield, hasBitfield2 } from "../utils.ts";

const forceNickModule: EventModule = {
    name: "force-nick",
    handlers: {
        [GatewayDispatchEvents.GuildMemberUpdate]: async ({ data: member, api, db }) => {
            const forcedNick = await db.getForceNick(member.guild_id, member.user.id);
            if (forcedNick && member.nick != forcedNick) {
                try {
                    await api.guilds.editMember(member.guild_id, member.user.id, { nick: forcedNick }, { reason: "force-nick active" })
                } catch (err) {
                    console.error(`Failed to force nick for user: ${err}`);
                }
            }
        },
        // [GatewayDispatchEvents.GuildMemberRemove]: async ({ data: member, api, db }) => {
        //     await db.removeForceNick(member.guild_id, member.user.id);
        // },
        [GatewayDispatchEvents.InteractionCreate]: async ({ data: interaction, api, db, commandIds }) => {
            if (!interaction.guild_id) return;
            if (
                interaction.type === InteractionType.ApplicationCommand &&
                interaction.data.type === ApplicationCommandType.ChatInput &&
                interaction.data.name === "force-nick"
            ) {
                const { options } = getSubcommandAndOptions(interaction.data);
                const userId = options.user as string;
                if (!hasBitfield2(interaction.app_permissions, PermissionFlagsBits.ManageNicknames)) {
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `❌ I need Manage Nicknames permission to force nicknames!`,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                const member = interaction.data.resolved?.members?.[userId];
                const user = interaction.data.resolved?.users?.[userId];
                if (!member) {
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `❌ The specified user is not in this server!`,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const forcedNick = await db.getForceNick(interaction.guild_id, userId);

                const modal: APIModalInteractionResponseCallbackData = {
                    title: "Force Nickname",
                    custom_id: `force_nick:${userId}`,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: `Configure the forced nickname for <@${userId}>`
                                + "\n-# - Any edits they do to this role will be reverted by the bot" +
                                (forcedNick
                                    ? `\n-# - Their current forced nickname is **${forcedNick}**` :
                                    `\n-# - Their current username is **@${user?.username}**${member.nick ? ` (${member.nick})` : ""} and they don't have a forced nickname yet`
                                )
                        },
                        {
                            type: ComponentType.Label,
                            label: "Nickname",
                            description: "The nickname to force on the user. Leave blank to unset.",
                            component: {
                                type: ComponentType.TextInput,
                                style: TextInputStyle.Short,
                                custom_id: "nickname",
                                required: false,
                                min_length: 1,
                                max_length: 32,
                                value: forcedNick ?? undefined,
                            }
                        }
                    ]
                }
                await api.interactions.createModal(interaction.id, interaction.token, modal);
            } else if (interaction.type === InteractionType.ModalSubmit && interaction.data.custom_id.startsWith("force_nick:")) {
                const userId = interaction.data.custom_id.split(":")[1]!;
                const guildId = interaction.guild_id!;
                let nickname: string | null = null;

                for (const component of interaction.data.components) {
                    if (component.type === ComponentType.Label && component.component.custom_id === "nickname") {
                        const nicknameInput = component.component;
                        if (nicknameInput.type === ComponentType.TextInput) {
                            nickname = nicknameInput.value.trim() || null;
                        }
                    }
                }

                if (nickname) {
                    try {
                        await api.guilds.editMember(guildId, userId, { nick: nickname }, { reason: "force-nick set" });
                    } catch (err) {
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `❌ Failed to set nickname, please ensure I have permissions to do this.`,
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    await db.setForceNick(guildId, userId, nickname);
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `✅ <@${userId}> will now be forced to have the nickname **${nickname}**.`,
                        allowed_mentions: {}
                    });
                    return;
                }

                await db.removeForceNick(guildId, userId);
                await api.interactions.reply(interaction.id, interaction.token, {
                    content: `🗑️ <@${userId}> no longer has a forced nickname.`,
                    allowed_mentions: {}
                });
                try {
                    await api.guilds.editMember(guildId, userId, { nick: null }, { reason: "force-nick unset" });
                } catch (err) {
                    console.error(`Failed to reset nick for user: ${err}`);
                }
            }

        },
    },
};

export default forceNickModule;
