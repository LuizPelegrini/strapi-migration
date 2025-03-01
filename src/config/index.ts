export default {
	env: Deno.env.get('ENV_NAME'),
	strapi3: {
		token: Deno.env.get('STRAPI_3_TOKEN'),
		baseUrl: Deno.env.get('STRAPI_3_BASE_URL'),
	},
	strapi5: {
		token: Deno.env.get('STRAPI_5_TOKEN'),
		baseUrl: Deno.env.get('STRAPI_5_BASE_URL'),
	},
};
