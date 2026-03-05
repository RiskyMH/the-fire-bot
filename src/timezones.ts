import timezones from "@vvo/tzdb/raw-time-zones.json";

export interface Timezone {
    name: string;
    displayName: string;
    abbr: string;
    offset: number;
    popular?: boolean;
    hasDST?: boolean;
    cities?: string[];
    country?: string;
}

const utcTimezone: Timezone = {
    name: "UTC",
    displayName: "Coordinated Universal Time",
    abbr: "UTC",
    offset: 0,
    hasDST: false,
}

export const getTimeZones = (): Timezone[] => {
    return JSON.parse(JSON.stringify([utcTimezone].concat(timezones.map(tz => ({
        name: tz.name,
        displayName: tz.alternativeName,
        abbr: tz.abbreviation,
        offset: tz.rawOffsetInMinutes / 60,
        popular: popularTimezones.includes(tz.name) ? true : undefined,
        hasDST: checkDST(tz.name) ? true : undefined,
        cities: tz.mainCities,
        country: tz.countryName
    })))))
};

function checkDST(timeZone: string): boolean {
    const getOffset = (date: Date) => {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            timeZoneName: 'shortOffset'
        }).formatToParts(date);
        return parts.find(p => p.type === 'timeZoneName')?.value || '';
    };

    const year = new Date().getFullYear();
    const jan = new Date(year, 0, 1);
    const jul = new Date(year, 6, 1);

    return getOffset(jan) !== getOffset(jul);
}

const popularTimezones = [
    "Pacific/Pago_Pago",      // GMT-11, American Samoa
    "Pacific/Honolulu",       // GMT-10, Hawaii
    "America/Anchorage",      // GMT-09, Alaska
    "America/Los_Angeles",    // GMT-08, US Pacific
    "America/Denver",         // GMT-07, US Mountain
    "America/Chicago",        // GMT-06, US Central
    "America/New_York",       // GMT-05, US Eastern
    "America/Sao_Paulo",      // GMT-03, Brazil
    "Atlantic/South_Georgia", // GMT-02, South Georgia
    "Atlantic/Azores",        // GMT-01, Azores (Portugal)
    "Europe/London",          // GMT+00, UK
    "Europe/Berlin",          // GMT+01, Central Europe
    "Europe/Athens",          // GMT+02, Eastern Europe
    "Africa/Johannesburg",    // GMT+02, South Africa
    "Europe/Moscow",          // GMT+03, Russia (Moscow)
    "Asia/Tehran",            // GMT+03:30, Iran
    "Asia/Dubai",             // GMT+04, UAE
    "Asia/Kabul",             // GMT+04:30, Afghanistan
    "Asia/Karachi",           // GMT+05, Pakistan
    "Asia/Kolkata",           // GMT+05:30, India
    "Asia/Dhaka",             // GMT+06, Bangladesh
    "Asia/Bangkok",           // GMT+07, Thailand
    "Asia/Shanghai",          // GMT+08, China
    "Asia/Tokyo",             // GMT+09, Japan
    "Australia/Sydney"        // GMT+10, Australia
];
