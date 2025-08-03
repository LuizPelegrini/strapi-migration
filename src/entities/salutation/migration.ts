import Strapi3 from '@/cms/strapi3.ts';
import Strapi5 from '@/cms/strapi5.ts';
import type { Salutation } from '@/types.ts';
import { Tracker } from '@/utils/tracker.ts';

const tracker = new Tracker('salutation');

const start = async () => {
	console.log('\n\n\n------ Salutation -------');
	const salutations = await Strapi3.getSalutations();

	try {
		await migrate(salutations);
		console.log('Salutation migration completed 🎉');
	} catch (error) {
		console.log(error);
	} finally {
		tracker.save();
	}
};

const migrate = async (salutations: Salutation[]) => {
	for (const salutation of salutations) {
		if (tracker.exists(salutation.id)) {
			if (tracker.isStale(salutation.id, salutation.updated_at)) {
				await updateSalutation(salutation);
				continue;
			}

			console.log(`Salutation ${salutation.id} already migrated. Skipping...`);
			continue;
		}

		const { id, updated_at } = salutation;
		console.log(`Migrating: ${id}`);

		const documentId = await Strapi5.createSalutation({
			name: salutation.name,
		});
		tracker.register({ id, documentId, updated_at });
	}
};

const getSalutationDocumentId = (id: number) => {
	return tracker.get(id)?.documentId;
};

const updateSalutation = async (salutation: Salutation) => {
	const { id, updated_at } = salutation;
	console.log(`Updating: ${id}`);

	const { documentId } = tracker.get(salutation.id) || {};

	if (!documentId) {
		throw new Error(`Update Failed: Salutation ${id} not found`);
	}

	await Strapi5.updateSalutation(documentId, {
		name: salutation.name,
	});

	tracker.update(id, updated_at);
};

export default {
	start,
	getSalutationDocumentId,
};
