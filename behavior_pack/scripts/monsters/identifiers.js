const IDENTIFIER_TABLE = {
    patroller: {
        old_prison: "trickymaze:old_prison_patroller",
        depths: "trickymaze:depths_patroller",
    },
    sleeper: {
        old_prison: "trickymaze:old_prison_sleeper",
        depths: "trickymaze:depths_sleeper",
    },
    lurker: {
        depths: "trickymaze:depths_lurker",
    },
    sentry_archer: {
        old_prison: "trickymaze:old_prison_sentry",
        depths: "trickymaze:depths_sentry",
    },
};
export function resolveEntityId(behavior, theme) {
    const id = IDENTIFIER_TABLE[behavior]?.[theme];
    if (!id)
        throw new Error(`no entity registered for ${behavior}/${theme}`);
    return id;
}
