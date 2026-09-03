import { createApp } from './app';
import config from './config';
import { connectDB } from './config/db';

const startServer = async () => {
  await connectDB();
  const app = createApp();

  const server = app.listen(config.port, () => {
    console.log(`====================================================`);
    console.log(`🚀 ${config.serviceTitle} is running`);
    console.log(`🌍 Environment: ${config.nodeEnv}`);
    console.log(`🩺 Health endpoint: http://localhost:${config.port}/api/v1/health`);
    console.log(`====================================================`);
  });

  // Graceful shutdown handling
  const handleShutdown = (signal: string) => {
    console.log(`\nReceived ${signal}. Gracefully shutting down...`);
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  return server;
};

const server = startServer();
export default server;
