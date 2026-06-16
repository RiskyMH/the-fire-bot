import { ApplicationCommandType, ChannelType, ComponentType, GatewayDispatchEvents, GuildMemberFlags, InteractionType, MessageFlags, PermissionFlagsBits, SelectMenuDefaultValueType, type APIModalInteractionResponseCallbackData } from "discord-api-types/v10";
import type { EventModule } from "../feature.ts";
import { getSubcommandAndOptions, hasBitfield, hasBitfield2 } from "../utils.ts";

const guildActionsModule: EventModule = {
    name: "guild-actions",
    handlers: {
        [GatewayDispatchEvents.GuildRoleDelete]: async ({ data: role, api, db }) => {
            await db.removeGuildActionsRoleByRoleId(role.guild_id, role.role_id);
        },
        [GatewayDispatchEvents.ChannelDelete]: async ({ data: channel, api, db }) => {
            if (!channel.guild_id || !channel.id) return;
            await db.removeGuildActionsLogByChannelId(channel.guild_id, channel.id);
        },
        [GatewayDispatchEvents.GuildMemberAdd]: async ({ data: member, api, db }) => {
            const guildActions = await db.getGuildActions(member.guild_id);
            if (guildActions?.log_channel_id) {
                try {
                    await api.channels.createMessage(guildActions.log_channel_id, {
                        content: `:tada: <@${member.user.id}> has joined!` + (hasBitfield(member.flags, GuildMemberFlags.DidRejoin) ? " (again)" : ""),
                        allowed_mentions: {},
                    });
                } catch (err) {
                    console.error(`Failed to create join message: ${err}`);
                }
            }
        },
        [GatewayDispatchEvents.GuildMemberRemove]: async ({ data: member, api, db }) => {
            const guildActions = await db.getGuildActions(member.guild_id);
            if (guildActions?.log_channel_id) {
                try {
                    await api.channels.createMessage(guildActions.log_channel_id, {
                        content: `:sob: <@${member.user.id}> has left.`,
                        allowed_mentions: {},
                    });
                } catch (err) {
                    console.error(`Failed to create leave message: ${err}`);
                }
            }
        },
        [GatewayDispatchEvents.GuildMemberUpdate]: async ({ data: member, api, db }) => {
            const guildActions = await db.getGuildActions(member.guild_id);
            if (
                guildActions?.join_role_id
                && !member.roles.includes(guildActions.join_role_id)
                && member.flags && hasBitfield(member.flags, GuildMemberFlags.CompletedOnboarding)
            ) {
                try {
                    await api.guilds.addRoleToMember(member.guild_id, member.user.id, guildActions.join_role_id, { reason: "user completed onboarding" })
                } catch (err) {
                    console.error(`Failed to add join role to user: ${err}`);
                }
            }
        },
        [GatewayDispatchEvents.InteractionCreate]: async ({ data: interaction, api, db, commandIds }) => {
            if (!interaction.guild_id) return;
            if (
                interaction.type === InteractionType.ApplicationCommand &&
                interaction.data.type === ApplicationCommandType.ChatInput &&
                interaction.data.name === "welcome-actions"
            ) {

                const guildActions = await db.getGuildActions(interaction.guild_id);
                const modal: APIModalInteractionResponseCallbackData = {
                    title: "Welcome Actions",
                    custom_id: `welcome_actions:${interaction.guild_id}`,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: "Configure the welcome actions for this server." +
                                "\n-# - You can set a role to give to users when they complete onboarding (ie accepted rules)." +
                                "\n-# - You can set a channel for the bot to send join/leave messages.",
                        },
                        {
                            type: ComponentType.Label,
                            label: "Role to give (optional)",
                            description: "The role to give new members when they complete onboarding.",
                            component: {
                                type: ComponentType.RoleSelect,
                                custom_id: "role",
                                placeholder: "@member",
                                default_values: guildActions?.join_role_id
                                    ? [{ type: SelectMenuDefaultValueType.Role, id: guildActions.join_role_id }]
                                    : undefined,
                                required: false,
                                max_values: 1,
                                min_values: 0,
                            },
                        },
                        {
                            type: ComponentType.Label,
                            label: "Welcome log channel (optional)",
                            description: "The channel to send join/leave messages.",
                            component: {
                                type: ComponentType.ChannelSelect,
                                custom_id: "channel",
                                placeholder: "#moderation-logs",
                                channel_types: [
                                    ChannelType.GuildText,
                                    ChannelType.GuildAnnouncement,
                                    ChannelType.PublicThread,
                                    ChannelType.PrivateThread,
                                    ChannelType.AnnouncementThread,
                                ],
                                default_values: guildActions?.log_channel_id
                                    ? [{ type: SelectMenuDefaultValueType.Channel, id: guildActions.log_channel_id }]
                                    : undefined,
                                required: false,
                                max_values: 1,
                                min_values: 0,
                            },
                        },
                    ]
                }
                await api.interactions.createModal(interaction.id, interaction.token, modal);
            } else if (
                interaction.type === InteractionType.ModalSubmit &&
                interaction.data.custom_id.startsWith("welcome_actions:")
            ) {
                const guildId = interaction.guild_id;
                let roleId: string | null = null;
                let channelId: string | null = null;
                for (const component of interaction.data.components) {
                    if (component.type === ComponentType.Label) {
                        if (component.component.custom_id === "role") {
                            const roleSelect = component.component;
                            if (roleSelect.type === ComponentType.RoleSelect) {
                                roleId = roleSelect.values?.[0] || null;
                            }
                        } else if (component.component.custom_id === "channel") {
                            const channelSelect = component.component;
                            if (channelSelect.type === ComponentType.ChannelSelect) {
                                channelId = channelSelect.values?.[0] || null;
                            }
                        }
                    }
                }

                const currentGuildActions = await db.getGuildActions(guildId);

                if (!roleId && !channelId) {
                    await db.removeGuildActions(guildId);
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `🗑️ Welcome actions have been removed.`,
                        allowed_mentions: {},
                    });
                    return;
                }

                if (roleId) {
                    if (!hasBitfield2(interaction.app_permissions, PermissionFlagsBits.ManageRoles)) {
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `❌ I need Manage Roles permission to set a welcome role.`,
                            flags: MessageFlags.Ephemeral,
                            allowed_mentions: {},
                        });
                        return;
                    }
                    const role = interaction.data.resolved?.roles?.[roleId as string];
                    if (role?.managed) {
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `❌ I cannot set a bot role as a welcome role.`,
                            flags: MessageFlags.Ephemeral,
                            allowed_mentions: {},
                        });
                        return;
                    }
                }
                if (channelId && !currentGuildActions?.log_channel_id) {
                    try {
                        await api.channels.createMessage(channelId as string, {
                            content: `This channel has been set as the welcome channel for this server! I'll send join/leave messages here when users complete onboarding.`,
                            allowed_mentions: {},
                        });
                    } catch (err) {
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `❌ I need Send Messages permission to set a welcome channel.`,
                            flags: MessageFlags.Ephemeral,
                            allowed_mentions: {},
                        });
                        return;
                    }
                }

                await db.setGuildActions(guildId, { join_role_id: roleId as string || null, log_channel_id: channelId as string || null });
                await api.interactions.reply(interaction.id, interaction.token, {
                    content: `✅ Welcome actions have been updated!` +
                        (roleId ? ` New members will be given <@&${roleId}> role when they complete onboarding.` : "") +
                        (channelId ? ` Join/leave messages will be sent in <#${channelId}>.` : ""),
                    allowed_mentions: {}
                });
            }

        },
    },
};

export default guildActionsModule;
