import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

async function main() {
  const app = createApp();

  // Verify DB connectivity before accepting traffic.
  await prisma.$connect();

  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`🟢 JunkShop API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`\n${signal} received, shutting down...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server', err);
  await prisma.$disconnect();
  process.exit(1);
});
