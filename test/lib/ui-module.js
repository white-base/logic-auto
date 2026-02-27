import express from 'express';

export function createModuleRouterFactory(moduleDefinition = {}) {
  if (!moduleDefinition || typeof moduleDefinition !== 'object') {
    throw new Error('createModuleRouterFactory requires a module definition.');
  }
  const meta = buildModuleMeta(moduleDefinition);
  return {
    meta,
    createRouter(manifest) {
      const router = express.Router();
      registerBaseModuleRoute({ router, manifest, moduleDefinition, meta });
      return router;
    },
  };
}

export function manifestToJSON(manifest) {
  if (!manifest || typeof manifest.toJSON !== 'function') {
    return manifest ?? {};
  }
  return manifest.toJSON();
}

export function toRouteSlug(packageName = '') {
  const raw = packageName.includes('/') ? packageName.split('/').pop() : packageName;
  return raw.replace(/[^0-9a-z-]+/gi, '-').toLowerCase();
}

function buildModuleMeta(definition = {}) {
  const { slug, title, description } = definition;
  if (!slug) {
    throw new Error('moduleDefinition.slug is required.');
  }
  const viewName = definition.view ?? slug;
  return {
    slug,
    routePath: `/modules/${slug}`,
    viewName,
    title,
    description,
  };
}

function registerBaseModuleRoute({
  router,
  manifest,
  moduleDefinition,
  meta,
}) {
  if (!router) {
    throw new Error('registerBaseModuleRoute requires an Express router instance.');
  }
  if (!moduleDefinition) {
    throw new Error('registerBaseModuleRoute requires a moduleDefinition.');
  }
  const handlerModel =
    typeof moduleDefinition.model === 'function'
      ? moduleDefinition.model
      : () => ({});
  const viewName = meta?.viewName ?? moduleDefinition.view ?? moduleDefinition.slug;
  const routeSlug = meta?.slug ?? moduleDefinition.slug;
  const routePath = `/${routeSlug}`;

  router.get(routePath, async (req, res, next) => {
    try {
      const manifestJSON = manifestToJSON(manifest);
      const additions = await Promise.resolve(handlerModel({ req, manifest, manifestJSON }));
      res.render(viewName, {
        title: meta?.title ?? moduleDefinition.title,
        description: meta?.description ?? moduleDefinition.description,
        routePath: meta?.routePath ?? `/modules/${routeSlug}`,
        manifest: manifestJSON,
        ...(additions ?? {}),
      });
    } catch (error) {
      next(error);
    }
  });
}
