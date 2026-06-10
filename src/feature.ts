import type { GatewayDispatchEvents, GatewayDispatchPayload } from "discord-api-types/v10";
import type { API, MappedEvents } from "@discordjs/core";


type HandlerContext<K extends GatewayDispatchEvents> = {
    data: Extract<GatewayDispatchPayload, { t: K }>["d"];
    api: API;
    applicationId: string;
    db: typeof import("./db");
    commandIds: Record<string, string>;
};

export type EventModule = {
    name: string;
    handlers: Partial<{
        [K in GatewayDispatchEvents]: (
            context: HandlerContext<K>
        ) => Promise<any>;
    }>;
};


import counting from "./features/counting";
import forceNick from "./features/force-nick";
import guildActions from "./features/guild-actions";
import guildTagRole from "./features/guild-tag-role";
import timezone from "./features/timezone";
import wave from "./features/wave";

export const features = [
    counting,
    forceNick,
    guildActions,
    guildTagRole,
    timezone,
    wave,
]

export default features;
