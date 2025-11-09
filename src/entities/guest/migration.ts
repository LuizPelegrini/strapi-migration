import Strapi3 from '@/cms/strapi3.ts';
import Strapi5 from '@/cms/strapi5.ts';
import SalutationMigration from '@/entities/salutation/migration.ts';
import UserMigration from '@/entities/user/migration.ts';
import type { Guest, Salutation } from '@/types.ts';
import {
	createShutdownController,
	createStrapiProcessor,
	processBatch,
} from '@/utils/batch-processor.ts';
import { Tracker } from '@/utils/tracker.ts';

const tracker = new Tracker('guest');
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
	console.log('\n\n\n------ Guest -------');
	const guests = await Strapi3.getGuests();

	try {
		await migrate(guests.filter((guest) => guest.id === 78328).slice(0, 1));
		console.log('Guest migration completed 🎉');
	} catch (error) {
		console.log(error);
	} finally {
		tracker.save();
	}
};

const migrate = async (guests: Guest[]) => {
	console.log(`Starting migration of ${guests.length} guests...`);

	// Separate guests into different categories
	const newGuests: Guest[] = [];
	const staleGuests: Guest[] = [];
	const skipGuests: Guest[] = [];

	for (const guest of guests) {
		if (tracker.exists(guest.id)) {
			if (tracker.isStale(guest.id, guest.updated_at)) {
				staleGuests.push(guest);
			} else {
				skipGuests.push(guest);
			}
		} else {
			newGuests.push(guest);
		}
	}

	console.log('Guest categorization:');
	console.log(`  📝 New guests to create: ${newGuests.length}`);
	console.log(`  🔄 Stale guests to update: ${staleGuests.length}`);
	console.log(`  ⏭️ Guests to skip: ${skipGuests.length}`);

	const totalStats = {
		totalProcessed: 0,
		successful: 0,
		failed: 0,
		failedItems: [] as Array<{ item: unknown; error: Error }>,
	};

	// Process new guests
	if (newGuests.length > 0) {
		console.log(`\n🚀 Creating ${newGuests.length} new guests...`);
		const createProcessor = createStrapiProcessor(
			async (guest: Guest) => {
				const {
					id,
					fullname,
					shortname,
					organisation,
					designation,
					image,
					description,
					salutations,
					user_created_by,
					user_updated_by,
					published_at,
				} = guest;

				// Get salutation document IDs
				const salutationDocumentIds = getSalutationDocumentIds(id, salutations);

				// Get user IDs from tracker if they exist
				const userCreatedByDocumentId = getUserDocumentId(
					id,
					user_created_by?.id,
				);
				const userUpdatedByDocumentId = getUserDocumentId(
					id,
					user_updated_by?.id,
				);

				const isPublishedGuest = !!published_at;

				const { id: strapi5Id, documentId } = await Strapi5.createGuest({
					fullname,
					shortname,
					organisation,
					designation,
					image,
					description,
					salutationDocumentIds,
					userCreatedByDocumentId,
					userUpdatedByDocumentId,
					status: isPublishedGuest ? 'published' : 'draft',
				});

				return { strapi5Id, documentId };
			},
			(guest: Guest) => guest.id,
		);

		const createStats = await processBatch(
			newGuests,
			createProcessor,
			shutdownController,
			{
				onItemSuccess: async (strapi3Guest, strapi5Guest) => {
					const { id, updated_at, published_at } = strapi3Guest;
					const { documentId } = strapi5Guest;

					const isPublishedGuest = !!published_at;
					const guestInfo = await Strapi5.getGuest(documentId, {
						status: isPublishedGuest ? 'published' : 'draft',
					});

					// Hopefully this never happens, otherwise we need to move this logic outside onItemSuccess
					if (!guestInfo) {
						throw new Error(
							`CREATE: Guest ${id} with status ${isPublishedGuest ? 'published' : 'draft'} not found in Strapi 5`,
						);
					}

					tracker.register({
						id,
						documentId,
						updated_at,
						publishedStrapi5Id: isPublishedGuest ? guestInfo.id : null,
						draftStrapi5Id: isPublishedGuest ? null : guestInfo.id,
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

	// Process stale guests
	if (staleGuests.length > 0) {
		console.log(`\n🔄 Updating ${staleGuests.length} stale guests...`);
		const updateProcessor = createStrapiProcessor(
			async (guest: Guest) => {
				const {
					id,
					fullname,
					shortname,
					organisation,
					designation,
					image,
					description,
					salutations,
					published_at,
					user_created_by,
					user_updated_by,
				} = guest;

				// @ts-ignore strapi5PublishedId is not typed, but it exists
				const { documentId } = tracker.get(id) || {};
				if (!documentId) {
					throw new Error(`Update Failed: Guest ${id} not found in tracker`);
				}

				// Get salutation document IDs
				const salutationDocumentIds = getSalutationDocumentIds(id, salutations);

				// Get user IDs from tracker if they exist
				const userCreatedByDocumentId = getUserDocumentId(
					id,
					user_created_by?.id,
				);
				const userUpdatedByDocumentId = getUserDocumentId(
					id,
					user_updated_by?.id,
				);

				const isPublishedGuest = !!published_at;
				await Strapi5.updateGuest(documentId, {
					fullname,
					shortname,
					organisation,
					designation,
					image,
					description,
					salutationDocumentIds,
					userCreatedByDocumentId,
					userUpdatedByDocumentId,
					status: isPublishedGuest ? 'published' : 'draft',
				});

				return {
					documentId,
				};
			},
			(guest: Guest) => guest.id,
		);

		const updateStats = await processBatch(
			staleGuests,
			updateProcessor,
			shutdownController,
			{
				onItemSuccess: async (strapi3Guest, strapi5Guest) => {
					const { id, updated_at, published_at } = strapi3Guest;
					const { documentId } = strapi5Guest;

					// if guest was not published before and it got published, we need to update the tracker to include the published id
					const isPublishedGuest = !!published_at;
					const guestInfo = await Strapi5.getGuest(documentId, {
						status: isPublishedGuest ? 'published' : 'draft',
					});

					// Hopefully this never happens, otherwise we need to move this logic outside onItemSuccess
					if (!guestInfo) {
						throw new Error(
							`UPDATE: Guest ${id} with status ${isPublishedGuest ? 'published' : 'draft'} not found in Strapi 5`,
						);
					}

					tracker.update(id, updated_at, {
						publishedStrapi5Id: isPublishedGuest ? guestInfo.id : null,
						draftStrapi5Id: isPublishedGuest ? null : guestInfo.id,
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
	console.log(`  ⏭️  Skipped (already up-to-date): ${skipGuests.length}`);
	console.log(`  📝 Total processed: ${totalStats.totalProcessed}`);

	if (totalStats.failedItems.length > 0) {
		console.log('\n❌ Failed items:');
		for (const failedItem of totalStats.failedItems) {
			const item = failedItem.item as Guest;
			console.log(
				`  - ID: ${item.id}, Fullname: ${item.fullname}, Error: ${failedItem.error.message}`,
			);
		}
	}
};

// Helper function to get Strapi5 document IDs from Strapi3 salutation IDs
const getSalutationDocumentIds = (
	guestId: number,
	salutations: Salutation[],
): string[] => {
	const documentIds = salutations.map((s) =>
		SalutationMigration.getSalutationDocumentId(s.id),
	);

	const notMigratedSalutations = documentIds
		.map((id, index) => ({ id, salutation: salutations[index] }))
		.filter(({ id }) => !id)
		.map(({ salutation }) => salutation.id);

	if (notMigratedSalutations.length > 0) {
		throw new Error(
			`Guest ${guestId} has salutations that are not migrated: ${notMigratedSalutations.join(' | ')}`,
		);
	}

	// @ts-ignore we already checked if ALL the ids are defined above
	return documentIds;
};

// Helper function to get Strapi5 document ID from Strapi3 user ID
const getUserDocumentId = (guestId: number, strapi3UserId?: number) => {
	if (!strapi3UserId) {
		return null;
	}

	const userDocumentId = UserMigration.getUserDocumentId(strapi3UserId);

	if (!userDocumentId) {
		throw new Error(
			`Guest ${guestId} has user ${strapi3UserId} that is not migrated - user migration may not be complete`,
		);
	}

	return userDocumentId;
};

const getGuestDocumentId = (strapi3GuestId: number) => {
	return tracker.get(strapi3GuestId)?.documentId;
};

export default {
	start,
	getGuestDocumentId,
};
