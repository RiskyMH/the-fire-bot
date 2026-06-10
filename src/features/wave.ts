import { GatewayDispatchEvents, MessageType } from "discord-api-types/v10";
import type { EventModule } from "../feature";

const waveModule: EventModule = {
    name: "wave",
    handlers: {
        [GatewayDispatchEvents.MessageCreate]: async ({ data: message, api, db }) => {
            const useCustomEmoji = true;
            let lowerContent = (message.content || '').toLowerCase();
            if ((lowerContent === 'hi' || lowerContent === 'hello' || message.type === MessageType.UserJoin)) {
                await api.channels.addMessageReaction(message.channel_id, message.id, useCustomEmoji ? 'wave:1483351276862574763' : "👋");
                return;
            }
        },
    },
};

export default waveModule;
