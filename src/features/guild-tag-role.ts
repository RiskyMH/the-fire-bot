import { ApplicationCommandType, ComponentType, GatewayDispatchEvents, GuildMemberFlags, InteractionType, MessageFlags, PermissionFlagsBits, SelectMenuDefaultValueType, type APIModalInteractionResponseCallbackData } from "discord-api-types/v10";
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
                if (!hasBitfield2(interaction.app_permissions, PermissionFlagsBits.ManageRoles)) {
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `❌ I need Manage Roles permission to set the guild tag role.`,
                        flags: MessageFlags.Ephemeral,
                        allowed_mentions: {},
                    });
                    return;
                }

                const guildTag = await db.getGuildTagRole(interaction.guild_id);

                const modal: APIModalInteractionResponseCallbackData = {
                    title: "Guild Tag Role",
                    custom_id: `guild_tag:${interaction.guild_id}`,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: "Configure the guild tag role for this server"
                                + "\n-# - This is a special role that will be automatically assigned to users who have the server's guild tag in their profile"
                                + "\n-# - You can set it to give them a special color or permissions to highlight them in your server!",
                        },
                        {
                            type: ComponentType.Label,
                            label: "Role to give",
                            description: "The role to give people. Leave blank to not give anyone a role.",
                            component: {
                                type: ComponentType.RoleSelect,
                                custom_id: "role",
                                required: false,
                                default_values: guildTag?.role_id ? [{ id: guildTag.role_id, type: SelectMenuDefaultValueType.Role }] : undefined,
                                max_values: 1,
                                min_values: 0,
                            }
                        }
                    ]
                }
                await api.interactions.createModal(interaction.id, interaction.token, modal);
            } else if (interaction.type === InteractionType.ModalSubmit && interaction.data.custom_id.startsWith("guild_tag:")) {
                const guildId = interaction.guild_id;
                let roleId = null as string | null;

                for (const component of interaction.data.components) {
                    if (component.type === ComponentType.Label && component.component.custom_id === "role") {
                        const roleSelect = component.component;
                        if (roleSelect.type === ComponentType.RoleSelect) {
                            roleId = roleSelect.values?.[0] || null;
                        }
                    }
                }

                if (!roleId) {
                    await db.removeGuildTagRole(guildId);
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `🗑️ The tag role has been removed for this guild.`,
                        allowed_mentions: {},
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

            }
        },
    },
};

export default guildTagRoleModule;
