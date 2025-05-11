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

		const { id } = show;
		console.log(`Migrating: ${id}`);

		const { documentId } = await Strapi5.createShow({
			name: show.name,
			description: show.description,
			customStatus: show.status,
			audio_s3path: show.audio_s3path,
			image_s3path: show.image_s3path,
			slug: show.slug,
			omny_programid: show.omny_programid,
			omny_playlistid: show.omny_playlistid,
			// media files don't work with documentId, so we use the strapi 5 id
			showArtDocumentId: getShowArtDocumentId(show.id, show.show_art?.id),
			categoriesDocumentIds: getShowCategoriesDocumentIds(
				show.id,
				show.categories,
			),
			subcategoriesDocumentIds: getShowSubcategoriesDocumentIds(
				show.id,
				show.subcategories,
			),
			status: show.published_at ? 'published' : 'draft',
		});
		tracker.register({ id, documentId, updated_at: show.updated_at });
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

const updateShow = async (show: Show) => {
	const { id, updated_at } = show;
	console.log(`Updating: ${id}`);

	const { documentId } = tracker.get(show.id) || {};

	if (!documentId) {
		throw new Error(`Update Failed:Show ${id} not found`);
	}

	await Strapi5.updateShow(documentId, {
		name: show.name,
		description: show.description,
		customStatus: show.status,
		audio_s3path: show.audio_s3path,
		image_s3path: show.image_s3path,
		slug: show.slug,
		omny_programid: show.omny_programid,
		omny_playlistid: show.omny_playlistid,
		// media files don't work with documentId, so we use the strapi 5 id
		showArtDocumentId: getShowArtDocumentId(show.id, show.show_art?.id),
		categoriesDocumentIds: getShowCategoriesDocumentIds(
			show.id,
			show.categories,
		),
		subcategoriesDocumentIds: getShowSubcategoriesDocumentIds(
			show.id,
			show.subcategories,
		),
		status: show.published_at ? 'published' : 'draft',
	});

	tracker.update(id, updated_at);
};

export default {
	start,
};
