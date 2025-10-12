import Strapi3 from '@/cms/strapi3.ts';
import Strapi5 from '@/cms/strapi5.ts';
import UserMigration from '@/entities/user/migration.ts';
import type { Tag } from '@/types.ts';
import { Tracker } from '@/utils/tracker.ts';

const tracker = new Tracker('tag');

const start = async () => {
	console.log('\n\n\n------ Tag -------');
	const tags = await Strapi3.getTags();

	try {
		await migrate(tags);
		console.log('Tag migration completed 🎉');
	} catch (error) {
		console.log(error);
	} finally {
		tracker.save();
	}
};

const migrate = async (tags: Tag[]) => {
	for (const tag of tags) {
		if (tracker.exists(tag.id)) {
			if (tracker.isStale(tag.id, tag.updated_at)) {
				await updateTag(tag);
				continue;
			}

			console.log(`Tag ${tag.id} already migrated. Skipping...`);
			continue;
		}

		const { id, name, user_created_by, user_updated_by, updated_at } = tag;
		console.log(`Migrating: ${id}`);

		// Get user IDs from tracker if they exist
		const userCreatedByDocumentId = getUserDocumentId(user_created_by?.id);
		const userUpdatedByDocumentId = getUserDocumentId(user_updated_by?.id);

		const { documentId } = await Strapi5.createTag({
			name,
			userCreatedByDocumentId,
			userUpdatedByDocumentId,
		});

		tracker.register({
			id,
			documentId,
			updated_at,
		});
	}
};

const updateTag = async (tag: Tag) => {
	const { id, name, user_created_by, user_updated_by, updated_at } = tag;
	console.log(`Updating: ${id}`);

	const { documentId } = tracker.get(id) || {};

	if (!documentId) {
		throw new Error(`Update Failed: Tag ${id} not found`);
	}

	// Get user IDs from tracker if they exist
	const userCreatedByDocumentId = getUserDocumentId(user_created_by?.id);
	const userUpdatedByDocumentId = getUserDocumentId(user_updated_by?.id);

	await Strapi5.updateTag(documentId, {
		name,
		userCreatedByDocumentId,
		userUpdatedByDocumentId,
	});

	tracker.update(id, updated_at);
};

// Helper function to get Strapi5 document ID from Strapi3 user ID
const getUserDocumentId = (strapi3UserId?: number) => {
	if (!strapi3UserId) {
		return null;
	}

	const userDocumentId = UserMigration.getUserDocumentId(strapi3UserId);

	if (!userDocumentId) {
		throw new Error(
			`User ${strapi3UserId} not found in user tracker - user migration may not be complete`,
		);
	}

	return userDocumentId;
};

export default {
	start,
};
