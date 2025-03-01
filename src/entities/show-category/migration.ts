import Strapi3 from '@/cms/strapi3.ts';
import Strapi5 from '@/cms/strapi5.ts';
import type { ShowCategory } from '@/types.ts';
import { Tracker } from '@/utils/tracker.ts';

const tracker = new Tracker(`${Deno.cwd()}/src/entities/show-category`);

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
			console.log(
				`ShowCategory ${showCategory.id} already migrated. Skipping...`,
			);
			continue;
		}

		const { id } = showCategory;
		console.log(`Migrating: ${id}`);

		const documentId = await Strapi5.createShowCategory(showCategory);
		tracker.register({ id, documentId });
	}
};

const getShowCategoryDocumentId = (id: number) => {
	return tracker.getDocumentId(id);
};

export default {
	start,
	getShowCategoryDocumentId,
};
