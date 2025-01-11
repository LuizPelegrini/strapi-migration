import type { Article, Category, PrimaryCategory, ShowCategory } from '@/types.ts';
import axios from 'axios';

const client = axios.create({
	baseURL: Deno.env.get('STRAPI_3_URL'),
	params: {
		token: Deno.env.get('STRAPI_3_TOKEN'),
	}
});

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getArticles = async () => {
	const { data } = await client.get<Article[]>('/articles');
	return data;
};

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getPrimaryCategories = async () => {
	const { data } = await client.get<PrimaryCategory[]>('/primary-categories/original');
	return data;
}

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getCategories = async () => {
	const { data } = await client.get<Category[]>('/categories');
	return data;
}

// TODO: If memory is a concern, consider reducing response size by selecting only the fields we need
const getShowCategories = async () => {
	const { data } = await client.get<ShowCategory[]>('/show-categories');
	return data;
}


export default {
	getArticles,
	getPrimaryCategories,
	getCategories,
	getShowCategories
}