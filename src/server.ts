import { config } from '@/config/index';
import { startServer } from '@/app';
import { startNotificationWorker } from '@/queues/processors/notification.processor';

async function main(): Promise<void> {
  startNotificationWorker();
  const httpServer = await startServer();

  httpServer.listen(config.PORT, () => {
    console.log(`Server running on http://localhost:${config.PORT}`);
    console.log(`GraphQL ready at http://localhost:${config.PORT}/graphql`);
  });
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
