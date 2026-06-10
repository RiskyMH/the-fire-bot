import { ApplicationCommandType, GatewayDispatchEvents, GuildMemberFlags, InteractionType, MessageFlags, PermissionFlagsBits } from "discord-api-types/v10";
import type { EventModule } from "../feature.ts";
import { getSubcommandAndOptions, hasBitfield, hasBitfield2 } from "../utils.ts";

const guildTagRoleModule: EventModule = {
    name: "guild-tag-role",
    handlers: {
        [GatewayDispatchEvents.GuildRoleDelete]: async ({ data: role, api, db }) => {
            await db.removeGuildTagRoleByRoleId(role.guild_id, role.role_id);
        },
        [GatewayDispatchEvents.GuildMemberUpdate]: async ({ data: member, api, db }) => {
            const guildTag = await db.getGuildTagRole(member.guild_id);
            if (guildTag?.role_id) {
                if (member.user.primary_guild?.identity_guild_id === member.guild_id) {
                    if (!member.roles.includes(guildTag.role_id)) {
                        try {
                            await api.guilds.addRoleToMember(member.guild_id, member.user.id, guildTag.role_id, { reason: "user has the guild tag" })
                        } catch (err) {
                            console.error(`Failed to add guild tag role to user: ${err}`);
                        }
                    }
                } else {
                    if (member.roles.includes(guildTag.role_id)) {
                        try {
                            await api.guilds.removeRoleFromMember(member.guild_id, member.user.id, guildTag.role_id, { reason: "user no longer has the guild tag" })
                        } catch (err) {
                            console.error(`Failed to remove guild tag role from user: ${err}`);
                        }
                    }
                }
            }
        },
        [GatewayDispatchEvents.InteractionCreate]: async ({ data: interaction, api, db, commandIds }) => {
            if (!interaction.guild_id) return;
            if (
                interaction.type === InteractionType.ApplicationCommand &&
                interaction.data.type === ApplicationCommandType.ChatInput &&
                interaction.data.name === "guild-tag-role"
            ) {
                const { subcommand, options } = getSubcommandAndOptions(interaction.data);
                const guildId = interaction.guild_id;
                // subcommand: set/remove/view, option: role (on set)
                try {
                    if (subcommand === "set") {
                        if (!hasBitfield2(interaction.app_permissions, PermissionFlagsBits.ManageRoles)) {
                            await api.interactions.reply(interaction.id, interaction.token, {
                                content: `❌ I need Manage Roles permission to set the guild tag role.`,
                                flags: MessageFlags.Ephemeral,
                                allowed_mentions: {},
                            });
                            return;
                        }
                        const roleId = options.role as string;
                        if (!roleId) {
                            await api.interactions.reply(interaction.id, interaction.token, {
                                content: `❌ You must specify a role to set as the guild tag role!`,
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }
                        const role = interaction.data.resolved?.roles?.[roleId];
                        if (!role) {
                            await api.interactions.reply(interaction.id, interaction.token, {
                                content: `❌ The specified role could not be found (maybe it was deleted)!`,
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }
                        if (role.managed) {
                            await api.interactions.reply(interaction.id, interaction.token, {
                                content: `❌ You cannot set a bot-managed (integration/bot) role as a tag role.`,
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }
                        await db.setGuildTagRole(guildId, roleId);
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `✅ Tag role successfully set! Users with the server's guild tag will be given <@&${roleId}>.`,
                            allowed_mentions: {},
                        });

                        // now check all members and update their roles accordingly
                        let after: string | undefined = undefined;
                        while (true) {
                            const batch = await api.guilds.getMembers(guildId, { limit: 1000, after });
                            await Promise.allSettled(batch.map(member => (() => {
                                const hasTag = member.user.primary_guild?.identity_guild_id === guildId;
                                const hasRole = member.roles.includes(roleId);
                                if (hasTag && !hasRole) {
                                    return api.guilds.addRoleToMember(guildId, member.user.id, roleId, { reason: "guild tag role was set while user had the tag" }).catch(console.error);
                                } else if (!hasTag && hasRole) {
                                    return api.guilds.removeRoleFromMember(guildId, member.user.id, roleId, { reason: "guild tag role was set while user didn't have the tag" }).catch(console.error);
                                }
                            })()));

                            after = batch[batch.length - 1]?.user.id;
                            if (!after) break;
                        }

                        await api.interactions.editReply(interaction.application_id, interaction.token, {
                            content: `✅ Tag role successfully set and updated for all members! Users with the server's guild tag will be given <@&${roleId}>.`,
                            allowed_mentions: {},
                        });


                    } else if (subcommand === "remove") {
                        await db.removeGuildTagRole(guildId);
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `🗑️ The tag role has been removed for this guild.`,
                            allowed_mentions: {},
                        });
                    } else if (subcommand === "view") {
                        const rec = await db.getGuildTagRole(guildId);
                        if (rec?.role_id) {
                            await api.interactions.reply(interaction.id, interaction.token, {
                                content: `👁️ The current tag role is <@&${rec.role_id}>.`,
                                allowed_mentions: {},
                            });
                        } else {
                            await api.interactions.reply(interaction.id, interaction.token, {
                                content: `ℹ️ There is no tag role set for this guild.`,
                                allowed_mentions: {},
                            });
                        }
                    }
                } catch (e) {
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `❌ Failed to update/view the guild tag role! (${e})`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
            }
        },
    },
};

export default guildTagRoleModule;
