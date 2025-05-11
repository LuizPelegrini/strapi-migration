import config from '@/config/index.ts';
import type {
	Article,
	Category,
	File,
	PrimaryCategory,
	Show,
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
		'/primary-categories/migration',
	);
	return data;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getCategories = async () => {
	const { data } = await client.get<Category[]>('/categories/migration');
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

const getFiles = async () => {
	const { data } = await client.get<File[]>('/upload/files', {
		params: {
			_start: 0,
			// https://arc.net/l/quote/owqtkofw
			// Getting all files, we can paginate if needed, but I'm too lazy to do it now
			_limit: -1,
		},
	});
	return data;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getShows = async () => {
	const { data } = await client.get<Show[]>('/shows/migration', {
		params: {
			_start: 0,
			// https://arc.net/l/quote/owqtkofw
			// Getting all files, we can paginate if needed, but I'm too lazy to do it now
			_limit: -1,
		},
	});
	return data;
};

export default {
	getArticles,
	getPrimaryCategories,
	getCategories,
	getShowCategories,
	getShowCategoryByShowSubCategoryId,
	getShowSubCategories,
	getFiles,
	getShows,
};
