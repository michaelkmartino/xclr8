import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

export const DB = 'DB';

@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: (): NodePgDatabase<typeof schema> => {
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
