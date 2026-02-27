import path from 'node:path';

import { loadManifest } from '../index.js';
import { toRouteSlug } from './lib/ui-module.js';

export async function loadBundleRegistry(options = {}) {
  const { manifestPath, forceReload = true } = options;

  if (!manifestPath) {
    throw new Error('loadBundleRegistry requires a manifestPath.');
  }

  const bundleManifest = await loadManifest({ manifestPath, forceReload });
  const isValid = await bundleManifest.validate();
  if (!isValid) {
    const errors = bundleManifest.getValidationErrors();
    throw new Error(`Bundle manifest validation failed:\n${errors.join('\n')}`);
  }

  const moduleEntries = [...bundleManifest.uiDepsMap.values()];
  const viewRoots = [];
  const moduleSummaries = [];
  const routerDescriptors = [];

  for (const manifest of moduleEntries) {
    const absImplementation = resolveImplementationPath(manifest.baseDir, manifest.implementation);
    const moduleViews = path.join(path.dirname(absImplementation), 'views');
    viewRoots.push(moduleViews);
    const exportsObject = await manifest.getExports();
    routerDescriptors.push({
      packageName: manifest.packageName,
      routerFactory: pickRouterFactory(exportsObject),
      manifest,
    });
    moduleSummaries.push(buildModuleSummary(exportsObject, manifest));
  }

  return { viewRoots, moduleSummaries, routerDescriptors };
}

function resolveImplementationPath(baseDir, implementation) {
  if (!implementation) {
    return baseDir;
  }
  return path.isAbsolute(implementation) ? implementation : path.join(baseDir, implementation);
}

function pickRouterFactory(exportsObject = {}) {
  if (typeof exportsObject.createRouter === 'function') {
    return exportsObject.createRouter;
  }
  if (typeof exportsObject.buildRouter === 'function') {
    return exportsObject.buildRouter;
  }
  return null;
}

function buildModuleSummary(exportsObject, manifest) {
  const fallbackSlug = toRouteSlug(manifest.packageName);
  const fallbackRoutePath = `/modules/${fallbackSlug}`;
  const meta = exportsObject?.meta;
  return {
    slug: meta?.slug ?? fallbackSlug,
    routePath: meta?.routePath ?? fallbackRoutePath,
    title: meta?.title ?? manifest.category ?? manifest.packageName,
    description:
      meta?.description ??
      manifest.contracts?.provides?.[0]?.description ??
      'Logic module',
    tags: manifest.tags ?? [],
  };
}
