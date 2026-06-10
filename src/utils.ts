import { ApplicationCommandOptionType, type APIApplicationCommandInteractionDataOption, type APIChatInputApplicationCommandInteractionData } from "discord-api-types/v10";

type OptionValue = string | number | boolean;
type OptionsRecord = Record<string, OptionValue>;
export function flattenOptions(opts?: APIApplicationCommandInteractionDataOption[]): OptionsRecord {
    const result: OptionsRecord = {};
    if (!opts) return result;
    for (const opt of opts) {
        if ("value" in opt) result[opt.name] = opt.value;
    }
    return result;
}

export function getSubcommandAndOptions(data: APIChatInputApplicationCommandInteractionData): {
    subcommand: string | null;
    subcommandGroup: string | null;
    options: OptionsRecord;
} {
    for (const option of data.options || []) {
        if (option.type === ApplicationCommandOptionType.Subcommand) {
            return { subcommand: option.name, subcommandGroup: null, options: flattenOptions(option.options) };
        } else if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
            for (const sub of option.options || []) {
                if (sub.type === ApplicationCommandOptionType.Subcommand) {
                    return { subcommand: sub.name, subcommandGroup: option.name, options: flattenOptions(sub.options) };
                }
            }
        } else {
            return { subcommand: null, subcommandGroup: null, options: flattenOptions(data.options) };
        }
    }
    return { subcommand: null, subcommandGroup: null, options: {} };
}

export function getFocusedAutoCompleteOption(opts: APIApplicationCommandInteractionDataOption[]): APIApplicationCommandInteractionDataOption | null {
    let foundOption: APIApplicationCommandInteractionDataOption | undefined;
    if (ApplicationCommandOptionType.Subcommand === opts[0]?.type) {
        foundOption = opts[0].options?.find(o => 'focused' in o && o.focused);
    }
    else if (ApplicationCommandOptionType.SubcommandGroup === opts?.[0]?.type) {
        foundOption = opts?.[0]?.options?.[0]?.options?.find(o => 'focused' in o && o.focused);
    } else {
        foundOption = opts?.find(o => 'focused' in o && o.focused);
    }
    return foundOption || null;
}



export const trim = (str: string, max: number) => str.length > max ? str.slice(0, max - 1) + "…" : str;
export const hasBitfield = (flags: number, bitfield: number) => (flags & bitfield) === bitfield;
export const hasBitfield2 = (flags: string, bitfield: bigint) => {
    if (typeof flags !== "string") return false;
    return (BigInt(flags) & bitfield) === bitfield;
};

