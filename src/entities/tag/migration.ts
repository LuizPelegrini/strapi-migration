import Strapi3 from '@/cms/strapi3.ts';
import Strapi5 from '@/cms/strapi5.ts';
import UserMigration from '@/entities/user/migration.ts';
import type { Tag } from '@/types.ts';
import {
	createShutdownController,
	createStrapiProcessor,
	processBatch,
} from '@/utils/batch-processor.ts';
import { Tracker } from '@/utils/tracker.ts';

const tracker = new Tracker('tag');
const shutdownController = createShutdownController();

// Set up SIGINT handler to save tracker state on interruption
Deno.addSignalListener('SIGINT', async () => {
	console.log(
		'\n⚠️  Received SIGINT signal. Waiting for current operations to complete...',
	);
	shutdownController.requestShutdown();

	// Wait for batch processor to finish current chunk
	await shutdownController.waitForSafeShutdown();

	console.log('💾 Saving tracker state...');
	tracker.save();
	console.log('✅ Tracker state saved. Exiting gracefully.');
	Deno.exit(0);
});

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
	console.log(`Starting migration of ${tags.length} tags...`);

	// Separate tags into different categories
	const newTags: Tag[] = [];
	const staleTags: Tag[] = [];
	const skipTags: Tag[] = [];

	for (const tag of tags) {
		if (tracker.exists(tag.id)) {
			if (tracker.isStale(tag.id, tag.updated_at)) {
				staleTags.push(tag);
			} else {
				skipTags.push(tag);
			}
		} else {
			newTags.push(tag);
		}
	}

	console.log('Tag categorization:');
	console.log(`  📝 New tags to create: ${newTags.length}`);
	console.log(`  🔄 Stale tags to update: ${staleTags.length}`);
	console.log(`  ⏭️ Tags to skip: ${skipTags.length}`);

	const totalStats = {
		totalProcessed: 0,
		successful: 0,
		failed: 0,
		failedItems: [] as Array<{ item: unknown; error: Error }>,
	};

	// Process new tags
	if (newTags.length > 0) {
		console.log(`\n🚀 Creating ${newTags.length} new tags...`);
		const createProcessor = createStrapiProcessor(
			async (tag: Tag) => {
				const { id, name, user_created_by, user_updated_by, updated_at } = tag;

				// Get user IDs from tracker if they exist
				const userCreatedByDocumentId = getUserDocumentId(user_created_by?.id);
				const userUpdatedByDocumentId = getUserDocumentId(user_updated_by?.id);

				const { documentId } = await Strapi5.createTag({
					name,
					userCreatedByDocumentId,
					userUpdatedByDocumentId,
				});

				return { documentId };
			},
			(tag: Tag) => tag.id,
		);

		const createStats = await processBatch(
			newTags,
			createProcessor,
			shutdownController,
			{
				// deno-lint-ignore require-await
				onItemSuccess: async (strapi3Tag, strapi5Tag) => {
					const { id, updated_at } = strapi3Tag;
					const { documentId } = strapi5Tag;

					tracker.register({
						id,
						documentId,
						updated_at,
					});
				},
				onProgress: (_stats) => {
					// Save tracker state after each batch completion
					tracker.save();
				},
			},
		);

		totalStats.successful += createStats.successful;
		totalStats.failed += createStats.failed;
		totalStats.failedItems.push(...createStats.failedItems);
		totalStats.totalProcessed += createStats.totalProcessed;
	}

	// Process stale tags
	if (staleTags.length > 0) {
		console.log(`\n🔄 Updating ${staleTags.length} stale tags...`);
		const updateProcessor = createStrapiProcessor(
			async (tag: Tag) => {
				const { id, name, user_created_by, user_updated_by, updated_at } = tag;

				const { documentId } = tracker.get(id) || {};
				if (!documentId) {
					throw new Error(`Update Failed: Tag ${id} not found in tracker`);
				}

				// Get user IDs from tracker if they exist
				const userCreatedByDocumentId = getUserDocumentId(user_created_by?.id);
				const userUpdatedByDocumentId = getUserDocumentId(user_updated_by?.id);

				const { id: strapi5Id } = await Strapi5.updateTag(documentId, {
					name,
					userCreatedByDocumentId,
					userUpdatedByDocumentId,
				});

				return { strapi5Id };
			},
			(tag: Tag) => tag.id,
		);

		const updateStats = await processBatch(
			staleTags,
			updateProcessor,
			shutdownController,
			{
				// deno-lint-ignore require-await
				onItemSuccess: async (strapi3Tag, _strapi5Tag) => {
					const { id, updated_at } = strapi3Tag;
					tracker.update(id, updated_at);
				},
				onProgress: (_stats) => {
					// Save tracker state after each batch completion
					tracker.save();
				},
			},
		);

		totalStats.successful += updateStats.successful;
		totalStats.failed += updateStats.failed;
		totalStats.failedItems.push(...updateStats.failedItems);
		totalStats.totalProcessed += updateStats.totalProcessed;
	}

	// Final summary
	console.log('\n📊 Migration Summary:');
	console.log(`  ✅ Successfully processed: ${totalStats.successful}`);
	console.log(`  ❌ Failed: ${totalStats.failed}`);
	console.log(`  ⏭️  Skipped (already up-to-date): ${skipTags.length}`);
	console.log(`  📝 Total processed: ${totalStats.totalProcessed}`);

	if (totalStats.failedItems.length > 0) {
		console.log('\n❌ Failed items:');
		for (const failedItem of totalStats.failedItems) {
			const item = failedItem.item as Tag;
			console.log(
				`  - ID: ${item.id}, Name: ${item.name}, Error: ${failedItem.error.message}`,
			);
		}
	}
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

const getTagDocumentId = (strapi3TagId: number) => {
	return tracker.get(strapi3TagId)?.documentId;
};

export default {
	start,
	getTagDocumentId,
};
