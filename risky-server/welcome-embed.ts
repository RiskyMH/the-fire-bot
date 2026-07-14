import { ButtonStyle, ComponentType, MessageFlags, type RESTPostAPIChannelMessageJSONBody } from "discord-api-types/v10";

const body: RESTPostAPIChannelMessageJSONBody = {
    flags: MessageFlags.IsComponentsV2,
    allowed_mentions: {},
    components: [
        {
            type: ComponentType.Container,
            // accent_color: 0x5865f2,
            // accent_color: 0xFF6723,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `## Welcome to Risky's Server!
This is a server for all things related to [me](https://riskymh.dev), but also just a fun programming community in general! Feel free to look around and check out the channels, and if you have any questions ask in <#894705593535852628> or <#1019715406874808330>!

Also join the <#1463533547800498301> chain and setup your timezone with \`/timezone set\` so [we can see](https://discord.com/channels/894705593087049729/894705593535852628/1479146497902776462)!
`,
                }
            ]
        },
        {
            type: ComponentType.Container,
            // accent_color: 0xfee75c,
            // accent_color: 0xFF6723,
            components: [
                // {
                //     type: ComponentType.Section,
                //     components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `## Server Rules
1. Use English
2. Be respectful towards other people
3. Self-doxing are discouraged to protect safety and comfort of community
4. No spamming or advertisement in places that are not intended for its purposes
5. No harrasment or encouragement to harass anyone
6. No NSFW and illegal content including but not limited to porn, gore, suicide content, and other contents that could put others at risk
7. No self-bots or automated user accounts
8. Respect moderator decisions. Do not evade or circumvent moderation actions
-# We expect you to follow the rules above in addition to [Discord's ToS](https://discord.com/terms) and [Guidelines](https://discord.com/guidelines)`
                }
                // ],
                //     accessory: {
                //         type: ComponentType.Button,
                //         url: "https://discord.com/guidelines",
                //         // label: "Discord Guidelines",
                //         emoji: {
                //             id: "1325885166631125102",
                //             name: "discord_wumpus"
                //         },
                //         style: ButtonStyle.Link,
                //     }
                // },
            ]
        },

        {
            type: ComponentType.Container,
            // accent_color: 0x5865f2,
            accent_color: 0xFF6723,
            components: [
                {
                    type: ComponentType.Section,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: `## What is this server\n
This server is mainly for stuff related to <:Fire:1281081113338450012> [Me](https://riskymh.dev); which mainly is my popular Discord bot <:honeypot:1452856668202467481> [**Honeypot**](https://honeypot.riskymh.dev) and other things like my email site <:EmailThing:1226746122895097916> [**EmailThing**](https://emailthing.app/home).`,
                        },
                        {
                            type: ComponentType.TextDisplay,
                            content: `It originally was just my personal server but now anything programming related is fun too!`,
                        },
                    ],
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: {
                            url: "https://riskymh.dev/fire_anim.avif"
                        }
                    }
                },
                {
                    type: ComponentType.TextDisplay,
                    content: `-# Learn more about my stuff in https://discord.com/channels/894705593087049729/894707437653868565/959320056431513650 and on my website [riskymh.dev](https://riskymh.dev)!`,
                },
            ]
        },
        {
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.Button,
                    label: "Website",
                    style: ButtonStyle.Link,
                    url: "https://riskymh.dev",
                    emoji: {
                        id: "1281081113338450012",
                        name: "Fire"
                    }
                },
                {
                    type: ComponentType.Button,
                    label: "Honeypot",
                    style: ButtonStyle.Link,
                    url: "https://honeypot.riskymh.dev",
                    emoji: {
                        id: "1452856668202467481",
                        name: "honeypot"
                    }
                },
                {
                    type: ComponentType.Button,
                    label: "EmailThing",
                    style: ButtonStyle.Link,
                    url: "https://emailthing.app",
                    emoji: {
                        id: "1226746122895097916",
                        name: "EmailThing"
                    }
                },
            ],
        }
    ],
    content: "",
    embeds: [],
}

const res = await fetch(process.env.WEBHOOK_URL! + "?wait=true&with_components=true", {
    method: process.env.WEBHOOK_URL?.includes("/messages/") ? "PATCH" : "POST",
    headers: {
        "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
})

if (!res.ok) {
    console.error(`Failed to send webhook: ${res.status} ${res.statusText}`);
    console.log(await res.text());
}
