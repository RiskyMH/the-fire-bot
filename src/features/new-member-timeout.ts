import { ApplicationCommandType, ComponentType, GatewayDispatchEvents, InteractionType, MessageFlags, PermissionFlagsBits, type APIModalInteractionResponseCallbackData, type APISelectMenuOption } from "discord-api-types/v10";
import type { EventModule } from "../feature.ts";
import { hasBitfield2 } from "../utils.ts";

// Lowest option is 1hr on both, no default (both selects optional; blank = disabled).
const ACCOUNT_AGE_OPTIONS: { secs: number; label: string }[] = [
    { secs: 3600, label: "1 hour" },
    { secs: 7200, label: "2 hours" },
    { secs: 10800, label: "3 hours" },
    { secs: 21600, label: "6 hours" },
    { secs: 43200, label: "12 hours" },
    { secs: 86400, label: "1 day" },
    { secs: 129600, label: "1.5 days" },
    { secs: 172800, label: "2 days" },
    { secs: 259200, label: "3 days" },
    { secs: 432000, label: "5 days" },
    { secs: 604800, label: "7 days" },
    { secs: 1209600, label: "14 days" },
    { secs: 2592000, label: "30 days" },
];

const TIMEOUT_OPTIONS: { secs: number; label: string }[] = [
    { secs: 3600, label: "1 hour" },
    { secs: 7200, label: "2 hours" },
    { secs: 21600, label: "6 hours" },
    { secs: 43200, label: "12 hours" },
    { secs: 86400, label: "1 day" },
    { secs: 172800, label: "2 days" },
    { secs: 259200, label: "3 days" },
    { secs: 604800, label: "7 days" },
];

function toSelectOptions(
    defs: { secs: number; label: string }[],
    currentSecs: number | null,
): APISelectMenuOption[] {
    return defs.map((d) => ({
        label: d.label,
        value: String(d.secs),
        default: currentSecs === d.secs || undefined,
    }));
}

function formatDuration(secs: number): string {
    if (secs % 86400 === 0) {
        const days = secs / 86400;
        return `${days} day${days === 1 ? "" : "s"}`;
    }
    if (secs % 3600 === 0) {
        const hours = secs / 3600;
        return `${hours} hour${hours === 1 ? "" : "s"}`;
    }
    const days = Math.floor(secs / 86400);
    const hours = Math.floor((secs % 86400) / 3600);
    if (days > 0 && hours > 0) return `${days} day${days === 1 ? "" : "s"} ${hours} hour${hours === 1 ? "" : "s"}`;
    if (days > 0) return `${days} day${days === 1 ? "" : "s"}`;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
}

// Discord snowflake creation time: (id >> 22) + 1420070400000 (ms).
function getAccountCreatedAtMs(userId: string): number {
    return Number((BigInt(userId) >> 22n) + 1420070400000n);
}

const newMemberTimeoutModule: EventModule = {
    name: "new-member-timeout",
    handlers: {
        [GatewayDispatchEvents.GuildMemberAdd]: async ({ data: member, api, db }) => {
            const config = await db.getNewMemberTimeout(member.guild_id);
            if (!config) return;

            const ageMs = Date.now() - getAccountCreatedAtMs(member.user.id);
            if (ageMs >= config.min_account_age_secs * 1000) return;

            const newTimeoutUntil = Date.now() + config.timeout_secs * 1000;
            // Don't shorten an existing longer timeout.
            if (member.communication_disabled_until) {
                const currentUntil = Date.parse(member.communication_disabled_until);
                if (Number.isFinite(currentUntil) && currentUntil >= newTimeoutUntil) return;
            }

            try {
                await api.guilds.editMember(
                    member.guild_id,
                    member.user.id,
                    { communication_disabled_until: new Date(newTimeoutUntil).toISOString() },
                    { reason: `new-member-timeout: account age < ${formatDuration(config.min_account_age_secs)}` },
                );
            } catch (err) {
                console.error(`Failed to timeout new member ${member.user.id} in ${member.guild_id}: ${err}`);
            }
        },
        [GatewayDispatchEvents.InteractionCreate]: async ({ data: interaction, api, db }) => {
            if (!interaction.guild_id) return;
            if (
                interaction.type === InteractionType.ApplicationCommand &&
                interaction.data.type === ApplicationCommandType.ChatInput &&
                interaction.data.name === "new-member-timeout"
            ) {
                const current = await db.getNewMemberTimeout(interaction.guild_id);

                const modal: APIModalInteractionResponseCallbackData = {
                    title: "New Member Timeout",
                    custom_id: `new_member_timeout:${interaction.guild_id}`,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: "Automatically timeout members who join with a freshly-made account." +
                                "\n-# - Pick the minimum account age and the timeout duration below." +
                                "\n-# - Anyone joining with an account younger than the minimum age gets timed out." +
                                (current
                                    ? `\n-# - Currently: accounts younger than **${formatDuration(current.min_account_age_secs)}** get **${formatDuration(current.timeout_secs)}** timeout.`
                                    : "\n-# - Currently: disabled.") +
                                "\n-# - Leave either select blank to disable.",
                        },
                        {
                            type: ComponentType.Label,
                            label: "Minimum account age",
                            description: "Timeout members with accounts younger than this",
                            component: {
                                type: ComponentType.StringSelect,
                                custom_id: "min_age",
                                placeholder: "Select account age…",
                                required: false,
                                min_values: 0,
                                max_values: 1,
                                options: toSelectOptions(ACCOUNT_AGE_OPTIONS, current?.min_account_age_secs ?? null),
                            },
                        },
                        {
                            type: ComponentType.Label,
                            label: "Timeout duration",
                            description: "How long to timeout young accounts for",
                            component: {
                                type: ComponentType.StringSelect,
                                custom_id: "timeout",
                                placeholder: "Select timeout duration…",
                                required: false,
                                min_values: 0,
                                max_values: 1,
                                options: toSelectOptions(TIMEOUT_OPTIONS, current?.timeout_secs ?? null),
                            },
                        },
                    ],
                };
                await api.interactions.createModal(interaction.id, interaction.token, modal);
            } else if (
                interaction.type === InteractionType.ModalSubmit &&
                interaction.data.custom_id.startsWith("new_member_timeout:")
            ) {
                const guildId = interaction.guild_id;
                let minAgeSecs: number | null = null;
                let timeoutSecs: number | null = null;

                for (const component of interaction.data.components) {
                    if (component.type !== ComponentType.Label) continue;
                    if (component.component.custom_id === "min_age" && component.component.type === ComponentType.StringSelect) {
                        const raw = component.component.values?.[0];
                        if (raw) minAgeSecs = Number.parseInt(raw, 10);
                    } else if (component.component.custom_id === "timeout" && component.component.type === ComponentType.StringSelect) {
                        const raw = component.component.values?.[0];
                        if (raw) timeoutSecs = Number.parseInt(raw, 10);
                    }
                }

                if (!minAgeSecs || !timeoutSecs) {
                    await db.removeNewMemberTimeout(guildId);
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `🗑️ New member timeout has been disabled.`,
                        allowed_mentions: {},
                    });
                    return;
                }

                if (!Number.isFinite(minAgeSecs) || !Number.isFinite(timeoutSecs)) {
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `❌ Invalid selection, please try again.`,
                        flags: MessageFlags.Ephemeral,
                        allowed_mentions: {},
                    });
                    return;
                }

                if (!hasBitfield2(interaction.app_permissions, PermissionFlagsBits.ModerateMembers)) {
                    await api.interactions.reply(interaction.id, interaction.token, {
                        content: `❌ I need the **Timeout Members** permission for this feature to work.`,
                        flags: MessageFlags.Ephemeral,
                        allowed_mentions: {},
                    });
                    return;
                }

                await db.setNewMemberTimeout(guildId, minAgeSecs, timeoutSecs);
                await api.interactions.reply(interaction.id, interaction.token, {
                    content: `✅ New members with accounts younger than **${formatDuration(minAgeSecs)}** will be timed out for **${formatDuration(timeoutSecs)}**.`,
                    allowed_mentions: {},
                });
            }
        },
    },
};

export default newMemberTimeoutModule;
