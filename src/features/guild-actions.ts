import { ApplicationCommandType, GatewayDispatchEvents, GuildMemberFlags, InteractionType, MessageFlags, PermissionFlagsBits } from "discord-api-types/v10";
import type { EventModule } from "../feature.ts";
import { getSubcommandAndOptions, hasBitfield, hasBitfield2 } from "../utils.ts";

const guildActionsModule: EventModule = {
    name: "guild-actions",
    handlers: {
        [GatewayDispatchEvents.GuildRoleDelete]: async ({ data: role, api, db }) => {
            await db.removeGuildActionsRoleByRoleId(role.guild_id, role.role_id);
        },
        [GatewayDispatchEvents.ChannelDelete]: async ({ data: channel, api, db }) => {
            // @ts-expect-error - somehow the types are broken for channel*
            if (!channel.guild_id || !channel.id) return;
            // @ts-expect-error - somehow the types are broken for channel*
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
                const { options } = getSubcommandAndOptions(interaction.data);
                const guildId = interaction.guild_id;
                const roleId = options.role
                const channelId = options.channel;

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
                if (channelId) {
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
