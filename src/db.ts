import { SQL } from "bun";

export type IConfig = {
  guild_id: string;
};
export type ICounting = {
  guild_id: string;
  channel_id: string;
  count: number;
  highscore?: number;
  last_msg?: { message_id: string, author_id: string, number: number } | null,
};
export type ITimezone = {
  user_id: string;
  timezone: string;
};
export type ITimezoneMessage = {
  guild_id: string;
  channel_id: string;
  message_id: string;
}

export const db = new SQL(process.env.DATABASE_URL || "sqlite://db.sqlite");

export async function initDb() {
  await db.unsafe("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;").catch(() => { });
  await db`
    CREATE TABLE IF NOT EXISTS config (
      guild_id TEXT PRIMARY KEY
    );
  `;
  await db`
    CREATE TABLE IF NOT EXISTS counting (
      channel_id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      highscore INTEGER NOT NULL DEFAULT 0,
      last_msg TEXT DEFAULT '{}',
      FOREIGN KEY (guild_id) REFERENCES config(guild_id) ON DELETE CASCADE
    );
  `;
  await db`
    CREATE TABLE IF NOT EXISTS timezone_user (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      timezone TEXT NOT NULL,
      PRIMARY KEY (guild_id, user_id),
      FOREIGN KEY (guild_id) REFERENCES config(guild_id) ON DELETE CASCADE
    );
  `;
  await db`
    CREATE TABLE IF NOT EXISTS timezone_message (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES config(guild_id) ON DELETE CASCADE
    );
  `;
  await db`
    CREATE TABLE IF NOT EXISTS member_actions (
      guild_id TEXT PRIMARY KEY,
      join_role_id TEXT,
      log_channel_id TEXT,
      FOREIGN KEY (guild_id) REFERENCES config(guild_id) ON DELETE CASCADE
    );
  `;
}

export async function removeGuild(guild_id: string): Promise<void> {
  await db`DELETE FROM config WHERE guild_id = ${guild_id}`;
  await db`DELETE FROM timezone_message WHERE guild_id = ${guild_id}`;
  await db`DELETE FROM timezone_user WHERE guild_id = ${guild_id}`;
  await db`DELETE FROM counting WHERE guild_id = ${guild_id}`;
  await db`DELETE FROM member_actions WHERE guild_id = ${guild_id}`;
}

export async function ensureConfig(guild_id: string): Promise<void> {
  await db`
    INSERT INTO config (guild_id) VALUES (${guild_id})
    ON CONFLICT(guild_id) DO NOTHING;
  `;
}

export async function getConfig(guild_id: string): Promise<IConfig | null> {
  const result = await db`SELECT * FROM config WHERE guild_id = ${guild_id}`;
  return result[0] || null;
}

export async function getCounting(channel_id: string): Promise<ICounting | null> {
  const [row] = await db`SELECT * FROM counting WHERE channel_id = ${channel_id}`;
  if (!row) return null;
  return {
    guild_id: row.guild_id,
    channel_id: row.channel_id,
    count: row.count,
    highscore: row.highscore,
    last_msg: row.last_msg && row.last_msg !== '{}' ? JSON.parse(row.last_msg) : undefined,
  };
}

export async function setCounting(channel_id: string, guild_id: string, count = 0, highscore = 0, last_msg?: { message_id: string; author_id: string; number: number }): Promise<void> {
  await ensureConfig(guild_id);
  const lastMsgStr = last_msg ? JSON.stringify(last_msg) : '{}';
  await db`
    INSERT INTO counting (channel_id, guild_id, count, highscore, last_msg)
    VALUES (${channel_id}, ${guild_id}, ${count}, ${highscore}, ${lastMsgStr})
    ON CONFLICT(channel_id) DO UPDATE SET
      count = excluded.count,
      highscore = excluded.highscore,
      last_msg = excluded.last_msg;
  `;
}

export async function updateCounting(
  channel_id: string,
  fields: Partial<Pick<ICounting, 'count' | 'highscore' | 'last_msg'>>
): Promise<void> {
  await db`
    UPDATE counting SET
    count = ${fields.count ? fields.count : db`count`},
    highscore = ${fields.highscore ? fields.highscore : db`highscore`},
    last_msg = ${fields.last_msg ? JSON.stringify(fields.last_msg) : fields.last_msg === null ? null : db`last_msg`}
    WHERE channel_id = ${channel_id}
    `;
}

export async function unsetCounting(channel_id: string): Promise<void> {
  await db`DELETE FROM counting WHERE channel_id = ${channel_id}`;
}

export async function resetCounting(channel_id: string, toCount: number = 0): Promise<void> {
  await db`UPDATE counting SET count = ${toCount}, last_msg = '{}' WHERE channel_id = ${channel_id}`;
}

export async function removeCountingByChannelId(guild_id: string, channel_id: string) {
  await db`DELETE FROM counting WHERE channel_id = ${channel_id} AND guild_id = ${guild_id}`;
}

export async function setUserTimezone(guild_id: string, user_id: string, timezone: string): Promise<void> {
  await ensureConfig(guild_id);
  await db`
    INSERT INTO timezone_user (guild_id, user_id, timezone) VALUES (${guild_id}, ${user_id}, ${timezone})
    ON CONFLICT(guild_id, user_id) DO UPDATE SET timezone = excluded.timezone
  `;
}

export async function removeUserTimezone(guild_id: string, user_id: string): Promise<boolean> {
  const result = await db`DELETE FROM timezone_user WHERE guild_id = ${guild_id} AND user_id = ${user_id}`;
  return result.changes && result.changes > 0;
}

export async function getUserTimezone(guild_id: string, user_id: string): Promise<string | null> {
  const result = await db`SELECT timezone FROM timezone_user WHERE guild_id = ${guild_id} AND user_id = ${user_id}`;
  return result.length > 0 ? result[0].timezone : null;
}

export async function getGuildTimezones(guild_id: string): Promise<{ user_id: string, timezone: string }[]> {
  const result = await db`SELECT user_id, timezone FROM timezone_user WHERE guild_id = ${guild_id}`;
  return Array.isArray(result) ? result : [];
}

export async function removeGuildTimezones(guild_id: string): Promise<void> {
  await db`DELETE FROM timezone_user WHERE guild_id = ${guild_id}`;
}

export async function removeUserTimezonesEverywhere(user_id: string): Promise<void> {
  await db`DELETE FROM timezone_user WHERE user_id = ${user_id}`;
}

export async function setGuildTimezoneMessage(guild_id: string, channel_id: string, message_id: string): Promise<void> {
  await ensureConfig(guild_id);
  await db`
    INSERT INTO timezone_message (guild_id, channel_id, message_id)
    VALUES (${guild_id}, ${channel_id}, ${message_id})
    ON CONFLICT(guild_id) DO UPDATE SET
      channel_id = excluded.channel_id,
      message_id = excluded.message_id;
  `;
}

export async function removeGuildTimezoneMessageByMsgId(guild_id: string, message_id: string): Promise<void> {
  await db`DELETE FROM timezone_message WHERE guild_id = ${guild_id} AND message_id = ${message_id}`;
}
export async function removeGuildTimezoneMessageByChannelId(guild_id: string, channel_id: string): Promise<void> {
  await db`DELETE FROM timezone_message WHERE guild_id = ${guild_id} AND channel_id = ${channel_id}`;
}

export async function getGuildTimezoneMessage(guild_id: string): Promise<{ channel_id: string, message_id: string } | null> {
  const result = await db`SELECT channel_id, message_id FROM timezone_message WHERE guild_id = ${guild_id}`;
  if (result.length === 0) return null;
  return {
    channel_id: result[0].channel_id,
    message_id: result[0].message_id,
  };
}

export async function getTimezoneMessages(): Promise<{ channel_id: string, message_id: string, guild_id: string }[]> {
  const result = await db`SELECT channel_id, message_id, guild_id FROM timezone_message`;
  return Array.isArray(result) ? result : [];
}

export async function getGuildActions(guild_id: string): Promise<{ join_role_id: string | null, log_channel_id: string | null } | null> {
  const result = await db`SELECT join_role_id, log_channel_id FROM member_actions WHERE guild_id = ${guild_id}`;
  if (result.length === 0) return null;
  return {
    join_role_id: result[0].join_role_id,
    log_channel_id: result[0].log_channel_id,
  };
}

export async function setGuildActions(guild_id: string, { join_role_id, log_channel_id }: { join_role_id: string | null, log_channel_id: string | null }): Promise<void> {
  await ensureConfig(guild_id);
  await db`
    INSERT INTO member_actions (guild_id, join_role_id, log_channel_id)
    VALUES (${guild_id}, ${join_role_id}, ${log_channel_id})
    ON CONFLICT(guild_id) DO UPDATE SET
      join_role_id = excluded.join_role_id,
      log_channel_id = excluded.log_channel_id;
  `;
}

export async function removeGuildActions(guild_id: string): Promise<void> {
  await db`DELETE FROM member_actions WHERE guild_id = ${guild_id}`;
}

export async function removeGuildActionsLogByChannelId(guild_id: string, channel_id: string): Promise<void> {
  await db`
    UPDATE member_actions
    SET log_channel_id = NULL
    WHERE guild_id = ${guild_id} AND log_channel_id = ${channel_id}
  `;
}

export async function removeGuildActionsRoleByRoleId(guild_id: string, role_id: string): Promise<void> {
  await db`
    UPDATE member_actions
    SET join_role_id = NULL
    WHERE guild_id = ${guild_id} AND join_role_id = ${role_id}
  `;
}