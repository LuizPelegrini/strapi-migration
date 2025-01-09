import axios from 'axios';
import type { Article, Category } from '../types.ts';

const client = axios.create({
	baseURL: Deno.env.get('STRAPI_3_URL'),
	params: {
		token: Deno.env.get('STRAPI_3_TOKEN'),
	}
});

const getArticles = async () => {
	const { data } = await client.get<Article[]>('/articles');
	return data;
};

const getPrimaryCategories = async () => {
	const { data } = await client.get<Category[]>('/primary-categories');
	return data;
}


export default {
	getArticles,
	getPrimaryCategories,
}