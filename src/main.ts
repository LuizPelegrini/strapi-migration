import CategoryMigration from '@/entities/category/migration.ts';
import FileMigration from '@/entities/file/migration.ts';
import PrimaryCategoryMigration from '@/entities/primary-category/migration.ts';
import ShowCategoryMigration from '@/entities/show-category/migration.ts';
import ShowSubCategoryMigration from '@/entities/show-sub-category/migration.ts';

// REMINDER: The order of each migration script matters

// await PrimaryCategoryMigration.start();
// await CategoryMigration.start();

// await ShowCategoryMigration.start();
// await ShowSubCategoryMigration.start();

await FileMigration.start();
