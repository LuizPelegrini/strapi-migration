import Strapi3 from '@/cms/strapi3.ts';
import Strapi5 from '@/cms/strapi5.ts';
import ShowMigration from '@/entities/show/migration.ts';
import type { Show, User } from '@/types.ts';
import { Tracker } from '@/utils/tracker.ts';

const tracker = new Tracker('user');

const start = async () => {
	console.log('\n\n\n------ User -------');
	const users = await Strapi3.getUsers();

	try {
		await migrate(users);
		console.log('User migration completed 🎉');
	} catch (error) {
		console.log(error);
	} finally {
		tracker.save();
	}
};

const migrate = async (users: User[]) => {
	for (const user of users) {
		if (tracker.exists(user.id)) {
			if (tracker.isStale(user.id, user.updated_at)) {
				await updateUser(user);
				continue;
			}

			console.log(`User ${user.id} already migrated. Skipping...`);
			continue;
		}

		const { id, blocked, confirmed, email, username, updated_at } = user;
		console.log(`Migrating: ${id}`);

		const { strapi5Id, documentId, password } = await Strapi5.createUser({
			username,
			email,
			blocked,
			confirmed,
			// show relations don't work with documentId, so we use the strapi 5 id
			shows: getShowsIds(id, user.shows),
		});
		tracker.register({ id, documentId, strapi5Id, updated_at });
		savePassword(email, password);
	}
};

const getShowsIds = (
	userId: number,
	shows: Show[],
): {
	publishedStrapi5Id: number;
	draftStrapi5Id: number;
}[] => {
	const ids = shows.map((s) => ShowMigration.getShowIds(s.id));

	// we just need to check for undefined draft ids, as published Ids might not be set if the show in Strapi 3 was set as draft during migration
	const strapi5DraftIds = ids
		.map((id) => id.draftStrapi5Id)
		.filter((id) => !id);

	if (strapi5DraftIds.length > 0) {
		throw new Error(`
			DRAFT shows IDs not found! User ${userId} has shows that are not migrated: ${strapi5DraftIds.join(' | ')}
		`);
	}

	// @ts-ignore we already checked if ALL the ids are defined above
	return ids;
};

// const getShowArtDocumentId = (showId: number, id?: number) => {
// 	if (!id) {
// 		return null;
// 	}

// 	const showArtDocumentId = FileMigration.getFileStrapi5Id(id);

// 	if (!showArtDocumentId) {
// 		throw new Error(
// 			`Show ${showId} references a file ${id} that is not migrated`,
// 		);
// 	}

// 	return showArtDocumentId;
// };

// const getShowCategoriesDocumentIds = (
// 	showId: number,
// 	categories: ShowCategory[],
// ): string[] => {
// 	const documentIds = categories.map((c) =>
// 		ShowCategoryMigration.getShowCategoryDocumentId(c.id),
// 	);

// 	const notMigratedCategories = documentIds.filter((id) => !id);

// 	if (notMigratedCategories.length > 0) {
// 		throw new Error(
// 			`Show ${showId} has show-categories that are not migrated: ${notMigratedCategories.join(
// 				' | ',
// 			)}`,
// 		);
// 	}

// 	// @ts-ignore we already checked if ALL the ids are defined above
// 	return documentIds;
// };

// const getShowSubcategoriesDocumentIds = (
// 	showId: number,
// 	subcategories: ShowSubCategory[],
// ): string[] => {
// 	const documentIds = subcategories.map((c) =>
// 		ShowSubCategoryMigration.getShowSubCategoryDocumentId(c.id),
// 	);

// 	const notMigratedSubcategories = documentIds.filter((id) => !id);

// 	if (notMigratedSubcategories.length > 0) {
// 		throw new Error(
// 			`Show ${showId} has show-subcategories that are not migrated: ${notMigratedSubcategories.join(
// 				' | ',
// 			)}`,
// 		);
// 	}

// 	// @ts-ignore we already checked if ALL the ids are defined above
// 	return documentIds;
// };

const updateUser = async (user: User) => {
	const { id, blocked, email, username, confirmed, updated_at, shows } = user;
	console.log(`Updating: ${id}`);

	// @ts-ignore strapi5Id is not typed, but it exists
	const { strapi5Id } = tracker.get(id) || {};

	if (!strapi5Id) {
		throw new Error(`Update Failed:User ${id} not found`);
	}

	await Strapi5.updateUser(strapi5Id, {
		username,
		blocked,
		confirmed,
		email,
		// show relations don't work with documentId, so we use the strapi 5 id
		shows: getShowsIds(id, shows),
	});

	tracker.update(id, updated_at);
};

const savePassword = (email: string, password: string) => {
	// write password to file passwords.json
	try {
		const passwordsFile = `${Deno.cwd()}/src/entities/user/passwords.json`;
		let passwords: Record<string, string> = {};

		try {
			const content = Deno.readTextFileSync(passwordsFile);
			passwords = JSON.parse(content);
		} catch (error) {
			if (!(error instanceof Deno.errors.NotFound)) {
				throw error;
			}
			// File doesn't exist yet, that's ok
		}

		// Add new password entry
		passwords[email] = password;

		// Write back to file
		Deno.writeTextFileSync(passwordsFile, JSON.stringify(passwords, null, 2));
	} catch (error) {
		console.error(`Failed to write password for ${email}:`, error);
	}
};

export default {
	start,
};
