import Strapi3 from '@/cms/strapi3.ts';
import Strapi5 from '@/cms/strapi5.ts';
import PrimaryCategoryMigration from '@/entities/primary-category/migration.ts';
import type { Category, PrimaryCategory } from '@/types.ts';
import { Tracker } from '@/utils/tracker.ts';

const tracker = new Tracker(`${Deno.cwd()}/src/entities/category`);

const start = async () => {
	console.log('\n\n\n------ Category -------');
	const categories = await Strapi3.getCategories();

	try {
		await migrate(categories);
	} catch (error) {
		console.log(error);
	} finally {
		tracker.save();
	}
};

const migrate = async (categories: Category[]) => {
	for (const category of categories) {
		if (tracker.exists(category.id)) {
			console.log(`Category ${category.id} already migrated. Skipping...`);
			continue;
		}

		const { id, primary_category } = category;
		console.log(`Migrating: ${id}`);

		const primaryCategoryDocumentId = possiblyAttachPrimaryCategory(
			id,
			primary_category,
		);

		const documentId = await Strapi5.createCategory(
			category,
			primaryCategoryDocumentId,
		);
		tracker.register({ id, documentId });
	}
};

const possiblyAttachPrimaryCategory = (
	id: number,
	primaryCategory: PrimaryCategory | null,
) => {
	if (primaryCategory) {
		// TODO: Revisit this to manage dependency on other Migrations
		const primaryCategoryDocumentId =
			PrimaryCategoryMigration.getPrimaryCategoryDocumentId(primaryCategory.id);
		if (!primaryCategoryDocumentId) {
			throw new Error(
				`Unable to attach PrimaryCategory ${primaryCategory.id} to Category ${id}`,
			);
		}

		return primaryCategoryDocumentId;
	}
};

export default {
	start,
};
