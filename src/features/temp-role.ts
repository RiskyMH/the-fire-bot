import { ApplicationCommandType, ButtonStyle, ComponentType, GatewayDispatchEvents, InteractionType, MessageFlags, PermissionFlagsBits, type APIMessageTopLevelComponent } from "discord-api-types/v10";
import type { API } from "@discordjs/core";
import type { EventModule } from "../feature.ts";
import type * as dbModule from "../db.ts";
import { getSubcommandAndOptions, hasBitfield2 } from "../utils.ts";

type Db = typeof dbModule;

export const TEMP_ROLE_DURATION_MS = 60 * 60 * 1000; // 1 hour

async function sweepExpiredClaims(api: API, db: Db): Promise<void> {
    const expired = await db.getExpiredTempRoleClaims(Date.now());
    for (const claim of expired) {
        const button = await db.getTempRoleButtonByCustomId(claim.custom_id);
        if (!button) {
            await db.removeTempRoleClaim(claim.custom_id, claim.user_id);
            continue;
        }
        try {
            await api.guilds.removeRoleFromMember(claim.guild_id, claim.user_id, button.role_id, { reason: "temp role expired (1h)" });
        } catch (err) {
            console.error(`Failed to remove expired temp role: ${err}`);
        }
        await db.removeTempRoleClaim(claim.custom_id, claim.user_id);
    }
}

async function cleanupButton(api: API, db: Db, button: dbModule.ITempRoleButton): Promise<void> {
    const claims = await db.getTempRoleClaims(button.custom_id);
    await Promise.allSettled(
        claims.map((claim) =>
            api.guilds
                .removeRoleFromMember(button.guild_id, claim.user_id, button.role_id, { reason: "temp role button message was deleted" })
                .catch(() => null)
        )
    );
    await db.deleteTempRoleButtonByCustomId(button.custom_id);
}

const tempRoleModule: EventModule = {
    name: "temp-role",
    handlers: {
        [GatewayDispatchEvents.Ready]: async ({ api, db }) => {
            const run = async () => {
                try {
                    await sweepExpiredClaims(api, db);
                } catch (err) {
                    console.error(`Failed to sweep expired temp roles: ${err}`);
                }
            };
            await run();
            setInterval(run, 60_000);
        },
        [GatewayDispatchEvents.MessageDelete]: async ({ data: message, api, db }) => {
            const button = await db.getTempRoleButtonByMessageId(message.id);
            if (!button) return;
            try {
                await cleanupButton(api, db, button);
            } catch (err) {
                console.error(`Failed to clean up temp role button: ${err}`);
            }
        },
        [GatewayDispatchEvents.MessageDeleteBulk]: async ({ data: { ids }, api, db }) => {
            for (const id of ids) {
                const button = await db.getTempRoleButtonByMessageId(id);
                if (!button) continue;
                try {
                    await cleanupButton(api, db, button);
                } catch (err) {
                    console.error(`Failed to clean up temp role button: ${err}`);
                }
            }
        },
        [GatewayDispatchEvents.ChannelDelete]: async ({ data: channel, api, db }) => {
            if (!channel.id) return;
            const buttons = await db.getTempRoleButtonsByChannel(channel.id);
            for (const button of buttons) {
                try {
                    await cleanupButton(api, db, button);
                } catch (err) {
                    console.error(`Failed to clean up temp role button: ${err}`);
                }
            }
        },
        [GatewayDispatchEvents.GuildRoleDelete]: async ({ data: role, db }) => {
            // role is already gone, just drop the stored button + claims
            await db.deleteTempRoleButtonsByRole(role.guild_id, role.role_id);
        },
        [GatewayDispatchEvents.GuildMemberRemove]: async ({ data: member, db }) => {
            await db.removeTempRoleClaimsOfUser(member.guild_id, member.user.id);
        },
        [GatewayDispatchEvents.InteractionCreate]: async ({ data: interaction, api, db }) => {
            if (!interaction.guild_id) return;

            if (
                interaction.type === InteractionType.ApplicationCommand &&
                interaction.data.type === ApplicationCommandType.ChatInput &&
                interaction.data.name === "temp-role-button"
            ) {
                if (!hasBitfield2(interaction.app_permissions, PermissionFlagsBits.ManageRoles)) {
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `❌ I need Manage Roles permission to create temp role buttons.`,
                        flags: MessageFlags.Ephemeral,
                        allowed_mentions: {},
                    });
                    return;
                }

                const { options } = getSubcommandAndOptions(interaction.data);
                const roleId = typeof options.role === "string" ? options.role : null;
                const label = typeof options.label === "string" ? options.label.trim() : "";
                const message = typeof options.message === "string" ? options.message : undefined;

                if (!roleId) {
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `❌ Please specify a role to give.`,
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }
                if (!label || label.length > 80) {
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `❌ Button text must be between 1 and 80 characters.`,
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }
                if (roleId === interaction.guild_id) {
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `❌ You cannot use @everyone as a temp role.`,
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }

                const resolvedRole = interaction.data.resolved?.roles?.[roleId];
                if (resolvedRole?.managed) {
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `❌ I cannot give a bot-managed (integration/bot) role.`,
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }

                const customId = `temp_role:${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
                const components: APIMessageTopLevelComponent[] = [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Primary,
                                label,
                                custom_id: customId,
                            },
                        ],
                    },
                ];

                let messageId: string | undefined;
                try {
                    const sent = await api.interactions.reply(interaction.id, interaction.token, {
                        content: message || undefined,
                        components,
                        allowed_mentions: {},
                        with_response: true,
                    });
                    messageId = (sent as any)?.interaction?.response_message_id ?? (sent as any)?.resource?.message?.id;
                } catch (err) {
                    console.error(`Failed to post temp role button: ${err}`);
                }

                // fallback if the interaction response id couldn't be captured
                if (!messageId && interaction.channel?.id) {
                    try {
                        const sent = await api.channels.createMessage(interaction.channel.id, {
                            content: message,
                            components,
                            allowed_mentions: {},
                        });
                        messageId = (sent as any)?.id;
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `✅ Temp role button posted in <#${interaction.channel.id}>!`,
                            flags: MessageFlags.Ephemeral,
                            allowed_mentions: {},
                        });
                    } catch (err) {
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `❌ Failed to post the button, please ensure I can send messages in this channel.`,
                            flags: MessageFlags.Ephemeral,
                        });
                        return;
                    }
                }

                if (!messageId) {
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `❌ Failed to post the button, please try again.`,
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }

                await db.createTempRoleButton({
                    custom_id: customId,
                    guild_id: interaction.guild_id,
                    channel_id: interaction.channel.id,
                    message_id: messageId,
                    role_id: roleId,
                    label,
                });
            } else if (
                interaction.type === InteractionType.MessageComponent &&
                interaction.data.custom_id.startsWith("temp_role:")
            ) {
                const guildId = interaction.guild_id;
                const button = await db.getTempRoleButtonByCustomId(interaction.data.custom_id);
                if (!button) {
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `❌ This button no longer works (its message was deleted).`,
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }

                const userId = interaction.member?.user.id ?? interaction.user?.id;
                if (!userId) return;

                let memberRoles: string[] | undefined = (interaction.member as any)?.roles;
                if (!memberRoles) {
                    try {
                        const member = await api.guilds.getMember(guildId, userId);
                        memberRoles = member.roles;
                    } catch {
                        memberRoles = [];
                    }
                }

                const claim = await db.getTempRoleClaim(button.custom_id, userId);
                const hasRole = memberRoles.includes(button.role_id);

                if (claim && hasRole) {
                    // toggle off
                    try {
                        await api.guilds.removeRoleFromMember(guildId, userId, button.role_id, { reason: "temp role button toggled off" });
                    } catch (err) {
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `❌ Failed to remove <@&${button.role_id}>, please ensure I have Manage Roles and my role is above it.`,
                            flags: MessageFlags.Ephemeral,
                            allowed_mentions: {},
                        });
                        return;
                    }
                    await db.removeTempRoleClaim(button.custom_id, userId);
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `🗑️ Removed <@&${button.role_id}> from you.`,
                        flags: MessageFlags.Ephemeral,
                        allowed_mentions: {},
                    });
                    return;
                }

                if (!claim && hasRole) {
                    // user already has the role via other means - don't track it so
                    // message-delete cleanup won't strip a manually granted role
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `ℹ️ You already have <@&${button.role_id}>.`,
                        flags: MessageFlags.Ephemeral,
                        allowed_mentions: {},
                    });
                    return;
                }

                try {
                    await api.guilds.addRoleToMember(guildId, userId, button.role_id, { reason: "temp role button claimed" });
                } catch (err) {
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `❌ Failed to give you <@&${button.role_id}>, please ensure I have Manage Roles and my role is above it.`,
                        flags: MessageFlags.Ephemeral,
                        allowed_mentions: {},
                    });
                    return;
                }
                await db.addTempRoleClaim(button.custom_id, guildId, userId, Date.now() + TEMP_ROLE_DURATION_MS);
                await api.interactions.reply(interaction.id, interaction.token, {
                    content: `✅ You got <@&${button.role_id}> for 1 hour!`,
                    flags: MessageFlags.Ephemeral,
                    allowed_mentions: {},
                });
            }
        },
    },
};

export default tempRoleModule;
