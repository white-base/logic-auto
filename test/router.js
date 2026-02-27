import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

import { loadBundleRegistry } from './controller.js';
import { LogicManifest } from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manifestPath = path.join(__dirname, 'logic.json');

let rootManifest = null;
try {
  rootManifest = await LogicManifest.load(manifestPath);
  console.log('[router] Loaded root manifest:', rootManifest?.packageName ?? '<anonymous>');
} catch (error) {
  console.error('[router] Failed to load LogicManifest:', error);
  throw error;
}

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
