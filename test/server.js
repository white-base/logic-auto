import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadManifest } from '../index.js';
import { toRouteSlug } from './lib/ui-module.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manifestPath = path.join(__dirname, 'logic.json');

async function bootstrap() {
  const app = express();
  const viewRoots = [path.join(__dirname, 'views')];

  const bundleManifest = await loadManifest({ manifestPath, forceReload: true });
  const isValid = await bundleManifest.validate();
  if (!isValid) {
    const errors = bundleManifest.getValidationErrors();
    throw new Error(`Bundle manifest validation failed:\n${errors.join('\n')}`);
  }

  const moduleEntries = [...bundleManifest.uiDepsMap.values()];
  const moduleSummaries = [];

  for (const manifest of moduleEntries) {
    const slug = toRouteSlug(manifest.packageName);
    const routePath = `/modules/${slug}`;
    const absImplementation = resolveImplementationPath(manifest.baseDir, manifest.implementation);
    const moduleViews = path.join(path.dirname(absImplementation), 'views');
    viewRoots.push(moduleViews);
    const exportsObject = await manifest.getExports();
    const createRouter =
      typeof exportsObject.createRouter === 'function'
        ? exportsObject.createRouter
        : typeof exportsObject.buildRouter === 'function'
          ? exportsObject.buildRouter
          : null;
    if (createRouter) {
      const router = createRouter(manifest);
      if (router) {
        app.use('/modules', router);
      } else {
        console.warn(`Router factory for ${manifest.packageName} returned nothing.`);
      }
    } else {
      console.warn(`No router factory found for ${manifest.packageName}.`);
    }
    moduleSummaries.push({
      slug,
      routePath,
      title: manifest.category ?? manifest.packageName,
      description: manifest.contracts?.provides?.[0]?.description ?? 'Logic module',
      tags: manifest.tags ?? [],
    });
  }

  app.set('views', viewRoots);
  app.set('view engine', 'ejs');

  app.get('/', (req, res) => {
    res.render('index', { modules: moduleSummaries });
  });

  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => {
    console.log(`LogicManifest demo running on http://localhost:${port}`);
  });
}

function resolveImplementationPath(baseDir, implementation) {
  if (!implementation) {
    return baseDir;
  }
  return path.isAbsolute(implementation) ? implementation : path.join(baseDir, implementation);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
