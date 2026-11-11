import { defineConfig } from 'prisma/config';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import path from 'node:path';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  experimental: { adapter: true },
  engine: 'js',
  adapter: async () => new PrismaLibSQL({ url: process.env.DATABASE_URL || `file:${path.resolve('prisma/dev.db')}` }),
});
