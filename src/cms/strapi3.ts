import type { Article, Category, PrimaryCategory } from '@/types.ts';
import axios from 'axios';

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
	const { data } = await client.get<PrimaryCategory[]>('/primary-categories/original');
	return data;
}

const getCategories = async () => {
	const { data } = await client.get<Category[]>('/categories');
	return data;
}


export default {
	getArticles,
	getPrimaryCategories,
	getCategories
}