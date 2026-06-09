import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

export type AppEnv = 'local' | 'staging' | 'production';

function loadEnvFiles(): AppEnv {
  const root = process.cwd();

  // Base file (may define APP_ENV)
  const basePath = path.join(root, '.env');
  if (fs.existsSync(basePath)) {
    dotenv.config({ path: basePath });
  }

  const appEnvRaw = process.env.APP_ENV?.toLowerCase();
  let appEnv: AppEnv;
  if (appEnvRaw === 'local' || appEnvRaw === 'staging' || appEnvRaw === 'production') {
    appEnv = appEnvRaw;
  } else if (process.env.NODE_ENV === 'production') {
    appEnv = 'production';
  } else {
    appEnv = 'local';
  }

  process.env.APP_ENV = appEnv;

  const envPath = path.join(root, `.env.${appEnv}`);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }

  return appEnv;
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const appEnv = loadEnvFiles();
const nodeEnv = process.env.NODE_ENV ?? (appEnv === 'local' ? 'development' : 'production');
const isProd = nodeEnv === 'production';
const isDeployed = appEnv === 'staging' || appEnv === 'production';

export const env = {
  appEnv,
  nodeEnv,
  port: parseInt(process.env.PORT ?? '4000', 10),
  databaseUrl: required('DATABASE_URL'),
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', isDeployed ? undefined : 'dev_access_secret'),
    refreshSecret: required('JWT_REFRESH_SECRET', isDeployed ? undefined : 'dev_refresh_secret'),
    accessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  },
  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL ?? 'admin@junkshop.local',
    phone: process.env.SUPER_ADMIN_PHONE ?? '0900000000',
    password: process.env.SUPER_ADMIN_PASSWORD ?? 'Admin@12345',
  },
  seedDemoEntity: process.env.SEED_DEMO_ENTITY !== 'false',
};

export { isProd, isDeployed, appEnv };
