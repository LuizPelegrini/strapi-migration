import config from '@/config/index.ts';
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
					showCategory: {
						connect: [showCategoryDocumentId],
					},
				}),
			},
		},
	);

	return data.data.documentId;
};

export default {
	createPrimaryCategory,
	createCategory,
	createShowCategory,
	createShowSubCategory,
};
