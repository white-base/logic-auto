export function createUIModule(options = {}) {
  const {
    slug,
    title,
    description,
    view = slug,
    model = () => ({}),
  } = options;

  if (!slug) {
    throw new Error('createUIModule requires a slug.');
  }

  const routePath = `/modules/${slug}`;
  const meta = { slug, routePath, viewName: view, title, description };

  const registerRoutes = (app, manifest) => {
    app.get(routePath, async (req, res, next) => {
      try {
        const manifestJSON = manifestToJSON(manifest);
        const additions = await Promise.resolve(model({ req, manifest, manifestJSON }));
        res.render(view, {
          title,
          description,
          routePath,
          manifest: manifestJSON,
          ...(additions ?? {}),
        });
      } catch (error) {
        next(error);
      }
    });
  };

  return { meta, registerRoutes };
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
