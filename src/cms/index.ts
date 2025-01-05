import axios from 'axios';
import type { Article } from '../types.ts';

const client = axios.create({
	baseURL: Deno.env.get('STRAPI_3_URL'),
	headers: {
		Authorization: `Bearer ${Deno.env.get('STRAPI_3_TOKEN')}`,
	},
});

const getArticles = async () => {
	const { data } = await client.get<Article[]>('/articles');
	return data;
};


export default {
	getArticles,
}