import Strapi3 from '@/cms/strapi3.ts'
import Strapi5 from '@/cms/strapi5.ts'
import ShowCategoryMigration from '@/entities/show-category/migration.ts';
import type { ShowCategory, ShowSubCategory } from "@/types.ts";
import { Tracker } from "@/utils/tracker.ts";

const tracker = new Tracker(`${Deno.cwd()}/src/entities/show-sub-category`);

const start = async () => {
  console.log('\n\n\n------ ShowSubCategories -------');
  const subCategories = await Strapi3.getShowSubCategories();

  try {
    await migrate(subCategories);
  } catch (error) {
    console.log(error);
  } finally {
    tracker.save();
  }
}

const migrate = async (categories: ShowSubCategory[]) => {
  for (const category of categories) {
    if (tracker.exists(category.id)) {
      console.log(`ShowSubCategory ${category.id} already migrated. Skipping...`);
      continue;
    };

    const { id } = category;
    console.log(`Migrating: ${id}`);
    
    const showCategory = await Strapi3.getShowCategoryByShowSubCategoryId(id)
    const showCategoryDocumentId = possiblyAttachShowCategory(id, showCategory);

    const documentId = await Strapi5.createShowSubCategory(category, showCategoryDocumentId);
    tracker.register({ id, documentId });
  }
}

const possiblyAttachShowCategory = (id: number, showCategory: ShowCategory | null) => {
  if (showCategory) {
    const showCategoryDocumentId = ShowCategoryMigration.getShowCategoryDocumentId(showCategory.id);
    if (!showCategoryDocumentId) {
      throw new Error(`Unable to attach ShowCategory ${showCategory.id} to ShowSubCategory ${id}`);
    }
    return showCategoryDocumentId;
  }
}



export default {
  start
}