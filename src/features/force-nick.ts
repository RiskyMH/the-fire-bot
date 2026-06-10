import { ApplicationCommandType, GatewayDispatchEvents, GuildMemberFlags, InteractionType, MessageFlags, PermissionFlagsBits } from "discord-api-types/v10";
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
                const { subcommand, options } = getSubcommandAndOptions(interaction.data);
                const guildId = interaction.guild_id;
                if (subcommand === "set") {
                    const userId = options.user as string;
                    const nickname = options.nickname as string;
                    if (!userId || !nickname) {
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `❌ You must specify a user and a nickname!`,
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }
                    if (!hasBitfield2(interaction.app_permissions, PermissionFlagsBits.ManageNicknames)) {
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `❌ I need Manage Nicknames permission to force nicknames!`,
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }
                    const member = interaction.data.resolved?.members?.[userId];
                    if (!member) {
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `❌ The specified user is not in this server!`,
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }
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
                } else if (subcommand === "unset") {
                    const userId = options.user as string;
                    if (!userId) {
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `❌ You must specify a user!`,
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }
                    const removed = await db.removeForceNick(guildId, userId);
                    if (removed) {
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `🗑️ <@${userId}> no longer has a forced nickname.`,
                            allowed_mentions: {}
                        });
                    } else {
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `ℹ️ <@${userId}> didn't have a forced nickname.`,
                            allowed_mentions: {}
                        });
                    }
                } else if (subcommand === "view") {
                    const nicks = await db.getGuildForceNicks(guildId);
                    if (nicks.length === 0) {
                        await api.interactions.reply(interaction.id, interaction.token, {
                            content: `ℹ️ No users have forced nicknames in this server.`,
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }
                    const lines = nicks.map(n => `- <@${n.user_id}> → **${n.forced_nick}**`);
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `**Forced Nicknames:**\n${lines.join("\n")}`,
                        allowed_mentions: {}
                    });
                } else if (subcommand === "resetall") {
                    const count = await db.removeAllForceNicks(guildId);
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `🗑️ Removed forced nicknames from **${count}** user${count === 1 ? '' : 's'}.`,
                        allowed_mentions: {}
                    });
                }
            }
        },
    },
};

export default forceNickModule;
