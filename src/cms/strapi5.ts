import config from '@/config/index.ts';
import type { Belt, File, Profile, Show, Socmed, Tag, User } from '@/types.ts';
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
	const { status, name, description, primaryCategoryDocumentId } = newData;
	await client.put(
		`/categories/${documentId}${status ? `?status=${status}` : ''}`,
		{
			data: {
				name,
				description,
				primary_category: { set: [primaryCategoryDocumentId] },
			},
		},
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

const getBelt = async (documentId: string, params?: { status?: Status }) => {
	const { data } = await client.get<ShowResponse>(`/belts/${documentId}`, {
		params,
	});
	return data.data;
};

type Strapi5Belt = Omit<
	Belt,
	'id' | 'updated_at' | 'published_at' | 'shows'
> & {
	status: Status;
	strapi3Id: number;
	showsDocumentIds: string[];
};
type BeltResponse = {
	data: {
		id: number;
		documentId: string;
	};
};
const createBelt = async ({
	name,
	description,
	showsDocumentIds,
	live_status,
	slug,
	status,
	strapi3Id,
}: Strapi5Belt) => {
	const { data } = await client.post<BeltResponse>(
		'/belts',
		{
			data: {
				strapi3Id,
				name,
				description,
				shows: {
					set: showsDocumentIds,
				},
				live_status,
				slug,
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

const updateBelt = async (
	documentId: string,
	{
		status,
		showsDocumentIds,
		strapi3Id,
		name,
		description,
		live_status,
		slug,
	}: Strapi5Belt,
) => {
	const { data } = await client.put<BeltResponse>(
		`/belts/${documentId}`,
		{
			data: {
				strapi3Id,
				name,
				description,
				shows: {
					set: showsDocumentIds,
				},
				live_status,
				slug,
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

type SalutationResponse = {
	data: { documentId: string };
};
type Strapi5Salutation = {
	name: string;
};
const createSalutation = async ({ name }: Strapi5Salutation) => {
	const { data } = await client.post<SalutationResponse>('/salutations', {
		data: {
			name,
		},
	});

	return data.data.documentId;
};

const updateSalutation = async (
	documentId: string,
	newData: Strapi5Salutation,
) => {
	await client.put(`/salutations/${documentId}`, {
		data: newData,
	});
};

type ProfileResponse = {
	data: {
		id: number;
		documentId: string;
	};
};
type Strapi5Profile = Omit<Profile, 'id' | 'updated_at' | 'published_at'> & {
	status: Status;
};
const createProfile = async (profile: Strapi5Profile) => {
	const { status, ...profileData } = profile;
	const { data } = await client.post<ProfileResponse>(
		'/profiles',
		{
			data: profileData,
		},
		{
			params: {
				status,
			},
		},
	);

	return data.data;
};

const updateProfile = async (documentId: string, newData: Strapi5Profile) => {
	const { status, ...profileData } = newData;
	const { data } = await client.put<ProfileResponse>(
		`/profiles/${documentId}`,
		{
			data: profileData,
		},
		{
			params: {
				status,
			},
		},
	);
	return data.data;
};

const getProfile = async (
	documentId: string,
	options?: { status?: Status },
) => {
	const { data } = await client.get<ProfileResponse>(
		`/profiles/${documentId}`,
		{
			params: options,
		},
	);
	return data.data;
};

type SocmedResponse = {
	data: {
		id: number;
		documentId: string;
	};
};
type Strapi5Socmed = Omit<Socmed, 'id' | 'updated_at'>;
const createSocmed = async (socmed: Strapi5Socmed) => {
	const { data } = await client.post<SocmedResponse>('/socmeds', {
		data: socmed,
	});

	return data.data;
};

const updateSocmed = async (documentId: string, newData: Strapi5Socmed) => {
	const { data } = await client.put<SocmedResponse>(`/socmeds/${documentId}`, {
		data: newData,
	});
	return data.data;
};

const getSocmed = async (documentId: string, options?: { status?: Status }) => {
	const { data } = await client.get<SocmedResponse>(`/socmeds/${documentId}`, {
		params: options,
	});
	return data.data;
};

type TagResponse = {
	data: {
		id: number;
		documentId: string;
	};
};
type Strapi5Tag = Omit<
	Tag,
	'id' | 'updated_at' | 'user_created_by' | 'user_updated_by'
> & {
	userCreatedByDocumentId: string | null;
	userUpdatedByDocumentId: string | null;
};
const createTag = async (tag: Strapi5Tag) => {
	const { userCreatedByDocumentId, userUpdatedByDocumentId, ...tagData } = tag;
	const { data } = await client.post<TagResponse>('/tags', {
		data: {
			...tagData,
			...(userCreatedByDocumentId && {
				user_created_by: {
					set: [userCreatedByDocumentId],
				},
			}),
			...(userUpdatedByDocumentId && {
				user_updated_by: {
					set: [userUpdatedByDocumentId],
				},
			}),
		},
	});

	return data.data;
};

const updateTag = async (documentId: string, newData: Strapi5Tag) => {
	const { userCreatedByDocumentId, userUpdatedByDocumentId, ...tagData } =
		newData;
	const { data } = await client.put<TagResponse>(`/tags/${documentId}`, {
		data: {
			...tagData,
			...(userCreatedByDocumentId && {
				user_created_by: {
					set: [userCreatedByDocumentId],
				},
			}),
			...(userUpdatedByDocumentId && {
				user_updated_by: {
					set: [userUpdatedByDocumentId],
				},
			}),
		},
	});
	return data.data;
};

const getTag = async (documentId: string, options?: { status?: Status }) => {
	const { data } = await client.get<TagResponse>(`/tags/${documentId}`, {
		params: options,
	});
	return data.data;
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
	getBelt,
	createBelt,
	updateBelt,
	createSalutation,
	updateSalutation,
	createProfile,
	updateProfile,
	getProfile,
	createSocmed,
	updateSocmed,
	getSocmed,
	createTag,
	updateTag,
	getTag,
};
