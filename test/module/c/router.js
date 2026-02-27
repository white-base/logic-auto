import { createModuleRouterFactory } from '../../lib/ui-module.js';
import { moduleDefinition } from './controller.js';

const { createRouter, meta } = createModuleRouterFactory(moduleDefinition);

export { createRouter, meta };
