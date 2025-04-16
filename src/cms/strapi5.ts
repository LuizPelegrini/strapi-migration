import config from '@/config/index.ts';
import type { File } from '@/types.ts';
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
						connect: [primaryCategoryDocumentId],
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
const createFile = async (file: Strapi5File) => {
	const { data } = await client.post<FileResponse>('/upload/migration/create', {
		data: file,
	});

	// fields needed
	return {
		id: data.data.id,
		documentId: data.data.documentId,
	};
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
};
