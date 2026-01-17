import Strapi3 from '@/cms/strapi3.ts';
import Strapi5 from '@/cms/strapi5.ts';
import CategoryMigration from '@/entities/category/migration.ts';
import FileMigration from '@/entities/file/migration.ts';
import GuestMigration from '@/entities/guest/migration.ts';
import ProfileMigration from '@/entities/profile/migration.ts';
import ShowMigration from '@/entities/show/migration.ts';
import SocmedMigration from '@/entities/socmed/migration.ts';
import TagMigration from '@/entities/tag/migration.ts';
import UserMigration from '@/entities/user/migration.ts';
import type { Category, Guest, Profile, Socmed, Tag, Video } from '@/types.ts';
import {
	createShutdownController,
	createStrapiProcessor,
	processBatch,
} from '@/utils/batch-processor.ts';
import { Tracker } from '@/utils/tracker.ts';

const tracker = new Tracker('video');
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
	console.log('\n\n\n------ Video -------');
	const videos = await Strapi3.getVideos();

	try {
		await migrate(videos);
		console.log('Video migration completed 🎉');
	} catch (error) {
		console.log(error);
	} finally {
		tracker.save();
	}
};

const migrate = async (videos: Video[]) => {
	console.log(`Starting migration of ${videos.length} videos...`);

	// Separate videos into different categories
	const newVideos: Video[] = [];
	const staleVideos: Video[] = [];
	const skipVideos: Video[] = [];

	for (const video of videos) {
		if (tracker.exists(video.id)) {
			if (tracker.isStale(video.id, video.updated_at)) {
				staleVideos.push(video);
			} else {
				skipVideos.push(video);
			}
		} else {
			newVideos.push(video);
		}
	}

	console.log('Video categorization:');
	console.log(`  📝 New videos to create: ${newVideos.length}`);
	console.log(`  🔄 Stale videos to update: ${staleVideos.length}`);
	console.log(`  ⏭️ Videos to skip: ${skipVideos.length}`);

	const totalStats = {
		totalProcessed: 0,
		successful: 0,
		failed: 0,
		failedItems: [] as Array<{ item: unknown; error: Error }>,
	};

	// Process new videos
	if (newVideos.length > 0) {
		console.log(`\n🚀 Creating ${newVideos.length} new videos...`);
		const createProcessor = createStrapiProcessor(
			async (video: Video) => {
				const {
					id,
					title,
					slug,
					description,
					hide_download,
					hide_sponsor,
					editors_picked,
					is_hero,
					publish_at,
					video: videoFile,
					image_1x1,
					image_16x9,
					image_9x16,
					is_delisted,
					uuid,
					duration,
					producers,
					presenters,
					guests,
					categories,
					tags,
					socmeds,
					show,
					user_created_by,
					user_updated_by,
					published_at,
				} = video;

				// Get relation document IDs
				const producerDocIds = getProducerDocumentIds(id, producers);
				const presenterDocIds = getPresenterDocumentIds(id, presenters);
				const guestDocIds = getGuestDocumentIds(id, guests);
				const categoryDocIds = getCategoryDocumentIds(id, categories);
				const tagDocIds = getTagDocumentIds(id, tags);
				const socmedDocIds = getSocmedDocumentIds(id, socmeds);
				const showDocId = getShowDocumentId(id, show?.id);
				const userCreatedByDocId = getUserDocumentId(id, user_created_by?.id);
				const userUpdatedByDocId = getUserDocumentId(id, user_updated_by?.id);

				// Get media file document IDs
				const videoDocId = getFileDocumentId(id, 'video', videoFile?.id);
				const image1x1DocId = getFileDocumentId(id, 'image_1x1', image_1x1?.id);
				const image16x9DocId = getFileDocumentId(
					id,
					'image_16x9',
					image_16x9?.id,
				);
				const image9x16DocId = getFileDocumentId(
					id,
					'image_9x16',
					image_9x16?.id,
				);

				const isPublishedVideo = !!published_at;

				const { id: strapi5Id, documentId } = await Strapi5.createVideo({
					title,
					slug,
					description,
					hide_download,
					hide_sponsor,
					editors_picked,
					is_hero,
					publish_at,
					videoDocumentId: videoDocId,
					image1x1DocumentId: image1x1DocId,
					image16x9DocumentId: image16x9DocId,
					image9x16DocumentId: image9x16DocId,
					is_delisted,
					uuid,
					duration,
					producers: producerDocIds,
					presenters: presenterDocIds,
					guests: guestDocIds,
					categories: categoryDocIds,
					tags: tagDocIds,
					socmeds: socmedDocIds,
					show: showDocId ? [showDocId] : [],
					user_created_by: userCreatedByDocId ? [userCreatedByDocId] : [],
					user_updated_by: userUpdatedByDocId ? [userUpdatedByDocId] : [],
					status: isPublishedVideo ? 'published' : 'draft',
				});

				return { strapi5Id, documentId };
			},
			(video: Video) => video.id,
		);

		const createStats = await processBatch(
			newVideos,
			createProcessor,
			shutdownController,
			{
				onItemSuccess: async (strapi3Video, strapi5Video) => {
					const { id, updated_at, published_at } = strapi3Video;
					const { documentId } = strapi5Video;

					const isPublishedVideo = !!published_at;
					const videoInfo = await Strapi5.getVideo(documentId, {
						status: isPublishedVideo ? 'published' : 'draft',
					});

					// Hopefully this never happens, otherwise we need to move this logic outside onItemSuccess
					// This means that video was draft in Strapi 3 but created as published in Strapi 5
					// or vice versa
					if (!videoInfo) {
						throw new Error(
							`CREATE: Video ${id} with status ${isPublishedVideo ? 'published' : 'draft'} not found in Strapi 5`,
						);
					}

					tracker.register({
						id,
						documentId,
						updated_at,
						publishedStrapi5Id: isPublishedVideo ? videoInfo.id : null,
						draftStrapi5Id: isPublishedVideo ? null : videoInfo.id,
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

	// Process stale videos
	if (staleVideos.length > 0) {
		console.log(`\n🔄 Updating ${staleVideos.length} stale videos...`);
		const updateProcessor = createStrapiProcessor(
			async (video: Video) => {
				const {
					id,
					title,
					slug,
					description,
					hide_download,
					hide_sponsor,
					editors_picked,
					is_hero,
					publish_at,
					video: videoFile,
					image_1x1,
					image_16x9,
					image_9x16,
					is_delisted,
					uuid,
					duration,
					producers,
					presenters,
					guests,
					categories,
					tags,
					socmeds,
					show,
					user_created_by,
					user_updated_by,
					published_at,
				} = video;

				// @ts-ignore strapi5PublishedId is not typed, but it exists
				const { documentId } = tracker.get(id) || {};
				if (!documentId) {
					throw new Error(`Update Failed: Video ${id} not found in tracker`);
				}

				// Get relation document IDs
				const producerDocIds = getProducerDocumentIds(id, producers);
				const presenterDocIds = getPresenterDocumentIds(id, presenters);
				const guestDocIds = getGuestDocumentIds(id, guests);
				const categoryDocIds = getCategoryDocumentIds(id, categories);
				const tagDocIds = getTagDocumentIds(id, tags);
				const socmedDocIds = getSocmedDocumentIds(id, socmeds);
				const showDocId = getShowDocumentId(id, show?.id);
				const userCreatedByDocId = getUserDocumentId(id, user_created_by?.id);
				const userUpdatedByDocId = getUserDocumentId(id, user_updated_by?.id);

				// Get media file document IDs
				const videoDocId = getFileDocumentId(id, 'video', videoFile?.id);
				const image1x1DocId = getFileDocumentId(id, 'image_1x1', image_1x1?.id);
				const image16x9DocId = getFileDocumentId(
					id,
					'image_16x9',
					image_16x9?.id,
				);
				const image9x16DocId = getFileDocumentId(
					id,
					'image_9x16',
					image_9x16?.id,
				);

				const isPublishedVideo = !!published_at;
				await Strapi5.updateVideo(documentId, {
					title,
					slug,
					description,
					hide_download,
					hide_sponsor,
					editors_picked,
					is_hero,
					publish_at,
					videoDocumentId: videoDocId,
					image1x1DocumentId: image1x1DocId,
					image16x9DocumentId: image16x9DocId,
					image9x16DocumentId: image9x16DocId,
					is_delisted,
					uuid,
					duration,
					producers: producerDocIds,
					presenters: presenterDocIds,
					guests: guestDocIds,
					categories: categoryDocIds,
					tags: tagDocIds,
					socmeds: socmedDocIds,
					show: showDocId ? [showDocId] : [],
					user_created_by: userCreatedByDocId ? [userCreatedByDocId] : [],
					user_updated_by: userUpdatedByDocId ? [userUpdatedByDocId] : [],
					status: isPublishedVideo ? 'published' : 'draft',
				});

				return {
					documentId,
				};
			},
			(video: Video) => video.id,
		);

		const updateStats = await processBatch(
			staleVideos,
			updateProcessor,
			shutdownController,
			{
				onItemSuccess: async (strapi3Video, strapi5Video) => {
					const { id, updated_at, published_at } = strapi3Video;
					const { documentId } = strapi5Video;

					// if video was not published before and it got published, we need to update the tracker to include the published id
					const isPublishedVideo = !!published_at;
					const videoInfo = await Strapi5.getVideo(documentId, {
						status: isPublishedVideo ? 'published' : 'draft',
					});

					// Hopefully this never happens, otherwise we need to move this logic outside onItemSuccess
					if (!videoInfo) {
						throw new Error(
							`UPDATE: Video ${id} with status ${isPublishedVideo ? 'published' : 'draft'} not found in Strapi 5`,
						);
					}

					tracker.update(id, updated_at, {
						publishedStrapi5Id: isPublishedVideo ? videoInfo.id : null,
						draftStrapi5Id: isPublishedVideo ? null : videoInfo.id,
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
	console.log(`  ⏭️  Skipped (already up-to-date): ${skipVideos.length}`);
	console.log(`  📝 Total processed: ${totalStats.totalProcessed}`);

	if (totalStats.failedItems.length > 0) {
		console.log('\n❌ Failed items:');
		for (const failedItem of totalStats.failedItems) {
			const item = failedItem.item as Video;
			console.log(
				`  - ID: ${item.id}, Title: ${item.title}, Error: ${failedItem.error.message}`,
			);
		}
	}
};

// Helper function to get Strapi5 document IDs from Strapi3 profile IDs (Producers)
const getProducerDocumentIds = (
	videoId: number,
	producers: Profile[],
): string[] => {
	const documentIds = producers.map((p) =>
		ProfileMigration.getProfileDocumentId(p.id),
	);

	const notMigratedProducers = documentIds
		.map((id, index) => ({ id, producer: producers[index] }))
		.filter(({ id }) => !id)
		.map(({ producer }) => producer.id);

	if (notMigratedProducers.length > 0) {
		throw new Error(
			`Video ${videoId} has producers that are not migrated: ${notMigratedProducers.join(' | ')}`,
		);
	}

	// @ts-ignore we already checked if ALL the ids are defined above
	return documentIds;
};

// Helper function to get Strapi5 document IDs from Strapi3 profile IDs (Presenters)
const getPresenterDocumentIds = (
	videoId: number,
	presenters: Profile[],
): string[] => {
	const documentIds = presenters.map((p) =>
		ProfileMigration.getProfileDocumentId(p.id),
	);

	const notMigratedPresenters = documentIds
		.map((id, index) => ({ id, presenter: presenters[index] }))
		.filter(({ id }) => !id)
		.map(({ presenter }) => presenter.id);

	if (notMigratedPresenters.length > 0) {
		throw new Error(
			`Video ${videoId} has presenters that are not migrated: ${notMigratedPresenters.join(' | ')}`,
		);
	}

	// @ts-ignore we already checked if ALL the ids are defined above
	return documentIds;
};

// Helper function to get Strapi5 document IDs from Strapi3 guest IDs
const getGuestDocumentIds = (videoId: number, guests: Guest[]): string[] => {
	const documentIds = guests.map((g) =>
		GuestMigration.getGuestDocumentId(g.id),
	);

	const notMigratedGuests = documentIds
		.map((id, index) => ({ id, guest: guests[index] }))
		.filter(({ id }) => !id)
		.map(({ guest }) => guest.id);

	if (notMigratedGuests.length > 0) {
		throw new Error(
			`Video ${videoId} has guests that are not migrated: ${notMigratedGuests.join(' | ')}`,
		);
	}

	// @ts-ignore we already checked if ALL the ids are defined above
	return documentIds;
};

// Helper function to get Strapi5 document IDs from Strapi3 category IDs
const getCategoryDocumentIds = (
	videoId: number,
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
			`Video ${videoId} has categories that are not migrated: ${notMigratedCategories.join(' | ')}`,
		);
	}

	// @ts-ignore we already checked if ALL the ids are defined above
	return documentIds;
};

// Helper function to get Strapi5 document IDs from Strapi3 tag IDs
const getTagDocumentIds = (videoId: number, tags: Tag[]): string[] => {
	const documentIds = tags.map((t) => TagMigration.getTagDocumentId(t.id));

	const notMigratedTags = documentIds
		.map((id, index) => ({ id, tag: tags[index] }))
		.filter(({ id }) => !id)
		.map(({ tag }) => tag.id);

	if (notMigratedTags.length > 0) {
		throw new Error(
			`Video ${videoId} has tags that are not migrated: ${notMigratedTags.join(' | ')}`,
		);
	}

	// @ts-ignore we already checked if ALL the ids are defined above
	return documentIds;
};

// Helper function to get Strapi5 document IDs from Strapi3 socmed IDs
const getSocmedDocumentIds = (videoId: number, socmeds: Socmed[]): string[] => {
	const documentIds = socmeds.map((s) =>
		SocmedMigration.getSocmedDocumentId(s.id),
	);

	const notMigratedSocmeds = documentIds
		.map((id, index) => ({ id, socmed: socmeds[index] }))
		.filter(({ id }) => !id)
		.map(({ socmed }) => socmed.id);

	if (notMigratedSocmeds.length > 0) {
		throw new Error(
			`Video ${videoId} has socmeds that are not migrated: ${notMigratedSocmeds.join(' | ')}`,
		);
	}

	// @ts-ignore we already checked if ALL the ids are defined above
	return documentIds;
};

// Helper function to get Strapi5 document ID from Strapi3 show ID
const getShowDocumentId = (videoId: number, strapi3ShowId?: number) => {
	if (!strapi3ShowId) {
		return null;
	}

	const showDocumentId = ShowMigration.getShowDocumentId(strapi3ShowId);

	if (!showDocumentId) {
		throw new Error(
			`Video ${videoId} has show ${strapi3ShowId} that is not migrated - show migration may not be complete`,
		);
	}

	return showDocumentId;
};

// Helper function to get Strapi5 document ID from Strapi3 user ID
const getUserDocumentId = (videoId: number, strapi3UserId?: number) => {
	if (!strapi3UserId) {
		return null;
	}

	const userDocumentId = UserMigration.getUserDocumentId(strapi3UserId);

	if (!userDocumentId) {
		throw new Error(
			`Video ${videoId} has user ${strapi3UserId} that is not migrated - user migration may not be complete`,
		);
	}

	return userDocumentId;
};

// Helper function to get Strapi5 file ID from Strapi3 file ID
// Media files don't work with documentId, so we use the strapi 5 id
const getFileDocumentId = (
	videoId: number,
	fieldName: string,
	strapi3FileId?: number,
) => {
	if (!strapi3FileId) {
		return undefined;
	}

	const fileStrapi5Id = FileMigration.getFileStrapi5Id(strapi3FileId);

	if (!fileStrapi5Id) {
		throw new Error(
			`Video ${videoId} references a ${fieldName} file ${strapi3FileId} that is not migrated`,
		);
	}

	return fileStrapi5Id;
};

const getVideoDocumentId = (strapi3VideoId: number) => {
	return tracker.get(strapi3VideoId)?.documentId;
};

export default {
	start,
	getVideoDocumentId,
};
