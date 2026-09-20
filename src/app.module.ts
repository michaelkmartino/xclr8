import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { DbModule } from './db/db.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { ManufacturersModule } from './manufacturers/manufacturers.module.js';
import { QuotesModule } from './quotes/quotes.module.js';
import { LineItemsModule } from './line-items/line-items.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { PrintSelectionsModule } from './print-selections/print-selections.module.js';

@Module({
  imports: [
    ServeStaticModule.forRoot({ rootPath: join(process.cwd(), 'public') }),
    DbModule,
    JobsModule,
    ManufacturersModule,
    QuotesModule,
    LineItemsModule,
    CustomersModule,
    PrintSelectionsModule,
  ],
})
export class AppModule {}
