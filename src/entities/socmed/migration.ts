import Strapi3 from '@/cms/strapi3.ts';
import Strapi5 from '@/cms/strapi5.ts';
import type { Socmed } from '@/types.ts';
import { Tracker } from '@/utils/tracker.ts';

const tracker = new Tracker('socmed');

const start = async () => {
	console.log('\n\n\n------ Socmed -------');
	const socmeds = await Strapi3.getSocmeds();

	try {
		await migrate(socmeds);
		console.log('Socmed migration completed 🎉');
	} catch (error) {
		console.log(error);
	} finally {
		tracker.save();
	}
};

const migrate = async (socmeds: Socmed[]) => {
	for (const socmed of socmeds) {
		if (tracker.exists(socmed.id)) {
			if (tracker.isStale(socmed.id, socmed.updated_at)) {
				await updateSocmed(socmed);
				continue;
			}

			console.log(`Socmed ${socmed.id} already migrated. Skipping...`);
			continue;
		}

		const { id, url, source, other_source, updated_at } = socmed;
		console.log(`Migrating: ${id}`);

		const { documentId } = await Strapi5.createSocmed({
			url,
			source,
			other_source,
		});

		tracker.register({
			id,
			documentId,
			updated_at,
		});
	}
};

const updateSocmed = async (socmed: Socmed) => {
	const { id, url, source, other_source, updated_at } = socmed;
	console.log(`Updating: ${id}`);

	// @ts-ignore strapi5PublishedId is not typed, but it exists
	const { documentId } = tracker.get(id) || {};

	if (!documentId) {
		throw new Error(`Update Failed: Socmed ${id} not found`);
	}

	await Strapi5.updateSocmed(documentId, {
		url,
		source,
		other_source,
	});

	tracker.update(id, updated_at);
};

const getSocmedDocumentId = (strapi3SocmedId: number) => {
	return tracker.get(strapi3SocmedId)?.documentId;
};

export default {
	start,
	getSocmedDocumentId,
};
