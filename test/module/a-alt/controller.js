import { marked } from 'marked';
import { toRouteSlug } from '../../lib/ui-module.js';

const moduleTitle = 'Sample Module A-alt — Dependency Cards';
const moduleDescription =
  'Aggregates metadata from dependency modules (Sample B, Sample C) and renders their cards alongside docs content.';

const markdownSource = `# Dependency Showcase

This module demonstrates how a LogicManifest-powered UI component can consume its \`uiDeps\`
collection, hydrate dependency manifests, and surface their metadata inside a single EJS view.`;

export const moduleDefinition = {
  slug: 'sample-a-alt',
  title: moduleTitle,
  description: moduleDescription,
  model: async ({ manifest }) => ({
    html: marked.parse(markdownSource),
    dependencyCards: await collectDependencyCards(manifest),
  }),
};

async function collectDependencyCards(lm) {
  const cards = [];
  if (!lm?.uiDepsMap || lm.uiDepsMap.size === 0) {
    return cards;
  }
  // PropertyCollection preserves insertion order, so this matches logic.json uiDeps definition.
  for (const [packageName, childManifest] of lm.uiDepsMap.entries()) {
    if (!childManifest) continue;
    const exportsObject = await lm.getExports(packageName).catch(() => null);
    const title =
      exportsObject?.meta?.title ?? childManifest.category ?? childManifest.packageName;
    const description =
      exportsObject?.meta?.description ??
      childManifest.contracts?.provides?.[0]?.description ??
      'Logic module';
    const tags = childManifest.tags ?? [];
    const routePath = `/modules/${toRouteSlug(childManifest.packageName)}`;
    cards.push({
      packageName,
      title,
      description,
      tags,
      routePath,
    });
  }
  return cards;
}
