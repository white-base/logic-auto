import { createModuleRouterFactory, manifestToJSON } from '../../lib/ui-module.js';
import { moduleDefinition, buildFormModel } from './controller.js';

const { createRouter: buildBaseRouter, meta } = createModuleRouterFactory(moduleDefinition);

export const createRouter = (manifest) => {
  const router = buildBaseRouter(manifest);

  router.get(`/${moduleDefinition.slug}/form`, async (req, res, next) => {
    try {
      const manifestJSON = manifestToJSON(manifest);
      const formModel = await Promise.resolve(buildFormModel({ manifestJSON }));
      res.render('sample-a-form', {
        title: `${moduleDefinition.title} — Form`,
        description: moduleDefinition.description,
        routePath: `${meta.routePath}/form`,
        manifest: manifestJSON,
        ...formModel,
      });
    } catch (error) {
      next(error);
    }
  });

  // TODO: router.post(`/${moduleDefinition.slug}/form`, handler) to handle actual submissions.

  return router;
};

export { meta };
