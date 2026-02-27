import express from 'express';

import { loadBundleRegistry } from './controller.js';

export async function createRouter(options = {}) {
  const router = express.Router();
  const { viewRoots, moduleSummaries, routerDescriptors } = await loadBundleRegistry(options);

  for (const descriptor of routerDescriptors) {
    const { routerFactory, manifest, packageName } = descriptor;
    if (routerFactory) {
      const moduleRouter = routerFactory(manifest);
      if (moduleRouter) {
        router.use('/', moduleRouter);
      } else {
        console.warn(`Router factory for ${packageName} returned nothing.`);
      }
    } else {
      console.warn(`No router factory found for ${packageName}.`);
    }
  }

  return { router, moduleSummaries, viewRoots };
}
