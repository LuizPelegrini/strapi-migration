import CategoryMigration from '@/entities/category/migration.ts';
import PrimaryCategoryMigration from '@/entities/primary-category/migration.ts';

await PrimaryCategoryMigration.start();
await CategoryMigration.start();