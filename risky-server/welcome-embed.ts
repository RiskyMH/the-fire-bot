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
                {
                    type: ComponentType.Section,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: `## Rules
Keeping these simple as they're pretty much common sense:
1. **No offensive messages or nicknames** - Anything that a reasonable person might find offensive.
2. **No spam** - This includes but is not limited too, loud/obnoxious noises in voice, @mention spam, character spam, image spam, and message spam.
3. **No Gorey, Sexual, or scary content** - Screamer links, porn, nudity, death.
4. **No harassment** - Including sexual harassment or encouraging of harassment.
5. **No self or user bots** - These are in some cases against the discord TOS and if you need a bot then use the allowed *user-installable bots* or one in the server.
6. **[Follow Discord ToS](https://discord.com/terms)**`
                        }
                    ],
                    accessory: {
                        type: ComponentType.Button,
                        url: "https://discord.com/guidelines",
                        // label: "Discord Guidelines",
                        emoji: {
                            id: "1325885166631125102",
                            name: "discord_wumpus"
                        },
                        style: ButtonStyle.Link,
                    }
                },
                {
                    type: ComponentType.TextDisplay,
                    content: `-# There may be situations not covered by the rules or times where the rule may not fit the situation, so hopefully common sense will prevail.`,
                }
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
This server is mainly for stuff related to <:Fire:1281081113338450012> [Me](https://riskymh.dev); which mainly is my email site <:EmailThing:1226746122895097916> [**EmailThing**](https://emailthing.app/home) and my Discord bot <:honeypot:1452856668202467481> [**Honeypot**](https://discord.com/oauth2/authorize?client_id=1450060292716494940).`,
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
                    content: `-# Learn more about the respective projects in <#1206711313766682664> and <#894713013762928670>!`,
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
                    label: "EmailThing",
                    style: ButtonStyle.Link,
                    url: "https://emailthing.app",
                    emoji: {
                        id: "1226746122895097916",
                        name: "EmailThing"
                    }
                },
                {
                    type: ComponentType.Button,
                    label: "Honeypot",
                    style: ButtonStyle.Link,
                    url: "https://discord.com/oauth2/authorize?client_id=1450060292716494940",
                    emoji: {
                        id: "1452856668202467481",
                        name: "honeypot"
                    }
                },
            ],
        }
    ],
    content: "",
    embeds: [],
}

await fetch(process.env.WEBHOOK_URL! + "?wait=true&with_components=true", {
    method: process.env.WEBHOOK_URL?.includes("/messages/") ? "PATCH" : "POST",
    headers: {
        "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
})
