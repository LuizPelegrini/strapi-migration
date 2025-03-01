import config from '@/config/index.ts';
import type {
	Category,
	PrimaryCategory,
	ShowCategory,
	ShowSubCategory,
} from '@/types.ts';
import axios from 'axios';

const client = axios.create({
	baseURL: config.strapi5.baseUrl,
	headers: {
		Authorization: `Bearer ${config.strapi5.token}`,
	},
});

type PrimaryCategoryResponse = {
	data: { documentId: string };
};
const createPrimaryCategory = async ({
	name,
	description,
}: PrimaryCategory) => {
	const { data } = await client.post<PrimaryCategoryResponse>(
		'/primary-categories',
		{
			data: {
				name,
				description,
			},
		},
	);

	return data.data.documentId;
};

type CategoryResponse = {
	data: { documentId: string };
};
const createCategory = async (
	{ name, description }: Category,
	primaryCategoryDocumentId?: string,
) => {
	const { data } = await client.post<CategoryResponse>('/categories', {
		data: {
			name,
			description,
			...(primaryCategoryDocumentId && {
				primary_category: {
					connect: [primaryCategoryDocumentId],
				},
			}),
		},
	});

	return data.data.documentId;
};

type ShowCategoryResponse = {
	data: { documentId: string };
};
const createShowCategory = async ({ name }: ShowCategory) => {
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
const createShowSubCategory = async (
	{ name }: ShowSubCategory,
	showCategoryDocumentId?: string,
) => {
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
