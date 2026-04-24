const IDENTIFIER_TABLE = {
    patroller: { old_prison: "trickymaze:patroller_zombie" },
};
export function resolveEntityId(behavior, theme) {
    const id = IDENTIFIER_TABLE[behavior]?.[theme];
    if (!id)
        throw new Error(`no entity registered for ${behavior}/${theme}`);
    return id;
}
