export default {
	env: Deno.env.get('ENV_NAME'),
	strapi3: {
		token: Deno.env.get('STRAPI_3_TOKEN'),
		baseUrl: Deno.env.get('STRAPI_3_URL'),
	},
	strapi5: {
		token: Deno.env.get('STRAPI_5_TOKEN'),
		baseUrl: Deno.env.get('STRAPI_5_URL'),
	},
	migration: {
		// Number of concurrent requests to process at once
		concurrency: Number(Deno.env.get('MIGRATION_CONCURRENCY')) || 50,
		// Number of items to process in each batch
		batchSize: Number(Deno.env.get('MIGRATION_BATCH_SIZE')) || 100,
		// Maximum number of retries for failed requests
		maxRetries: Number(Deno.env.get('MIGRATION_MAX_RETRIES')) || 3,
		// Delay between batches in milliseconds (to avoid rate limiting)
		batchDelayMs: Number(Deno.env.get('MIGRATION_BATCH_DELAY_MS')) || 200,
	},
};
