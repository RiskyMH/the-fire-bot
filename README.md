# The Fire Bot

A multi-purpose bot for the needs of my server!

[Join the server](https://discord.gg/qK9pfnB3Yv) | [Invite the bot](https://discord.com/oauth2/authorize?client_id=1478485035752362096)

## Features

### Counting Channel
- `/counting` - Configure the current channel as a counting channel
- Tracks the current count and highscore for each counting channel
- Pick a difficulty: **Easy** (no punishment, just try again), **Medium** (punishment scales with the count), or **Hard** (always resets to 0)
- Catches wrong numbers and skips, with a random punishment on medium
- Detects when someone tries to count twice in a row
- Calls out users who edit or delete the latest counted number
- Ask *"what is the count"* / *"what are we up to"* in the channel to get a status update
- Reacts with a fire emoji on each correct number (animated when a new highscore is hit)

### Timezone
- `/timezone set <timezone>` - Set your timezone (with autocomplete search by city, country, abbreviation, or offset)
- `/timezone remove` - Unset your timezone
- `/timezone view [highlight]` - View everyone's current timezones in the server
- `/timezone compare <user> [user2]` - Compare local times and the time difference between users
- `/updating-timezone-message` - Post a pinned message that updates every minute with everyone's current local time (only one per server)

### Welcome Actions
- `/welcome-actions` - Configure welcome actions for the server
- Give a role to members when they complete onboarding
- Send join/leave messages to a log channel (including "(again)" when a member rejoins)

### Guild Tag Role
- `/guild-tag-role` - Set a special role that's automatically given to users who have the server's guild tag on their profile

### VC Role
- `/vc-role` - Automatically give a role to users while they're in any voice channel, and remove it when they leave

### Force Nickname
- `/force-nick <user>` - Force a user's nickname; any change they make to it will be reverted by the bot

### Wave
- 👋 The bot waves back at "hi"/"hello" messages and new members joining the server

## Setup

Requires [Bun](https://bun.com).

```bash
DISCORD_TOKEN=your_token_here bun run dev
```

Requires a `DISCORD_TOKEN` environment variable (optionally `DATABASE_URL` to point at a custom SQLite database).

The bot is also fully containerized:

```bash
bun run docker:build   # build the image
bun run docker:deploy  # deploy with docker compose
bun run docker:logs    # tail the logs
```
