import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRouter } from './router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manifestPath = path.join(__dirname, 'logic.json');

async function bootstrap() {
  const app = express();
  const { router, moduleSummaries, viewRoots: moduleViewRoots } = await createRouter({
    manifestPath,
    forceReload: true,
  });
  const baseViewRoot = path.join(__dirname, 'views');
  app.set('views', [baseViewRoot, ...moduleViewRoots]);
  app.set('view engine', 'ejs');
  app.use('/modules', router);
  app.get('/', (req, res) => {
    res.render('index', { modules: moduleSummaries });
  });
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => {
    console.log(`LogicManifest demo running on http://localhost:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
