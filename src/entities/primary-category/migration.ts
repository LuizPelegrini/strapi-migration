import Strapi3 from '../../cms/strapi3.ts'
import Strapi5 from '../../cms/strapi5.ts'
import type { Category } from "../../types.ts";
import Tracker from "./tracker.ts";

const start = async () => {
  Tracker.preload();
  const categories = await Strapi3.getPrimaryCategories();

  try {
    await migrate(categories);
  } catch (error) {
    console.log(error);
  } finally {
    Tracker.save();
  }
}

const migrate = async (categories: Category[]) => {
  for (const category of categories) {
    if (Tracker.exists(category.id)) {
      console.log(`Category ${category.id} already migrated. Skipping...`);
      continue;
    };

    const { id } = category;
    const documentId = await Strapi5.createPrimaryCategory(category);
    Tracker.register({ id, documentId });
  }
}

export default {
  start
}