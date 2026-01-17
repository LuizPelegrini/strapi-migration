import Strapi3 from '@/cms/strapi3.ts';
import Strapi5 from '@/cms/strapi5.ts';
import type { Profile } from '@/types.ts';
import { Tracker } from '@/utils/tracker.ts';

const tracker = new Tracker('profile');

const start = async () => {
	console.log('\n\n\n------ Profile -------');
	const profiles = await Strapi3.getProfiles();

	try {
		await migrate(profiles);
		console.log('Profile migration completed 🎉');
	} catch (error) {
		console.log(error);
	} finally {
		tracker.save();
	}
};

const migrate = async (profiles: Profile[]) => {
	for (const profile of profiles) {
		if (tracker.exists(profile.id)) {
			if (tracker.isStale(profile.id, profile.updated_at)) {
				await updateProfile(profile);
				continue;
			}

			console.log(`Profile ${profile.id} already migrated. Skipping...`);
			continue;
		}

		const {
			id,
			name,
			presenter,
			producer,
			author,
			editor,
			moderator,
			image,
			description,
			published_at,
			updated_at,
		} = profile;
		console.log(`Migrating: ${id}`);

		const isPublishedProfile = !!published_at;

		const { id: strapi5Id, documentId } = await Strapi5.createProfile({
			name,
			presenter,
			producer,
			author,
			editor,
			moderator,
			image,
			description,
			status: isPublishedProfile ? 'published' : 'draft',
		});

		if (isPublishedProfile) {
			// We need to fetch its draft id to save it.
			// Doing this, just in case we need to have both ids in future
			const draftProfileEntry = await Strapi5.getProfile(documentId, {
				status: 'draft',
			});

			tracker.register({
				id,
				documentId,
				updated_at,
				draftStrapi5Id: draftProfileEntry.id,
				publishedStrapi5Id: strapi5Id,
			});
		} else {
			// If it's a draft profile, we won't have a published profile entry in Strapi 5
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

const updateProfile = async (profile: Profile) => {
	const {
		id,
		name,
		presenter,
		producer,
		author,
		editor,
		moderator,
		image,
		description,
		published_at,
		updated_at,
	} = profile;
	console.log(`Updating: ${id}`);

	// @ts-ignore strapi5PublishedId is not typed, but it exists
	const { documentId, publishedStrapi5Id } = tracker.get(id) || {};

	if (!documentId) {
		throw new Error(`Update Failed: Profile ${id} not found`);
	}

	const isPublishedProfile = !!published_at;

	const { id: strapi5Id } = await Strapi5.updateProfile(documentId, {
		name,
		presenter,
		producer,
		author,
		editor,
		moderator,
		image,
		description,
		status: isPublishedProfile ? 'published' : 'draft',
	});

	// if profile was not published before and it got published, we need to update the tracker to include the published id
	tracker.update(id, updated_at, {
		...(isPublishedProfile &&
			!publishedStrapi5Id && {
				publishedStrapi5Id: strapi5Id,
			}),
	});
};

const getProfileDocumentId = (strapi3ProfileId: number) => {
	return tracker.get(strapi3ProfileId)?.documentId;
};

export default {
	start,
	getProfileDocumentId,
};
