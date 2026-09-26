import { ApplicationCommandOptionType, ApplicationCommandType, ApplicationIntegrationType, ChannelType, InteractionContextType, PermissionFlagsBits, type RESTPutAPIApplicationCommandsJSONBody } from "discord-api-types/v10";

export const commands = [
    {
        name: "counting",
        description: "Configure this current channel as a counting channel",
        type: ApplicationCommandType.ChatInput,
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
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "compare",
                description: "Compare another user's timezone with yours or another user",
                options: [
                    {
                        type: ApplicationCommandOptionType.User,
                        name: "user",
                        description: "The user whose timezone to compare",
                        required: true,
                    },
                    {
                        type: ApplicationCommandOptionType.User,
                        name: "user2",
                        description: "Compare against a different user (defaults to you)",
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
        default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild],
    },
    {
        name: "welcome-actions",
        description: "Set the welcome actions for this server",
        type: ApplicationCommandType.ChatInput,
        default_member_permissions: (PermissionFlagsBits.ManageRoles | PermissionFlagsBits.ManageChannels).toString(),
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild],
    },
    {
        name: "force-nick",
        description: "Force a user's nickname (bot will revert any changes they do)",
        type: ApplicationCommandType.ChatInput,
        options: [
            {
                type: ApplicationCommandOptionType.User,
                name: "user",
                description: "The user to force a nickname on",
                required: true,
            },
        ],
        default_member_permissions: PermissionFlagsBits.ManageNicknames.toString(),
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild],
    },
    {
        name: "vc-role",
        description: "Automatically give a role when users are in a voice channel",
        type: ApplicationCommandType.ChatInput,
        default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild],
    },
    {
        name: "temp-role-button",
        description: "Post a button that gives users a role for 1 hour (removed if message deleted)",
        type: ApplicationCommandType.ChatInput,
        options: [
            {
                type: ApplicationCommandOptionType.Role,
                name: "role",
                description: "The role to give when users click the button",
                required: true,
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "label",
                description: "The text shown on the button",
                required: true,
                min_length: 1,
                max_length: 80,
            },
            {
                type: ApplicationCommandOptionType.String,
                name: "message",
                description: "Optional text shown above the button",
                required: false,
                max_length: 2000,
            },
        ],
        default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild],
    },
] satisfies RESTPutAPIApplicationCommandsJSONBody;