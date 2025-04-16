import Strapi3 from '@/cms/strapi3.ts';
import Strapi5 from '@/cms/strapi5.ts';
import type { File } from '@/types.ts';
import { Tracker } from '@/utils/tracker.ts';

const tracker = new Tracker('file');

const start = async () => {
	console.log('\n\n\n------ Files -------');
	const files = await Strapi3.getFiles();

	try {
		await migrate(files);
	} catch (error) {
		console.log(error);
	} finally {
		tracker.save();
	}
};

const migrate = async (files: File[]) => {
	for (const file of files) {
		if (tracker.exists(file.id)) {
			if (tracker.isStale(file.id, file.updated_at)) {
				await updateFile(file);
				continue;
			}

			console.log(`File ${file.id} already migrated. Skipping...`);
			continue;
		}

		const { id, ...data } = file;
		console.log(`Migrating: ${id}`);

		const { id: strapi5Id, documentId } = await Strapi5.createFile(data);
		tracker.register({
			id,
			documentId,
			strapi5Id,
			updated_at: file.updated_at,
		});
	}
};

const updateFile = async (file: File) => {
	const { id, ...data } = file;
	console.log(`Updating: ${id}`);

	// @ts-ignore strapi5Id is not typed, but it exists
	const { strapi5Id } = tracker.get(id) || {};
	if (!strapi5Id) {
		throw new Error(`Update Failed: File ${id} not found`);
	}

	await Strapi5.updateFile(strapi5Id, data);

	tracker.update(id, data.updated_at);
};

export default {
	start,
};
