import Strapi3 from '@/cms/strapi3.ts';
import Strapi5 from '@/cms/strapi5.ts';
import PrimaryCategoryMigration from '@/entities/primary-category/migration.ts';
import type { Category } from '@/types.ts';
import { Tracker } from '@/utils/tracker.ts';

const tracker = new Tracker('category');

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
			if (tracker.isStale(category.id, category.updated_at)) {
				await updateCategory(category);
				continue;
			}

			console.log(`Category ${category.id} already migrated. Skipping...`);
			continue;
		}

		const { id, primary_category, updated_at } = category;
		console.log(`Migrating: ${id}`);

		const primaryCategoryDocumentId = possiblyAttachPrimaryCategory({
			id,
			primaryCategoryId: primary_category,
		});

		const documentId = await Strapi5.createCategory({
			name: category.name,
			description: category.description,
			status: category.published_at ? 'published' : 'draft',
			primaryCategoryDocumentId,
		});
		tracker.register({ id, documentId, updated_at });
	}
};

const possiblyAttachPrimaryCategory = ({
	id,
	primaryCategoryId,
}: {
	id: number;
	primaryCategoryId: number | null;
}) => {
	if (primaryCategoryId) {
		// TODO: Revisit this to manage dependency on other Migrations
		const primaryCategoryDocumentId =
			PrimaryCategoryMigration.getPrimaryCategoryDocumentId(primaryCategoryId);
		if (!primaryCategoryDocumentId) {
			throw new Error(
				`Unable to attach PrimaryCategory ${primaryCategoryId} to Category ${id}`,
			);
		}

		return primaryCategoryDocumentId;
	}
};

const updateCategory = async (category: Category) => {
	const { id, primary_category, updated_at } = category;
	console.log(`Updating: ${id}`);

	const { documentId } = tracker.get(category.id) || {};

	if (!documentId) {
		throw new Error(`Update Failed: Category ${category.id} not found`);
	}

	const primaryCategoryDocumentId = possiblyAttachPrimaryCategory({
		id,
		primaryCategoryId: primary_category,
	});

	await Strapi5.updateCategory(documentId, {
		name: category.name,
		description: category.description,
		status: category.published_at ? 'published' : 'draft',
		primaryCategoryDocumentId,
	});

	tracker.update(id, updated_at);
};

const getCategoryDocumentId = (strapi3CategoryId: number) => {
	return tracker.get(strapi3CategoryId)?.documentId;
};

export default {
	start,
	getCategoryDocumentId,
};
