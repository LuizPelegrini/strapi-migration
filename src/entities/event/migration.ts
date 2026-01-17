import Strapi3 from '@/cms/strapi3.ts';
import Strapi5 from '@/cms/strapi5.ts';
import CategoryMigration from '@/entities/category/migration.ts';
import GuestMigration from '@/entities/guest/migration.ts';
import ProfileMigration from '@/entities/profile/migration.ts';
import TagMigration from '@/entities/tag/migration.ts';
import UserMigration from '@/entities/user/migration.ts';
import type { Category, Event, Guest, Profile, Tag } from '@/types.ts';
import {
	createShutdownController,
	createStrapiProcessor,
	processBatch,
} from '@/utils/batch-processor.ts';
import { Tracker } from '@/utils/tracker.ts';

const tracker = new Tracker('event');
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
	console.log('\n\n\n------ Event -------');
	const events = await Strapi3.getEvents();

	try {
		await migrate(events);
		console.log('Event migration completed 🎉');
	} catch (error) {
		console.log(error);
	} finally {
		tracker.save();
	}
};

const migrate = async (events: Event[]) => {
	console.log(`Starting migration of ${events.length} events...`);

	// Separate events into different categories
	const newEvents: Event[] = [];
	const staleEvents: Event[] = [];
	const skipEvents: Event[] = [];

	for (const event of events) {
		if (tracker.exists(event.id)) {
			if (tracker.isStale(event.id, event.updated_at)) {
				staleEvents.push(event);
			} else {
				skipEvents.push(event);
			}
		} else {
			newEvents.push(event);
		}
	}

	console.log('Event categorization:');
	console.log(`  📝 New events to create: ${newEvents.length}`);
	console.log(`  🔄 Stale events to update: ${staleEvents.length}`);
	console.log(`  ⏭️ Events to skip: ${skipEvents.length}`);

	const totalStats = {
		totalProcessed: 0,
		successful: 0,
		failed: 0,
		failedItems: [] as Array<{ item: unknown; error: Error }>,
	};

	// Process new events
	if (newEvents.length > 0) {
		console.log(`\n🚀 Creating ${newEvents.length} new events...`);
		const createProcessor = createStrapiProcessor(
			async (event: Event) => {
				const {
					id,
					Event_Name,
					Start_Date,
					End_Date,
					Description,
					Images,
					slug,
					Excerpt,
					Show_In_Frontpage,
					Is_Hero,
					Event_Link,
					Brochure_Vanity_URL,
					eSharingKit_Link,
					eSharing_Vanity,
					Brochure_File_URL,
					publish_at,
					eSharingKits,
					is_reminder,
					cloudsearch_id,
					Moderators,
					Panelists,
					categories,
					tags,
					owner,
					published_at,
				} = event;

				// Get relation document IDs
				const moderatorDocIds = getModeratorDocumentIds(id, Moderators);
				const panelistDocIds = getPanelistDocumentIds(id, Panelists);
				const categoryDocIds = getCategoryDocumentIds(id, categories);
				const tagDocIds = getTagDocumentIds(id, tags);
				const ownerDocId = getOwnerDocumentId(id, owner?.id);

				const isPublishedEvent = !!published_at;

				const { id: strapi5Id, documentId } = await Strapi5.createEvent({
					Event_Name,
					Start_Date,
					End_Date,
					Description,
					Images,
					slug,
					Excerpt,
					Show_In_Frontpage,
					Is_Hero,
					Event_Link,
					Brochure_Vanity_URL,
					eSharingKit_Link,
					eSharing_Vanity,
					Brochure_File_URL,
					publish_at,
					eSharingKits,
					is_reminder,
					cloudsearch_id,
					Moderators: moderatorDocIds,
					Panelists: panelistDocIds,
					categories: categoryDocIds,
					tags: tagDocIds,
					owner: ownerDocId ? [ownerDocId] : null,
					status: isPublishedEvent ? 'published' : 'draft',
				});

				return { strapi5Id, documentId };
			},
			(event: Event) => event.id,
		);

		const createStats = await processBatch(
			newEvents,
			createProcessor,
			shutdownController,
			{
				onItemSuccess: async (strapi3Event, strapi5Event) => {
					const { id, updated_at, published_at } = strapi3Event;
					const { documentId } = strapi5Event;

					const isPublishedEvent = !!published_at;
					const eventInfo = await Strapi5.getEvent(documentId, {
						status: isPublishedEvent ? 'published' : 'draft',
					});

					// Hopefully this never happens, otherwise we need to move this logic outside onItemSuccess
					// This means that event was draft in Strapi 3 but created as published in Strapi 5
					// or vice versa
					if (!eventInfo) {
						throw new Error(
							`CREATE: Event ${id} with status ${isPublishedEvent ? 'published' : 'draft'} not found in Strapi 5`,
						);
					}

					tracker.register({
						id,
						documentId,
						updated_at,
						publishedStrapi5Id: isPublishedEvent ? eventInfo.id : null,
						draftStrapi5Id: isPublishedEvent ? null : eventInfo.id,
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

	// Process stale events
	if (staleEvents.length > 0) {
		console.log(`\n🔄 Updating ${staleEvents.length} stale events...`);
		const updateProcessor = createStrapiProcessor(
			async (event: Event) => {
				const {
					id,
					Event_Name,
					Start_Date,
					End_Date,
					Description,
					Images,
					slug,
					Excerpt,
					Show_In_Frontpage,
					Is_Hero,
					Event_Link,
					Brochure_Vanity_URL,
					eSharingKit_Link,
					eSharing_Vanity,
					Brochure_File_URL,
					publish_at,
					eSharingKits,
					is_reminder,
					cloudsearch_id,
					Moderators,
					Panelists,
					categories,
					tags,
					owner,
					published_at,
				} = event;

				// @ts-ignore strapi5PublishedId is not typed, but it exists
				const { documentId } = tracker.get(id) || {};
				if (!documentId) {
					throw new Error(`Update Failed: Event ${id} not found in tracker`);
				}

				// Get relation document IDs
				const moderatorDocIds = getModeratorDocumentIds(id, Moderators);
				const panelistDocIds = getPanelistDocumentIds(id, Panelists);
				const categoryDocIds = getCategoryDocumentIds(id, categories);
				const tagDocIds = getTagDocumentIds(id, tags);
				const ownerDocId = getOwnerDocumentId(id, owner?.id);

				const isPublishedEvent = !!published_at;
				await Strapi5.updateEvent(documentId, {
					Event_Name,
					Start_Date,
					End_Date,
					Description,
					Images,
					slug,
					Excerpt,
					Show_In_Frontpage,
					Is_Hero,
					Event_Link,
					Brochure_Vanity_URL,
					eSharingKit_Link,
					eSharing_Vanity,
					Brochure_File_URL,
					publish_at,
					eSharingKits,
					is_reminder,
					cloudsearch_id,
					Moderators: moderatorDocIds,
					Panelists: panelistDocIds,
					categories: categoryDocIds,
					tags: tagDocIds,
					owner: ownerDocId ? [ownerDocId] : null,
					status: isPublishedEvent ? 'published' : 'draft',
				});

				return {
					documentId,
				};
			},
			(event: Event) => event.id,
		);

		const updateStats = await processBatch(
			staleEvents,
			updateProcessor,
			shutdownController,
			{
				onItemSuccess: async (strapi3Event, strapi5Event) => {
					const { id, updated_at, published_at } = strapi3Event;
					const { documentId } = strapi5Event;

					// if event was not published before and it got published, we need to update the tracker to include the published id
					const isPublishedEvent = !!published_at;
					const eventInfo = await Strapi5.getEvent(documentId, {
						status: isPublishedEvent ? 'published' : 'draft',
					});

					// Hopefully this never happens, otherwise we need to move this logic outside onItemSuccess
					if (!eventInfo) {
						throw new Error(
							`UPDATE: Event ${id} with status ${isPublishedEvent ? 'published' : 'draft'} not found in Strapi 5`,
						);
					}

					tracker.update(id, updated_at, {
						publishedStrapi5Id: isPublishedEvent ? eventInfo.id : null,
						draftStrapi5Id: isPublishedEvent ? null : eventInfo.id,
					});
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
	console.log(`  ⏭️  Skipped (already up-to-date): ${skipEvents.length}`);
	console.log(`  📝 Total processed: ${totalStats.totalProcessed}`);

	if (totalStats.failedItems.length > 0) {
		console.log('\n❌ Failed items:');
		for (const failedItem of totalStats.failedItems) {
			const item = failedItem.item as Event;
			console.log(
				`  - ID: ${item.id}, Event_Name: ${item.Event_Name}, Error: ${failedItem.error.message}`,
			);
		}
	}
};

// Helper function to get Strapi5 document IDs from Strapi3 profile IDs (Moderators)
const getModeratorDocumentIds = (
	eventId: number,
	moderators: Profile[],
): string[] => {
	const documentIds = moderators.map((m) =>
		ProfileMigration.getProfileDocumentId(m.id),
	);

	const notMigratedModerators = documentIds
		.map((id, index) => ({ id, moderator: moderators[index] }))
		.filter(({ id }) => !id)
		.map(({ moderator }) => moderator.id);

	if (notMigratedModerators.length > 0) {
		throw new Error(
			`Event ${eventId} has moderators that are not migrated: ${notMigratedModerators.join(' | ')}`,
		);
	}

	// @ts-ignore we already checked if ALL the ids are defined above
	return documentIds;
};

// Helper function to get Strapi5 document IDs from Strapi3 guest IDs (Panelists)
const getPanelistDocumentIds = (
	eventId: number,
	panelists: Guest[],
): string[] => {
	const documentIds = panelists.map((p) =>
		GuestMigration.getGuestDocumentId(p.id),
	);

	const notMigratedPanelists = documentIds
		.map((id, index) => ({ id, panelist: panelists[index] }))
		.filter(({ id }) => !id)
		.map(({ panelist }) => panelist.id);

	if (notMigratedPanelists.length > 0) {
		throw new Error(
			`Event ${eventId} has panelists that are not migrated: ${notMigratedPanelists.join(' | ')}`,
		);
	}

	// @ts-ignore we already checked if ALL the ids are defined above
	return documentIds;
};

// Helper function to get Strapi5 document IDs from Strapi3 category IDs
const getCategoryDocumentIds = (
	eventId: number,
	categories: Category[],
): string[] => {
	const documentIds = categories.map((c) =>
		CategoryMigration.getCategoryDocumentId(c.id),
	);

	const notMigratedCategories = documentIds
		.map((id, index) => ({ id, category: categories[index] }))
		.filter(({ id }) => !id)
		.map(({ category }) => category.id);

	if (notMigratedCategories.length > 0) {
		throw new Error(
			`Event ${eventId} has categories that are not migrated: ${notMigratedCategories.join(' | ')}`,
		);
	}

	// @ts-ignore we already checked if ALL the ids are defined above
	return documentIds;
};

// Helper function to get Strapi5 document IDs from Strapi3 tag IDs
const getTagDocumentIds = (eventId: number, tags: Tag[]): string[] => {
	const documentIds = tags.map((t) => TagMigration.getTagDocumentId(t.id));

	const notMigratedTags = documentIds
		.map((id, index) => ({ id, tag: tags[index] }))
		.filter(({ id }) => !id)
		.map(({ tag }) => tag.id);

	if (notMigratedTags.length > 0) {
		throw new Error(
			`Event ${eventId} has tags that are not migrated: ${notMigratedTags.join(' | ')}`,
		);
	}

	// @ts-ignore we already checked if ALL the ids are defined above
	return documentIds;
};

// Helper function to get Strapi5 document ID from Strapi3 user ID (owner)
const getOwnerDocumentId = (eventId: number, strapi3UserId?: number) => {
	if (!strapi3UserId) {
		return null;
	}

	const userDocumentId = UserMigration.getUserDocumentId(strapi3UserId);

	if (!userDocumentId) {
		throw new Error(
			`Event ${eventId} has owner ${strapi3UserId} that is not migrated - user migration may not be complete`,
		);
	}

	return userDocumentId;
};

const getEventDocumentId = (strapi3EventId: number) => {
	return tracker.get(strapi3EventId)?.documentId;
};

export default {
	start,
	getEventDocumentId,
};
