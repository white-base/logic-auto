import { moduleDefinition as moduleCDefinition } from '../c/controller.js';
import { meta as moduleCMeta } from '../c/router.js';

const moduleTitle = 'Sample Module D — Checklist Highlights';
const moduleDescription = 'Summarizes Sample C onboarding steps with quick links.';

async function deriveChecklistFromModuleC() {
  const modelFn = moduleCDefinition?.model;
  if (typeof modelFn !== 'function') {
    return [];
  }
  try {
    const result = await Promise.resolve(modelFn({ manifestJSON: {} }));
    return Array.isArray(result?.steps) ? result.steps : [];
  } catch (error) {
    console.warn('Failed to derive steps from Sample C model.', error);
    return [];
  }
}

function buildDependencyPayload(steps = []) {
  const slug = moduleCMeta?.slug ?? 'sample-c';
  const routePath = moduleCMeta?.routePath ?? `/modules/${slug}`;
  return {
    slug,
    title: moduleCMeta?.title ?? 'Sample Module C',
    description:
      moduleCMeta?.description ?? 'Highlights how to mix manifest-driven metadata with static view data.',
    routePath,
    totalSteps: steps.length,
    firstStep: steps[0] ?? null,
    steps,
  };
}

export const moduleDefinition = {
  slug: 'sample-d',
  title: moduleTitle,
  description: moduleDescription,
  model: async () => {
    const steps = await deriveChecklistFromModuleC();
    return {
      headline: 'Onboarding Checklist Snapshot',
      teaser: 'Use Module C to walk through platform setup faster.',
      dependency: buildDependencyPayload(steps),
    };
  },
};
