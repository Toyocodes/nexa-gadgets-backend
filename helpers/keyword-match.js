// Case-insensitive keyword match across the fields customers search by.
// Input is escaped so it's matched literally (prevents regex injection / ReDoS)
// and capped in length. Returns null when there's nothing to search for.
const keywordMatch = (keyword) => {
  if (typeof keyword !== "string") return null;
  const trimmed = keyword.trim().slice(0, 100);
  if (!trimmed) return null;

  const regEx = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return {
    $or: [{ title: regEx }, { description: regEx }, { category: regEx }, { brand: regEx }],
  };
};

module.exports = { keywordMatch };
