import { createUIModule } from '../../lib/ui-module.js';

const moduleTitle = 'Sample Module C — Onboarding Checklist';
const moduleDescription = 'Highlights how to mix manifest-driven metadata with static view data.';

const checklistSteps = [
  'Confirm LogicManifest validations pass',
  'Load exports via manifest.getExports()',
  'Render the module-specific EJS view',
];

const { buildRouter, meta } = createUIModule({
  slug: 'sample-c',
  title: moduleTitle,
  description: moduleDescription,
  model: () => ({ steps: checklistSteps }),
});

export const createRouter = (manifest) => buildRouter(manifest);
export { meta };
