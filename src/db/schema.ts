import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum('user_role', ['admin', 'editor', 'viewer']);
export const customerTypeEnum = pgEnum('customer_type', ['individual', 'group']);

// ---------------------------------------------------------------------------
// Branch / office (multi-office scaling, per roadmap)
// ---------------------------------------------------------------------------

export const branches = pgTable('branches', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Users & permissions
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  role: userRoleEnum('role').notNull().default('editor'),
  branchId: uuid('branch_id').references(() => branches.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  emailUnique: uniqueIndex('users_email_unique').on(table.email),
}));

// ---------------------------------------------------------------------------
// Manufacturer — mirrors the Phase 1 Salesforce Manufacturer object
// ---------------------------------------------------------------------------

export const manufacturers = pgTable('manufacturers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  standardCommissionPct: numeric('standard_commission_pct', { precision: 6, scale: 4 }).notNull().default('0'),
  standardOverageSplitPct: numeric('standard_overage_split_pct', { precision: 6, scale: 4 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Job — maps to a Salesforce Opportunity once synced (Phase 3)
// ---------------------------------------------------------------------------

export const jobs = pgTable('jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  address: text('address'),
  accountName: text('account_name'),
  externalOpportunityId: text('external_opportunity_id'), // Salesforce Opportunity Id, set once linked
  branchId: uuid('branch_id').references(() => branches.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Quote — one per bid package on a Job (can span multiple manufacturers;
// Manufacturer lives at the Line Item level, confirmed 2026-09-19)
// ---------------------------------------------------------------------------

export const quotes = pgTable('quotes', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').notNull().references(() => jobs.id),
  bidPackage: text('bid_package').notNull().default('Base Bid'),
  createdById: uuid('created_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Quote Version — a full snapshot of a Quote's line items/pricing at a point
// in time. A version can represent ANY kind of change (drawings, counts,
// fixture swaps) — confirmed 2026-09-19 — so it's a snapshot, not a diff.
// Exactly one version per Quote holds isReporting = true.
// Also carries the pessimistic lock (Michael/Jeff's Cahill-style locking).
// ---------------------------------------------------------------------------

export const quoteVersions = pgTable('quote_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  quoteId: uuid('quote_id').notNull().references(() => quotes.id),
  versionNumber: integer('version_number').notNull(),
  label: text('label'), // short free-text reason, e.g. "revised drawings 9/19"
  isReporting: boolean('is_reporting').notNull().default(false),
  // Plain text for now, not a User FK — real login/auth isn't built yet.
  // Swap for a lockHolderId FK to users once auth exists.
  lockHolderName: text('lock_holder_name'),
  lockAcquiredAt: timestamp('lock_acquired_at'),
  createdById: uuid('created_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  // Bumped on any change within this version (line items, price columns,
  // print selections, locking) so the "recent quotes" list can show what's
  // actively being worked on and by whom. Plain text for now, same reason
  // as lockHolderName above.
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastEditedBy: text('last_edited_by'),
});

// ---------------------------------------------------------------------------
// Line Item — field list confirmed 2026-09-19: Quote Line #, Quantity,
// Fixture Type (open text), Manufacturer (picklist), Part Number,
// Part Description, Notes — plus the Phase 1 commission fields.
// ---------------------------------------------------------------------------

export const lineItems = pgTable('line_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  quoteVersionId: uuid('quote_version_id').notNull().references(() => quoteVersions.id),
  lineNumber: integer('line_number').notNull(), // server-assigned, never client-editable (2026-09-19)
  quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull().default('1'),
  // Nullable: a Note row (isNote = true) has no fixture/manufacturer/pricing,
  // it's a free-text line that shares the line-number sequence (2026-09-19).
  fixtureType: text('fixture_type'),
  manufacturerId: uuid('manufacturer_id').references(() => manufacturers.id),
  partNumber: text('part_number'),
  partDescription: text('part_description'),
  notes: text('notes'),
  dnBase: numeric('dn_base', { precision: 12, scale: 2 }).notNull().default('0'),
  // Auto-populated server-side from the Manufacturer's standard rates (or
  // this quote's Commission Structure override) at line-creation time — not
  // user-entered per line item anymore (confirmed 2026-09-19).
  commissionPct: numeric('commission_pct', { precision: 6, scale: 4 }),
  overageSplitPct: numeric('overage_split_pct', { precision: 6, scale: 4 }),
  // ---- Note row fields (2026-09-19) ----
  isNote: boolean('is_note').notNull().default(false),
  noteText: text('note_text'),
  // Internal-only notes never appear on a printed/sent quote.
  internalOnly: boolean('internal_only').notNull().default(false),
});

// ---------------------------------------------------------------------------
// Quote Version × Manufacturer Commission Structure — an explicit, per-quote
// override of a manufacturer's standard commission/overage split, set via
// the "Commission Structure" dialog. When present, it applies to every line
// item using that manufacturer on that quote version, overriding the
// Manufacturer master default (confirmed 2026-09-19).
// ---------------------------------------------------------------------------

export const quoteManufacturerCommissions = pgTable('quote_manufacturer_commissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  quoteVersionId: uuid('quote_version_id').notNull().references(() => quoteVersions.id),
  manufacturerId: uuid('manufacturer_id').notNull().references(() => manufacturers.id),
  commissionPct: numeric('commission_pct', { precision: 6, scale: 4 }).notNull(),
  overageSplitPct: numeric('overage_split_pct', { precision: 6, scale: 4 }).notNull(),
}, (table) => ({
  uniquePerVersion: uniqueIndex('quote_mfr_commissions_version_mfr_unique').on(table.quoteVersionId, table.manufacturerId),
}));

// ---------------------------------------------------------------------------
// Price Column — up to 10 per Line Item, confirmed 2026-09-19. Multiplier is
// entered by CLR (the rep agency) per job, not defaulted from the manufacturer.
// ---------------------------------------------------------------------------

export const priceColumns = pgTable('price_columns', {
  id: uuid('id').defaultRandom().primaryKey(),
  lineItemId: uuid('line_item_id').notNull().references(() => lineItems.id),
  columnLabel: text('column_label').notNull(),
  multiplier: numeric('multiplier', { precision: 8, scale: 4 }).notNull().default('1'),
  columnOrder: integer('column_order').notNull(), // 1-10
});

// ---------------------------------------------------------------------------
// Customer / Customer Group — a Print Selection targets one of these
// ---------------------------------------------------------------------------

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  type: customerTypeEnum('type').notNull().default('individual'),
});

export const customerGroupMembers = pgTable('customer_group_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').notNull().references(() => customers.id),
  memberCustomerId: uuid('member_customer_id').notNull().references(() => customers.id),
});

// ---------------------------------------------------------------------------
// Print Selection — the user's explicit, manual choice of which price
// column PRINTS/SENDS for a given Customer or Customer Group on a Quote
// Version. Confirmed 2026-09-19: never rule-derived.
//
// Design correction (2026-09-19): this references a column POSITION
// (selectedColumnOrder, 1-10) rather than one specific Price Column row.
// A quote version has many line items, each with its own set of price
// columns — a single priceColumnId would only cover one line item. Column
// order is the consistent key across all of a version's line items (e.g.
// "column 2 = Contractor pricing" on every line), matching how SAW's Price
// Calc table works. One selection this way covers the whole printed quote.
// ---------------------------------------------------------------------------

export const printSelections = pgTable('print_selections', {
  id: uuid('id').defaultRandom().primaryKey(),
  quoteVersionId: uuid('quote_version_id').notNull().references(() => quoteVersions.id),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  selectedColumnOrder: integer('selected_column_order').notNull(), // 1-10
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniquePerCustomer: uniqueIndex('print_selections_version_customer_unique').on(table.quoteVersionId, table.customerId),
}));

// ---------------------------------------------------------------------------
// Relations (for Drizzle's relational query API)
// ---------------------------------------------------------------------------

export const branchesRelations = relations(branches, ({ many }) => ({
  users: many(users),
  jobs: many(jobs),
}));

export const usersRelations = relations(users, ({ one }) => ({
  branch: one(branches, { fields: [users.branchId], references: [branches.id] }),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  branch: one(branches, { fields: [jobs.branchId], references: [branches.id] }),
  quotes: many(quotes),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  job: one(jobs, { fields: [quotes.jobId], references: [jobs.id] }),
  versions: many(quoteVersions),
}));

export const quoteVersionsRelations = relations(quoteVersions, ({ one, many }) => ({
  quote: one(quotes, { fields: [quoteVersions.quoteId], references: [quotes.id] }),
  lineItems: many(lineItems),
  printSelections: many(printSelections),
}));

export const lineItemsRelations = relations(lineItems, ({ one, many }) => ({
  quoteVersion: one(quoteVersions, { fields: [lineItems.quoteVersionId], references: [quoteVersions.id] }),
  manufacturer: one(manufacturers, { fields: [lineItems.manufacturerId], references: [manufacturers.id] }),
  priceColumns: many(priceColumns),
}));

export const priceColumnsRelations = relations(priceColumns, ({ one }) => ({
  lineItem: one(lineItems, { fields: [priceColumns.lineItemId], references: [lineItems.id] }),
}));

export const quoteManufacturerCommissionsRelations = relations(quoteManufacturerCommissions, ({ one }) => ({
  quoteVersion: one(quoteVersions, { fields: [quoteManufacturerCommissions.quoteVersionId], references: [quoteVersions.id] }),
  manufacturer: one(manufacturers, { fields: [quoteManufacturerCommissions.manufacturerId], references: [manufacturers.id] }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  printSelections: many(printSelections),
}));

export const printSelectionsRelations = relations(printSelections, ({ one }) => ({
  quoteVersion: one(quoteVersions, { fields: [printSelections.quoteVersionId], references: [quoteVersions.id] }),
  customer: one(customers, { fields: [printSelections.customerId], references: [customers.id] }),
}));
