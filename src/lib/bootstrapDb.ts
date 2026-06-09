import { execSync } from 'node:child_process';
import { isDeployed } from '../config/env';

/** Apply migrations + seed on Render/Supabase before the API accepts traffic. */
export function bootstrapDatabase(): void {
  if (!isDeployed) return;

  if (!process.env.DIRECT_URL?.trim()) {
    throw new Error(
      'DIRECT_URL is required on staging/production (Supabase direct URI, port 5432). ' +
        'Set it in Render Environment variables.',
    );
  }

  // eslint-disable-next-line no-console
  console.log('📦 Applying database migrations (prisma migrate deploy)...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });

  // eslint-disable-next-line no-console
  console.log('🌱 Running database seed...');
  execSync('node dist/seed.js', { stdio: 'inherit', env: process.env });

  // eslint-disable-next-line no-console
  console.log('✅ Database bootstrap complete');
}
