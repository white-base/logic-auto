const moduleTitle = 'Sample Module B — Analytics Cards';
const moduleDescription = 'Renders a grid of analytics cards powered by LogicManifest metadata.';
const deriveCards = (manifestJSON) =>
  (manifestJSON.tags || []).map((tag, idx) => ({
    title: `${tag} Insight`,
    value: `${(idx + 1) * 7}k`,
    trend: idx % 2 === 0 ? 'up' : 'down',
  }));

export const moduleDefinition = {
  slug: 'sample-b',
  title: moduleTitle,
  description: moduleDescription,
  model: ({ manifestJSON }) => ({
    cards: deriveCards(manifestJSON),
  }),
};
