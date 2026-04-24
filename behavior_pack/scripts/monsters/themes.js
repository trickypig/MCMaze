export const themeForFloor = (floor) => floor <= 2 ? "old_prison" :
    floor <= 4 ? "the_depths" :
        floor <= 6 ? "nethers_edge" : "the_abyss";
const IDENTIFIER_TABLE = {
    patroller: { old_prison: "trickymaze:patroller_zombie" },
};
export function resolveEntityId(behavior, theme) {
    const id = IDENTIFIER_TABLE[behavior]?.[theme];
    if (!id)
        throw new Error(`no entity registered for ${behavior}/${theme}`);
    return id;
}
