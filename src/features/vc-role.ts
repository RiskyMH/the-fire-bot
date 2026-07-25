import { ApplicationCommandType, ComponentType, GatewayDispatchEvents, InteractionType, MessageFlags, PermissionFlagsBits, SelectMenuDefaultValueType, type APIModalInteractionResponseCallbackData } from "discord-api-types/v10";
import type { EventModule } from "../feature.ts";
import { hasBitfield2 } from "../utils.ts";

const vcRoleModule: EventModule = {
    name: "vc-role",
    handlers: {
        [GatewayDispatchEvents.GuildRoleDelete]: async ({ data: role, db }) => {
            await db.removeVcRoleByRoleId(role.guild_id, role.role_id);
        },
        [GatewayDispatchEvents.VoiceStateUpdate]: async ({ data: voiceState, api, db }) => {
            const guildId = voiceState.guild_id;
            if (!guildId) return;

            // must have left server if no member object is present, so we can't do anything
            if (!voiceState.member) return;

            const config = await db.getVcRole(guildId);
            if (!config) return;

            try {
                if (voiceState.channel_id) {
                    if (!voiceState.member.roles.includes(config.role_id)) {
                        await api.guilds.addRoleToMember(guildId, voiceState.user_id, config.role_id, { reason: "user joined VC" });
                    }
                } else {
                    if (voiceState.member.roles.includes(config.role_id)) {
                        await api.guilds.removeRoleFromMember(guildId, voiceState.user_id, config.role_id, { reason: "user left VC" });
                    }
                }
            } catch (err) {
                console.error(`Failed to update vc role: ${err}`);
            }
        },
        [GatewayDispatchEvents.InteractionCreate]: async ({ data: interaction, api, db }) => {
            if (!interaction.guild_id) return;

            if (
                interaction.type === InteractionType.ApplicationCommand &&
                interaction.data.type === ApplicationCommandType.ChatInput &&
                interaction.data.name === "vc-role"
            ) {
                if (!hasBitfield2(interaction.app_permissions, PermissionFlagsBits.ManageRoles)) {
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `❌ I need Manage Roles permission to configure VC roles.`,
                        flags: MessageFlags.Ephemeral,
                        allowed_mentions: {},
                    });
                    return;
                }

                const config = await db.getVcRole(interaction.guild_id);

                const modal: APIModalInteractionResponseCallbackData = {
                    title: "VC Role",
                    custom_id: `vc_role:${interaction.guild_id}`,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: "Configure a role to automatically give users that are in a voice channel."
                                + "\n-# - The role will be assigned when a user joins any voice channel."
                                + "\n-# - The role will be removed when a user leaves all voice channels."
                                + "\n-# - Clear the role field to remove the configuration.",
                        },
                        {
                            type: ComponentType.Label,
                            label: "Role",
                            description: "The role to give when a user is in a voice channel.",
                            component: {
                                type: ComponentType.RoleSelect,
                                custom_id: "role",
                                placeholder: "@InVoice",
                                default_values: config
                                    ? [{ type: SelectMenuDefaultValueType.Role, id: config.role_id }]
                                    : undefined,
                                required: false,
                                max_values: 1,
                                min_values: 0,
                            },
                        },
                    ],
                };
                await api.interactions.createModal(interaction.id, interaction.token, modal);
            } else if (
                interaction.type === InteractionType.ModalSubmit &&
                interaction.data.custom_id.startsWith("vc_role:")
            ) {
                const guildId = interaction.guild_id;
                let roleId: string | null = null;

                for (const component of interaction.data.components) {
                    if (component.type === ComponentType.Label && component.component.custom_id === "role") {
                        const roleSelect = component.component;
                        if (roleSelect.type === ComponentType.RoleSelect) {
                            roleId = roleSelect.values?.[0] || null;
                        }
                    }
                }

                if (!roleId) {
                    await db.removeVcRole(guildId);
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `🗑️ VC role configuration has been removed.`,
                        allowed_mentions: {},
                    });
                    return;
                }

                const role = interaction.data.resolved?.roles?.[roleId];
                if (role?.managed) {
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `❌ I cannot set a bot-managed role as a VC role.`,
                        flags: MessageFlags.Ephemeral,
                        allowed_mentions: {},
                    });
                    return;
                }

                await db.setVcRole(guildId, roleId);
                await api.interactions.reply(interaction.id, interaction.token, {
                    content: `✅ VC role configured! <@&${roleId}> will be assigned/removed when users join/leave any voice channel.`,
                    allowed_mentions: {},
                });
            }
        },
    },
};

export default vcRoleModule;
