import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config';
import routes from './routes';
import { requestLogger, notFoundHandler, errorHandler } from './middleware';

export const createApp = (): Application => {
  const app: Application = express();

  // Security & Utility Middleware
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  // Mount API routes
  app.use('/api', routes);

  // Catch 404
  app.use(notFoundHandler);

  // Global Error Handler
  app.use(errorHandler);

  return app;
};

export default createApp;
