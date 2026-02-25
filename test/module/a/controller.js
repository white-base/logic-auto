import { createUIModule } from '../../lib/ui-module.js';

const moduleTitle = 'Sample Module A — Hero Banner';
const moduleDescription = 'Demonstrates pulling LogicManifest metadata into an Express + EJS view.';

const { buildRouter, meta } = createUIModule({
  slug: 'sample-a',
  title: moduleTitle,
  description: moduleDescription,
});

export const createRouter = (manifest) => buildRouter(manifest);
export { meta };
