import config from '@/config/index.ts';
import type {
	Article,
	Category,
	PrimaryCategory,
	ShowCategory,
} from '@/types.ts';
import axios from 'axios';

const client = axios.create({
	baseURL: config.strapi3.baseUrl,
	params: {
		token: config.strapi3.token,
	},
});

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getArticles = async () => {
	const { data } = await client.get<Article[]>('/articles');
	return data;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getPrimaryCategories = async () => {
	const { data } = await client.get<PrimaryCategory[]>(
		'/primary-categories/original',
	);
	return data;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getCategories = async () => {
	const { data } = await client.get<Category[]>('/categories');
	return data;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getShowCategories = async () => {
	const { data } = await client.get<ShowCategory[]>('/show-categories');
	return data;
};

const getShowCategoryByShowSubCategoryId = async (
	showSubCategoryId: number,
) => {
	const { data } = await client.get<ShowCategory[]>('/show-categories', {
		params: {
			_where: {
				'subcategories.id': showSubCategoryId,
			},
		},
	});

	// we might not find a show category for a given show subcategory
	return data[0] ? data[0] : null;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getShowSubCategories = async () => {
	const { data } = await client.get<ShowCategory[]>('/show-subcategories');
	return data;
};

export default {
	getArticles,
	getPrimaryCategories,
	getCategories,
	getShowCategories,
	getShowCategoryByShowSubCategoryId,
	getShowSubCategories,
};
