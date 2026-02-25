import express from 'express';

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

  const buildRouter = (manifest) => {
    const router = express.Router();
    // router는 app.use('/modules', router) 형태로 마운트된다고 가정하며,
    // 각 모듈은 /modules/<slug> 경로를 자체적으로 등록한다.
    router.get(`/${slug}`, async (req, res, next) => {
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
    return router;
  };

  return { meta, buildRouter };
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
