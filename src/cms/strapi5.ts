import axios from 'axios';
import type { Category, PrimaryCategory } from "../types.ts";

const client = axios.create({
	baseURL: Deno.env.get('STRAPI_5_URL'),
	headers: {
		Authorization: `Bearer ${Deno.env.get('STRAPI_5_TOKEN')}`,
	},
});

type PrimaryCategoryResponse = {
  data: { documentId: string }
}
const createPrimaryCategory = async ({ name, description }: PrimaryCategory) => {
  const { data } = await client.post<PrimaryCategoryResponse>('/primary-categories', {
    data: {
      name,
      description,
    }
  });

  return data.data.documentId;
}

type CategoryResponse = {
  data: { documentId: string }
}
const createCategory = async ({ name, description }: Category, primaryCategoryDocumentId?: string) => {
  const { data } = await client.post<CategoryResponse>('/categories', {
    data: {
      name,
      description,
      ...(primaryCategoryDocumentId && { 
        primary_category: [primaryCategoryDocumentId] 
      }),
    }
  });

  return data.data.documentId;
}

export default {
  createPrimaryCategory,
  createCategory
}