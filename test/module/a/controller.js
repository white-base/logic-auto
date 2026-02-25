import { createUIModule } from '../../lib/ui-module.js';

const moduleTitle = 'Sample Module A — Hero Banner';
const moduleDescription = 'Demonstrates pulling LogicManifest metadata into an Express + EJS view.';

const { registerRoutes, meta } = createUIModule({
  slug: 'sample-a',
  title: moduleTitle,
  description: moduleDescription,
});

export { registerRoutes, meta };
