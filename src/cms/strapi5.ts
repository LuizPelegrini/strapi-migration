import config from '@/config/index.ts';
import type { File, Show, User } from '@/types.ts';
import axios from 'axios';

const client = axios.create({
	baseURL: config.strapi5.baseUrl,
	headers: {
		Authorization: `Bearer ${config.strapi5.token}`,
	},
});

type Status = 'draft' | 'published';

type PrimaryCategoryResponse = {
	data: { documentId: string };
};
type Strapi5PrimaryCategory = {
	name: string;
	description: string | null;
	status: Status;
};
const createPrimaryCategory = async ({
	name,
	description,
	status,
}: Strapi5PrimaryCategory) => {
	const { data } = await client.post<PrimaryCategoryResponse>(
		'/primary-categories',
		{
			data: {
				name,
				description,
			},
		},
		{
			params: {
				status,
			},
		},
	);

	return data.data.documentId;
};

const updatePrimaryCategory = async (
	documentId: string,
	newData: Strapi5PrimaryCategory,
) => {
	const { status, ...rest } = newData;
	await client.put(
		`/primary-categories/${documentId}${status ? `?status=${status}` : ''}`,
		{ data: rest },
	);
};

type CategoryResponse = {
	data: { documentId: string };
};
type Strapi5Category = {
	name: string;
	description: string | null;
	status: Status;
	primaryCategoryDocumentId?: string;
};
const createCategory = async ({
	name,
	description,
	status,
	primaryCategoryDocumentId,
}: Strapi5Category) => {
	const { data } = await client.post<CategoryResponse>(
		'/categories',
		{
			data: {
				name,
				description,
				...(primaryCategoryDocumentId && {
					primary_category: {
						set: [primaryCategoryDocumentId],
					},
				}),
			},
		},
		{
			params: {
				status,
			},
		},
	);

	return data.data.documentId;
};

const updateCategory = async (documentId: string, newData: Strapi5Category) => {
	const { status, ...rest } = newData;
	await client.put(
		`/categories/${documentId}${status ? `?status=${status}` : ''}`,
		{ data: rest },
	);
};

type ShowCategoryResponse = {
	data: { documentId: string };
};
type Strapi5ShowCategory = {
	name: string;
};
const createShowCategory = async ({ name }: Strapi5ShowCategory) => {
	const { data } = await client.post<ShowCategoryResponse>('/show-categories', {
		data: {
			name,
		},
	});

	return data.data.documentId;
};

const updateShowCategory = async (
	documentId: string,
	newData: Strapi5ShowCategory,
) => {
	await client.put(`/show-categories/${documentId}`, { data: newData });
};

type ShowSubCategoryResponse = {
	data: { documentId: string };
};
type Strapi5ShowSubCategory = {
	name: string;
	showCategoryDocumentId?: string;
};
const createShowSubCategory = async ({
	name,
	showCategoryDocumentId,
}: Strapi5ShowSubCategory) => {
	const { data } = await client.post<ShowSubCategoryResponse>(
		'/show-sub-categories',
		{
			data: {
				name,
				...(showCategoryDocumentId && {
					show_category: {
						set: [showCategoryDocumentId],
					},
				}),
			},
		},
	);

	return data.data.documentId;
};

const updateShowSubCategory = async (
	documentId: string,
	{ name, showCategoryDocumentId }: Strapi5ShowSubCategory,
) => {
	await client.put(`/show-sub-categories/${documentId}`, {
		data: {
			name,
			...(showCategoryDocumentId && {
				show_category: {
					set: [showCategoryDocumentId],
				},
			}),
		},
	});
};

type FileResponse = {
	data: {
		id: number; // id is more important in this case, documentId does not work when setting file relations in other collections
		documentId: string;
	};
};
type Strapi5File = Omit<File, 'id'>;
// remove related from file as it is not supported in strapi 5
// remove updated_at from file as we don't want to send it to strapi 5 and it might override the updated_at in the file
const createFile = async ({ updated_at, related, ...file }: Strapi5File) => {
	const { data } = await client.post<FileResponse>('/upload/migration/create', {
		data: file,
	});

	// fields needed
	return {
		id: data.data.id,
		documentId: data.data.documentId,
	};
};

// to update a file, we need to use the id of the file, not the documentId
const updateFile = async (id: string, newData: Strapi5File) => {
	await client.put(`/upload/migration/update/${id}`, { data: newData });
};

const getShow = async (documentId: string, params?: { status?: Status }) => {
	const { data } = await client.get<ShowResponse>(`/shows/${documentId}`, {
		params,
	});
	return data.data;
};

type ShowResponse = {
	data: { id: number; documentId: string };
};
type Strapi5Show = Omit<
	Show,
	| 'id'
	| 'status'
	| 'categories'
	| 'subcategories'
	| 'show_art'
	| 'published_at'
	| 'updated_at'
> & {
	customStatus: boolean; // we renamed status (Strapi 3) to customStatus (Strapi 5)
	showArtDocumentId?: string;
	categoriesDocumentIds?: string[];
	subcategoriesDocumentIds?: string[];
	strapi3Id?: number;
	status: Status;
};
const createShow = async ({
	showArtDocumentId,
	categoriesDocumentIds,
	subcategoriesDocumentIds,
	status,
	...show
}: Strapi5Show) => {
	const { data } = await client.post<ShowResponse>(
		'/shows',
		{
			data: {
				...show,
				...(showArtDocumentId && {
					show_art: {
						set: [showArtDocumentId],
					},
				}),
				...(categoriesDocumentIds && {
					categories: {
						set: categoriesDocumentIds,
					},
				}),
				...(subcategoriesDocumentIds && {
					subcategories: {
						set: subcategoriesDocumentIds,
					},
				}),
			},
		},
		{
			params: {
				status,
			},
		},
	);

	return data.data;
};

const updateShow = async (documentId: string, newData: Strapi5Show) => {
	const {
		status,
		showArtDocumentId,
		categoriesDocumentIds,
		subcategoriesDocumentIds,
		...show
	} = newData;
	const { data } = await client.put<ShowResponse>(
		`/shows/${documentId}`,
		{
			data: {
				...show,
				...(showArtDocumentId && {
					show_art: {
						set: [showArtDocumentId],
					},
				}),
				...(categoriesDocumentIds && {
					categories: {
						set: categoriesDocumentIds,
					},
				}),
				...(subcategoriesDocumentIds && {
					subcategories: {
						set: subcategoriesDocumentIds,
					},
				}),
			},
		},
		{ params: { status } },
	);

	return data.data;
};

type UserResponse = {
	documentId: string;
	id: number;
};
type Strapi5User = Omit<
	User,
	'id' | 'updated_at' | 'role' | 'avatar' | 'password' | 'shows'
> & {
	shows?: {
		publishedStrapi5Id: number;
		draftStrapi5Id: number;
	}[];
};

const createUser = async ({
	username,
	email,
	blocked,
	confirmed,
	shows,
}: Strapi5User) => {
	const generateSecurePassword = (length = 16) => {
		const charset =
			'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
		const randomValues = new Uint8Array(length);
		crypto.getRandomValues(randomValues);

		return Array.from(randomValues)
			.map((x) => charset[x % charset.length])
			.join('');
	};

	const password = generateSecurePassword();
	const { data } = await client.post<UserResponse>('/users', {
		username,
		email,
		blocked,
		confirmed,
		password,
		role: {
			connect: [{ id: 1 }], // 1 for 'Authenticated' role
		},
		...(shows && {
			shows: {
				// Mimic same behaviour when setting relation in the dashboard: setting both draft and published ids
				set: shows.reduce(
					(acc, show) => {
						return [
							// biome-ignore lint/performance/noAccumulatingSpread: <explanation>
							...acc,
							{ id: show.draftStrapi5Id },
							{ id: show.publishedStrapi5Id },
						];
					},
					[] as { id: number }[],
				),
			},
		}),
	});

	return {
		strapi5Id: data.id,
		documentId: data.documentId,
		password,
	};
};

const updateUser = async (
	id: number,
	{ username, blocked, confirmed, email, shows }: Strapi5User,
) => {
	await client.put(`/users/${id}`, {
		username,
		blocked,
		confirmed,
		email,
		...(shows && {
			shows: {
				// Mimic same behaviour when setting relation in the dashboard: setting both draft and published ids
				set: shows.reduce(
					(acc, show) => {
						return [
							// biome-ignore lint/performance/noAccumulatingSpread: <explanation>
							...acc,
							{ id: show.draftStrapi5Id },
							{ id: show.publishedStrapi5Id },
						];
					},
					[] as { id: number }[],
				),
			},
		}),
	});
};

export default {
	createPrimaryCategory,
	updatePrimaryCategory,
	createCategory,
	updateCategory,
	createShowCategory,
	updateShowCategory,
	createShowSubCategory,
	updateShowSubCategory,
	createFile,
	updateFile,
	getShow,
	createShow,
	updateShow,
	createUser,
	updateUser,
};
