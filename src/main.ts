import CategoryMigration from '@/entities/category/migration.ts';
import PrimaryCategoryMigration from '@/entities/primary-category/migration.ts';
import ShowCategoryMigration from '@/entities/show-category/migration.ts';
import ShowSubCategoryMigration from '@/entities/show-sub-category/migration.ts';

await PrimaryCategoryMigration.start();
await CategoryMigration.start();

await ShowCategoryMigration.start();
await ShowSubCategoryMigration.start();
