import { createApp } from './app';
import { appConfig } from './config/app.config';

async function bootstrap() {
  const app = await createApp();

  app.listen(appConfig.port, () => {
    console.log(`[${appConfig.nodeEnv}] API running on http://localhost:${appConfig.port}`);
    console.log(`[${appConfig.nodeEnv}] API base: ${appConfig.apiPrefix}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});