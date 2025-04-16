import Strapi3 from '@/cms/strapi3.ts';
import Strapi5 from '@/cms/strapi5.ts';
import type { ShowCategory } from '@/types.ts';
import { Tracker } from '@/utils/tracker.ts';

const tracker = new Tracker('show-category');

const start = async () => {
	console.log('\n\n\n------ ShowCategories -------');
	const showCategories = await Strapi3.getShowCategories();

	try {
		await migrate(showCategories);
	} catch (error) {
		console.log(error);
	} finally {
		tracker.save();
	}
};

const migrate = async (showCategories: ShowCategory[]) => {
	for (const showCategory of showCategories) {
		if (tracker.exists(showCategory.id)) {
			if (tracker.isStale(showCategory.id, showCategory.updated_at)) {
				await updateShowCategory(showCategory);
				continue;
			}

			console.log(
				`ShowCategory ${showCategory.id} already migrated. Skipping...`,
			);
			continue;
		}

		const { id, updated_at } = showCategory;
		console.log(`Migrating: ${id}`);

		const documentId = await Strapi5.createShowCategory(showCategory);
		tracker.register({ id, documentId, updated_at });
	}
};

const getShowCategoryDocumentId = (id: number) => {
	return tracker.getDocumentId(id);
};

const updateShowCategory = async (showCategory: ShowCategory) => {
	const { id, updated_at } = showCategory;
	console.log(`Updating: ${id}`);

	const documentId = tracker.getDocumentId(id);

	if (!documentId) {
		throw new Error(`Update Failed: ShowCategory ${id} not found`);
	}

	await Strapi5.updateShowCategory(documentId, {
		name: showCategory.name,
	});

	tracker.update(id, updated_at);
};

export default {
	start,
	getShowCategoryDocumentId,
};
