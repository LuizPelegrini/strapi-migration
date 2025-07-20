import Strapi3 from '@/cms/strapi3.ts';
import Strapi5 from '@/cms/strapi5.ts';
import FileMigration from '@/entities/file/migration.ts';
import ShowCategoryMigration from '@/entities/show-category/migration.ts';
import ShowSubCategoryMigration from '@/entities/show-sub-category/migration.ts';
import type { Show, ShowCategory, ShowSubCategory } from '@/types.ts';
import { Tracker } from '@/utils/tracker.ts';

const tracker = new Tracker('show');

const start = async () => {
	console.log('\n\n\n------ Show -------');
	const shows = await Strapi3.getShows();

	try {
		await migrate(shows);
	} catch (error) {
		console.log(error);
	} finally {
		tracker.save();
	}
};

const migrate = async (shows: Show[]) => {
	for (const show of shows) {
		if (tracker.exists(show.id)) {
			if (tracker.isStale(show.id, show.updated_at)) {
				await updateShow(show);
				continue;
			}

			console.log(`Show ${show.id} already migrated. Skipping...`);
			continue;
		}

		const {
			id,
			name,
			description,
			status,
			published_at,
			updated_at,
			audio_s3path,
			image_s3path,
			slug,
			omny_programid,
			omny_playlistid,
			show_art,
			categories,
			subcategories,
		} = show;
		console.log(`Migrating: ${id}`);

		const isPublishedShow = !!published_at;

		const { id: strapi5Id, documentId } = await Strapi5.createShow({
			strapi3Id: id,
			name: name,
			description,
			customStatus: status,
			audio_s3path,
			image_s3path,
			slug,
			omny_programid,
			omny_playlistid,
			// media files don't work with documentId, so we use the strapi 5 id
			showArtDocumentId: getShowArtDocumentId(id, show_art?.id),
			categoriesDocumentIds: getShowCategoriesDocumentIds(id, categories),
			subcategoriesDocumentIds: getShowSubcategoriesDocumentIds(
				id,
				subcategories,
			),
			status: isPublishedShow ? 'published' : 'draft',
		});

		if (isPublishedShow) {
			// We need to fetch its draft id to save it.
			// This is needed when linking a user to a show, since it needs both ids to be set
			const draftShowEntry = await Strapi5.getShow(documentId, {
				status: 'draft',
			});

			tracker.register({
				id,
				documentId,
				updated_at,
				draftStrapi5Id: draftShowEntry.id,
				publishedStrapi5Id: strapi5Id,
			});
		} else {
			// If it's a draft show, we won't have a published show entry in Strapi 5
			tracker.register({
				id,
				documentId,
				updated_at,
				draftStrapi5Id: strapi5Id,
				publishedStrapi5Id: null,
			});
		}
	}
};

const getShowArtDocumentId = (showId: number, id?: number) => {
	if (!id) {
		return null;
	}

	const showArtDocumentId = FileMigration.getFileStrapi5Id(id);

	if (!showArtDocumentId) {
		throw new Error(
			`Show ${showId} references a file ${id} that is not migrated`,
		);
	}

	return showArtDocumentId;
};

const getShowCategoriesDocumentIds = (
	showId: number,
	categories: ShowCategory[],
): string[] => {
	const documentIds = categories.map((c) =>
		ShowCategoryMigration.getShowCategoryDocumentId(c.id),
	);

	const notMigratedCategories = documentIds.filter((id) => !id);

	if (notMigratedCategories.length > 0) {
		throw new Error(
			`Show ${showId} has show-categories that are not migrated: ${notMigratedCategories.join(
				' | ',
			)}`,
		);
	}

	// @ts-ignore we already checked if ALL the ids are defined above
	return documentIds;
};

const getShowSubcategoriesDocumentIds = (
	showId: number,
	subcategories: ShowSubCategory[],
): string[] => {
	const documentIds = subcategories.map((c) =>
		ShowSubCategoryMigration.getShowSubCategoryDocumentId(c.id),
	);

	const notMigratedSubcategories = documentIds.filter((id) => !id);

	if (notMigratedSubcategories.length > 0) {
		throw new Error(
			`Show ${showId} has show-subcategories that are not migrated: ${notMigratedSubcategories.join(
				' | ',
			)}`,
		);
	}

	// @ts-ignore we already checked if ALL the ids are defined above
	return documentIds;
};

const getShowIds = (
	id: number,
): { publishedStrapi5Id?: number; draftStrapi5Id?: number } => {
	// @ts-ignore strapi5PublishedId, strapi5DraftId is not typed, but it exists
	const { publishedStrapi5Id, draftStrapi5Id } = tracker.get(id) || {};
	return {
		publishedStrapi5Id,
		draftStrapi5Id,
	};
};

const getShowDocumentId = (id: number) => {
	return tracker.get(id)?.documentId;
};

const updateShow = async (show: Show) => {
	const {
		id,
		name,
		description,
		status,
		published_at,
		audio_s3path,
		image_s3path,
		slug,
		omny_programid,
		omny_playlistid,
		show_art,
		categories,
		subcategories,
		updated_at,
	} = show;
	console.log(`Updating: ${id}`);

	// @ts-ignore strapi5PublishedId is not typed, but it exists
	const { documentId, publishedStrapi5Id } = tracker.get(id) || {};

	if (!documentId) {
		throw new Error(`Update Failed:Show ${id} not found`);
	}

	const isPublishedShow = !!published_at;

	const { id: strapi5Id } = await Strapi5.updateShow(documentId, {
		strapi3Id: id,
		name,
		description,
		customStatus: status,
		audio_s3path,
		image_s3path,
		slug,
		omny_programid,
		omny_playlistid,
		// media files don't work with documentId, so we use the strapi 5 id
		showArtDocumentId: getShowArtDocumentId(id, show_art?.id),
		categoriesDocumentIds: getShowCategoriesDocumentIds(id, categories),
		subcategoriesDocumentIds: getShowSubcategoriesDocumentIds(
			id,
			subcategories,
		),
		status: isPublishedShow ? 'published' : 'draft',
	});

	// if show was not published before and it got published, we need to update the tracker to include the published id
	tracker.update(id, updated_at, {
		...(isPublishedShow &&
			!publishedStrapi5Id && {
				publishedStrapi5Id: strapi5Id,
			}),
	});
};

export default {
	start,
	getShowIds,
	getShowDocumentId,
};
