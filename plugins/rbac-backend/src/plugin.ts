import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './service/router';

export const rbacPlugin = createBackendPlugin({
  pluginId: 'rbac',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({ httpRouter, logger, config }) {
        httpRouter.addAuthPolicy({
          path: '*',
          allow: 'unauthenticated',
        });
        httpRouter.use(
          await createRouter({
            logger: logger as any,
            config,
          }),
        );
      },
    });
  },
});
