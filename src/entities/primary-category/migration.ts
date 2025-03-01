import Strapi3 from '@/cms/strapi3.ts';
import Strapi5 from '@/cms/strapi5.ts';
import type { PrimaryCategory } from '@/types.ts';
import { Tracker } from '@/utils/tracker.ts';

const tracker = new Tracker(`${Deno.cwd()}/src/entities/primary-category`);

const start = async () => {
	console.log('\n\n\n------ PrimaryCategory -------');
	const categories = await Strapi3.getPrimaryCategories();

	try {
		await migrate(categories);
	} catch (error) {
		console.log(error);
	} finally {
		tracker.save();
	}
};

const migrate = async (primaryCategories: PrimaryCategory[]) => {
	for (const category of primaryCategories) {
		if (tracker.exists(category.id)) {
			console.log(
				`PrimaryCategory ${category.id} already migrated. Skipping...`,
			);
			continue;
		}

		const { id } = category;
		console.log(`Migrating: ${id}`);

		const documentId = await Strapi5.createPrimaryCategory(category);
		tracker.register({ id, documentId });
	}
};

const getPrimaryCategoryDocumentId = (id: number) => {
	return tracker.getDocumentId(id);
};

export default {
	start,
	getPrimaryCategoryDocumentId,
};
