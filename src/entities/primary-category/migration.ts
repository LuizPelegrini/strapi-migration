import Strapi3 from '@/cms/strapi3.ts';
import Strapi5 from '@/cms/strapi5.ts';
import type { PrimaryCategory } from '@/types.ts';
import { Tracker } from '@/utils/tracker.ts';

const tracker = new Tracker('primary-category');

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
			if (tracker.isStale(category.id, category.updated_at)) {
				await updatePrimaryCategory(category);
				continue;
			}

			console.log(
				`PrimaryCategory ${category.id} already migrated. Skipping...`,
			);
			continue;
		}

		const { id } = category;
		console.log(`Migrating: ${id}`);

		const documentId = await Strapi5.createPrimaryCategory({
			name: category.name,
			description: category.description,
			status: category.published_at ? 'published' : 'draft',
		});
		tracker.register({ id, documentId, updated_at: category.updated_at });
	}
};

const getPrimaryCategoryDocumentId = (id: number) => {
	return tracker.getDocumentId(id);
};

const updatePrimaryCategory = async (category: PrimaryCategory) => {
	const { id } = category;
	console.log(`Updating: ${id}`);

	const documentId = tracker.getDocumentId(category.id);

	if (!documentId) {
		throw new Error(`Update Failed:PrimaryCategory ${id} not found`);
	}

	await Strapi5.updatePrimaryCategory(documentId, {
		name: category.name,
		description: category.description,
		status: category.published_at ? 'published' : 'draft',
	});

	tracker.update(category.id, category.updated_at);
};

export default {
	start,
	getPrimaryCategoryDocumentId,
};
