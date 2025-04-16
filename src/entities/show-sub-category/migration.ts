import Strapi3 from '@/cms/strapi3.ts';
import Strapi5 from '@/cms/strapi5.ts';
import ShowCategoryMigration from '@/entities/show-category/migration.ts';
import type { ShowCategory, ShowSubCategory } from '@/types.ts';
import { Tracker } from '@/utils/tracker.ts';

const tracker = new Tracker('show-sub-category');

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
};

const migrate = async (categories: ShowSubCategory[]) => {
	for (const category of categories) {
		if (tracker.exists(category.id)) {
			if (tracker.isStale(category.id, category.updated_at)) {
				await updateShowSubCategory(category);
				continue;
			}

			console.log(
				`ShowSubCategory ${category.id} already migrated. Skipping...`,
			);
			continue;
		}

		const { id, updated_at } = category;
		console.log(`Migrating: ${id}`);

		const showCategory = await Strapi3.getShowCategoryByShowSubCategoryId(id);
		const showCategoryDocumentId = possiblyAttachShowCategory(id, showCategory);

		const documentId = await Strapi5.createShowSubCategory({
			name: category.name,
			showCategoryDocumentId,
		});
		tracker.register({ id, documentId, updated_at });
	}
};

const possiblyAttachShowCategory = (
	id: number,
	showCategory: ShowCategory | null,
) => {
	if (showCategory) {
		const showCategoryDocumentId =
			ShowCategoryMigration.getShowCategoryDocumentId(showCategory.id);
		if (!showCategoryDocumentId) {
			throw new Error(
				`Unable to attach ShowCategory ${showCategory.id} to ShowSubCategory ${id}`,
			);
		}
		return showCategoryDocumentId;
	}
};

const updateShowSubCategory = async (showSubCategory: ShowSubCategory) => {
	const { id, updated_at } = showSubCategory;
	console.log(`Updating: ${id}`);

	const documentId = tracker.getDocumentId(id);
	if (!documentId) {
		throw new Error(`Update Failed: ShowSubCategory ${id} not found`);
	}

	const showCategory = await Strapi3.getShowCategoryByShowSubCategoryId(id);
	const showCategoryDocumentId = possiblyAttachShowCategory(id, showCategory);

	await Strapi5.updateShowSubCategory(documentId, {
		name: showSubCategory.name,
		showCategoryDocumentId,
	});

	tracker.update(id, updated_at);
};

export default {
	start,
};
