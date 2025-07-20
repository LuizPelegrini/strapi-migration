import Strapi3 from '@/cms/strapi3.ts';
import Strapi5 from '@/cms/strapi5.ts';
import ShowMigration from '@/entities/show/migration.ts';
import type { Belt, Show } from '@/types.ts';
import { Tracker } from '@/utils/tracker.ts';

const tracker = new Tracker('belt');

const start = async () => {
	console.log('\n\n\n------ Belt -------');
	const belts = await Strapi3.getBelts();

	try {
		await migrate(belts);
		console.log('Belt migration completed 🎉');
	} catch (error) {
		console.log(error);
	} finally {
		tracker.save();
	}
};

const migrate = async (belts: Belt[]) => {
	for (const belt of belts) {
		if (tracker.exists(belt.id)) {
			if (tracker.isStale(belt.id, belt.updated_at)) {
				await updateBelt(belt);
				continue;
			}

			console.log(`Belt ${belt.id} already migrated. Skipping...`);
			continue;
		}

		const {
			id,
			name,
			description,
			published_at,
			updated_at,
			slug,
			shows,
			live_status,
		} = belt;
		console.log(`Migrating: ${id}`);

		const isPublishedBelt = !!published_at;

		const { id: strapi5Id, documentId } = await Strapi5.createBelt({
			strapi3Id: id,
			name: name,
			description,
			showsDocumentIds: getShowsDocumentIds(id, shows),
			live_status,
			slug,
			status: isPublishedBelt ? 'published' : 'draft',
		});

		if (isPublishedBelt) {
			// We need to fetch its draft id to save it.
			// Doing this, just in case we need to have both ids in future
			const draftBeltEntry = await Strapi5.getBelt(documentId, {
				status: 'draft',
			});

			tracker.register({
				id,
				documentId,
				updated_at,
				draftStrapi5Id: draftBeltEntry.id,
				publishedStrapi5Id: strapi5Id,
			});
		} else {
			// If it's a draft belt, we won't have a published belt entry in Strapi 5
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

const getShowsDocumentIds = (beltId: number, shows: Show[]): string[] => {
	const documentIds = shows.map((s) => ShowMigration.getShowDocumentId(s.id));

	const notMigratedShows = documentIds.filter((id) => !id);

	if (notMigratedShows.length > 0) {
		throw new Error(
			`Belt ${beltId} has shows that are not migrated: ${notMigratedShows.join(
				' | ',
			)}`,
		);
	}

	// @ts-ignore we already checked if ALL the ids are defined above
	return documentIds;
};

const updateBelt = async (belt: Belt) => {
	const {
		id,
		name,
		description,
		published_at,
		slug,
		updated_at,
		live_status,
		shows,
	} = belt;
	console.log(`Updating: ${id}`);

	// @ts-ignore strapi5PublishedId is not typed, but it exists
	const { documentId, publishedStrapi5Id } = tracker.get(id) || {};

	if (!documentId) {
		throw new Error(`Update Failed:Belt ${id} not found`);
	}

	const isPublishedBelt = !!published_at;

	const { id: strapi5Id } = await Strapi5.updateBelt(documentId, {
		strapi3Id: id,
		name,
		description,
		slug,
		live_status,
		showsDocumentIds: getShowsDocumentIds(id, shows),
		status: isPublishedBelt ? 'published' : 'draft',
	});

	// if belt was not published before and it got published, we need to update the tracker to include the published id
	tracker.update(id, updated_at, {
		...(isPublishedBelt &&
			!publishedStrapi5Id && {
				publishedStrapi5Id: strapi5Id,
			}),
	});
};

export default {
	start,
};
