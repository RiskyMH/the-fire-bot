import { ApplicationCommandOptionType, ApplicationCommandType, ApplicationIntegrationType, ChannelType, InteractionContextType, PermissionFlagsBits, type RESTPutAPIApplicationCommandsJSONBody } from "discord-api-types/v10";

export const commands = [
    {
        name: "counting",
        description: "Configure counting channels",
        type: ApplicationCommandType.ChatInput,
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "set",
                description: "Set this channel as a counting channel",
                options: [
                    {
                        type: ApplicationCommandOptionType.Integer,
                        name: "start",
                        description: "The starting number for the counting channel (default: 0)",
                        required: false,
                        min_value: 0,
                    },
                    {
                        type: ApplicationCommandOptionType.Integer,
                        name: "highscore",
                        description: "The high score for the counting channel (default: 0)",
                        required: false,
                        min_value: 0,
                    },
                ]
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "unset",
                description: "Unset the counting channel",
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "reset",
                description: "Reset the counting channel",
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "view",
                description: "View the current count in the counting channel",
            },
        ],
        default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild],
    },
    {
        name: "timezone",
        description: "Configure your timezone to show",
        type: ApplicationCommandType.ChatInput,
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "set",
                description: "Set your timezone",
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "timezone",
                        description: "Your current timezone that you want to set to be shown publicly",
                        required: true,
                        autocomplete: true,
                    },
                ]
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "remove",
                description: "Unset your timezone",
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "view",
                description: "View all user's timezones in this server",
                options: [
                    {
                        type: ApplicationCommandOptionType.User,
                        name: "highlight",
                        description: "The user whose timezone you want to highlight (for easier finding in the list)",
                        required: false,
                    },
                ]

            },
        ],
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild],
    },
    {
        name: "updating-timezone-message",
        description: "Create a updating message showing the current time in all users' timezones (only one per server)",
        type: ApplicationCommandType.ChatInput,
        options: [],
        default_member_permissions: PermissionFlagsBits.PinMessages.toString(),
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild],
    },
    {
        name: "guild-tag-role",
        description: "Set, remove, or view the guild tag role (special role for users with guild tag)",
        type: ApplicationCommandType.ChatInput,
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "set",
                description: "Set the tag role (will be assigned to users with guild tag)",
                options: [
                    {
                        type: ApplicationCommandOptionType.Role,
                        name: "role",
                        description: "The role to give to users with the guild tag",
                        required: true,
                    }
                ]
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "remove",
                description: "Remove the current tag role setting, disabling the feature",
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "view",
                description: "View the current tag role (if set for this guild)",
            },
        ],
        default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild],
    },
    {
        name: "welcome-actions",
        description: "Set welcome actions (not setting option will remove that action)",
        type: ApplicationCommandType.ChatInput,
        options: [
            {
                type: ApplicationCommandOptionType.Role,
                name: "role",
                description: "The role to give to users when they complete onboarding",
                required: false,
            },
            {
                type: ApplicationCommandOptionType.Channel,
                name: "channel",
                description: "The channel to send join/leave messages in",
                required: false,
                channel_types: [
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement,
                    ChannelType.PublicThread,
                    ChannelType.PrivateThread,
                    ChannelType.AnnouncementThread,
                ],
            },
        ],
        default_member_permissions: (PermissionFlagsBits.ManageRoles | PermissionFlagsBits.ManageChannels).toString(),
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild],
    },
    {
        name: "force-nick",
        description: "Force a user's nickname (bot will revert any changes)",
        type: ApplicationCommandType.ChatInput,
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "set",
                description: "Set a forced nickname for a user",
                options: [
                    {
                        type: ApplicationCommandOptionType.User,
                        name: "user",
                        description: "The user to force a nickname on",
                        required: true,
                    },
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "nickname",
                        description: "The nickname to force (must be 1-32 characters)",
                        required: true,
                        min_length: 1,
                        max_length: 32,
                    },
                ],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "unset",
                description: "Remove the forced nickname for a user",
                options: [
                    {
                        type: ApplicationCommandOptionType.User,
                        name: "user",
                        description: "The user to remove forced nickname from",
                        required: true,
                    },
                ],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "view",
                description: "View all forced nicknames in this server",
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "resetall",
                description: "Remove ALL forced nicknames in this server",
            },
        ],
        default_member_permissions: PermissionFlagsBits.ManageNicknames.toString(),
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild],
    },
] satisfies RESTPutAPIApplicationCommandsJSONBody;