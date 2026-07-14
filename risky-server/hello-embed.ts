import { ButtonStyle, ComponentType, MessageFlags, SeparatorSpacingSize, type RESTPostAPIChannelMessageJSONBody } from "discord-api-types/v10";

const body: RESTPostAPIChannelMessageJSONBody = {
    flags: MessageFlags.IsComponentsV2,
    allowed_mentions: {},
    components: [
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
This server is mainly for stuff related to <:Fire:1281081113338450012> [Me](https://riskymh.dev); which mainly is my popular Discord bot <:honeypot:1452856668202467481> [**Honeypot**](https://honeypot.riskymh.dev) and other things like my email site <:EmailThing:1226746122895097916> [**EmailThing**](https://emailthing.app/home).
-# ​
It originally was just my personal server but now anything programming related is fun too!`,
                        },
                    ],
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: {
                            url: "https://riskymh.dev/fire_anim.avif"
                        }
                    }
                },
            ]
        },
        {
            type: ComponentType.Container,
            // accent_color: 0x5865f2,
            // accent_color: 0xFF6723,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `## My Projects`
                },
                {
                    type: ComponentType.Section,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: `### Honeypot\n`
                                + `A discord bot which bans people that message in #honeypot channel`
                        },
                        {
                            type: ComponentType.TextDisplay,
                            content: `-# [Website](https://honeypot.riskymh.dev) | [Invite Bot](https://discord.com/api/oauth2/authorize?client_id=1450060292716494940) | [GitHub](https://github.com/riskymh/honeypot)`,
                        },
                    ],
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: {
                            url: "https://honeypot.riskymh.dev/honeypot.png"
                        }
                    }
                },
                {
                    type: ComponentType.Section,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: `### EmailThing\n`
                                +
                                `A Gmail alternative that I made because I wanted free custom domain!`
                        },
                        {
                            type: ComponentType.TextDisplay,
                            content: `-# [Website](https://emailthing.app) | [GitHub](https://github.com/riskymh/emailthing)`,
                        },
                    ],
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: {
                            url: "https://emailthing.app/logo.png"
                        }
                    }
                },
                {
                    type: ComponentType.Section,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: `### RiskyBOT\n`
                                + `A multipurpose Discord bot that can do random fun things...`
                        },
                        {
                            type: ComponentType.TextDisplay,
                            content: `-# [Website](https://bot.riskymh.dev) | [Invite Bot](https://discord.com/api/oauth2/authorize?client_id=780657028695326720) | [GitHub](https://github.com/riskymh/riskybot)`,
                        },
                    ],
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: {
                            url: "https://bot.riskymh.dev/robot.png"
                        }
                    }
                },
                {
                    type: ComponentType.Section,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: `### Chatroom\n`
                                + `A basic & stateless websocket server where you can chat anonymously`
                        },
                        {
                            type: ComponentType.TextDisplay,
                            content: `-# [Website](https://chatroom.riskymh.dev) | [GitHub](https://github.com/riskymh/chatroom)`,
                        },
                    ],
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: {
                            url: "https://riskymh.dev/chatroom.svg"
                        }
                    }
                },
                {
                    type: ComponentType.Section,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: `### Forms\n` +
                                `A website where you can create forms and get responses`
                        },
                        {
                            type: ComponentType.TextDisplay,
                            content: `-# [Website](https://forms.riskymh.dev) | [GitHub](https://github.com/riskymh/forms)`,
                        },
                    ],
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: {
                            url: "https://forms.riskymh.dev/icon.png"
                        }
                    }
                },
                {
                    type: ComponentType.Section,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: `### Stats Compare\n`
                                + `Site with a bunch of stats games (can play higher or lower)`
                        },
                        {
                            type: ComponentType.TextDisplay,
                            content: `-# [Website](https://stats.riskymh.dev) | [GitHub](https://github.com/riskymh/stats)`,
                        },
                    ],
                    accessory: {
                        type: ComponentType.Thumbnail,
                        media: {
                            url: "https://stats.riskymh.dev/icon.png"
                        }
                    }
                },
                {
                    type: ComponentType.TextDisplay,
                    content: `-# Learn more about my stuff on my website: [riskymh.dev](https://riskymh.dev)!`,
                },
            ]
        },
        {
            type: ComponentType.Container,
            // accent_color: 0x5865f2,
            // accent_color: 0xFF6723,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `## Server Roles
Some roles are easier to get than others:
- <@&894706521609494638> - the role everyone gets when they join the server
- <@&1499123205489561691> - people who chat decently over many days
- <@&1377266798084489328> - equip the server tag in your discord profile
- <@&894824781361332244> - verify your github and domain in Linked Roles
- <@&971371435111092244> - the role to ping to get mod attention
- <@&901339368734728203> - very generous people
- <@&1291026699332620388> - boosters
- <@&963647456938188810> - uhh bots... this is pretty hard to get
`              },
            ],
        },
        {
            type: ComponentType.Container,
            // accent_color: 0x5865f2,
            // accent_color: 0xFF6723,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `## Server Channels
This server has a few channels that you can check out!
- <#894712945345458176> - The welcome channel and rules for this server
- <#894707437653868565> - This channel where you see my stuff
- <#959320709895712818> - The anouncements for this server or important stuff for my projects

General:
- <#894705593535852628> - The main channel where you can chat with others
- <#894707729174786078> - A place where you can use bot commands and other fun stuff
- <#1019715406874808330> - The forum to ask more indepth questions or have specific topics to discuss
-# ​
Extra stuff:
- <#1463533547800498301> - A simple counting place where you can increment the number by 1 each time
- <#965950144027713546> - Spam... you can spam here but don't be too annoying
- <#894705593535852629> - Voice channel where you can talk with others
-# ​
Project feeds:
- <#1206711313766682664>
- <#1518096766753575004>
- <#894713013762928670>
`              },
            ],
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
                    label: "GitHub",
                    style: ButtonStyle.Link,
                    url: "https://github.com/riskymh",
                    emoji: {
                        id: "1119818837542576208",
                        name: "GitHub"
                    }
                },
                {
                    type: ComponentType.Button,
                    label: "#forum",
                    style: ButtonStyle.Link,
                    url: "https://discord.com/channels/894705593087049729/1019715406874808330",
                    emoji: {
                        id: "824240882697633812",
                        name: "thread"
                    }
                },
                {
                    type: ComponentType.Button,
                    label: "#rules",
                    style: ButtonStyle.Link,
                    url: "https://discord.com/channels/894705593087049729/894712945345458176",
                    emoji: {
                        id: "781581022059692043",
                        name: "rules"
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
