import config from '@/config/index.ts';
import type { AxiosError as _AxiosError } from 'axios';

/**
 * Manages graceful shutdown of batch processing
 */
class ShutdownController {
	private shouldShutdown = false;
	private shutdownPromiseResolve: (() => void) | null = null;
	private shutdownPromise: Promise<void> | null = null;

	requestShutdown() {
		if (!this.shouldShutdown) {
			this.shouldShutdown = true;
			// Create a promise that will be resolved when it's safe to exit
			this.shutdownPromise = new Promise<void>((resolve) => {
				this.shutdownPromiseResolve = resolve;
			});
		}
	}

	isShuttingDown(): boolean {
		return this.shouldShutdown;
	}

	// Call this when it's safe to exit (after current chunk completes)
	notifySafeToExit() {
		if (this.shutdownPromiseResolve) {
			this.shutdownPromiseResolve();
		}
	}

	// Wait for the shutdown to be safe
	async waitForSafeShutdown(): Promise<void> {
		if (this.shutdownPromise) {
			await this.shutdownPromise;
		}
	}
}

export const shutdownController = new ShutdownController();

type ProcessingResult<T> = {
	success: boolean;
	data?: T;
	error?: Error;
	item: unknown;
};

type BatchStats = {
	totalProcessed: number;
	successful: number;
	failed: number;
	failedItems: Array<{ item: unknown; error: Error }>;
	successfulItems: Array<{ item: unknown; data: unknown }>;
};

type ProcessBatchOptions<T, R> = {
	batchSize?: number;
	concurrency?: number;
	maxRetries?: number;
	batchDelayMs?: number;
	onProgress?: (stats: BatchStats) => void;
	onItemSuccess?: (item: T, data: R) => void;
};

/**
 * Processes items in batches with concurrent execution, retry logic, and error handling
 */
export async function processBatch<T, R>(
	items: T[],
	processor: (item: T) => Promise<R>,
	options: ProcessBatchOptions<T, R> = {},
): Promise<BatchStats> {
	const {
		batchSize = config.migration.batchSize,
		concurrency = config.migration.concurrency,
		maxRetries = config.migration.maxRetries,
		batchDelayMs = config.migration.batchDelayMs,
		onProgress,
		onItemSuccess,
	} = options;

	const stats: BatchStats = {
		totalProcessed: 0,
		successful: 0,
		failed: 0,
		failedItems: [],
		successfulItems: [],
	};

	// Split items into batches
	const batches: T[][] = [];
	for (let i = 0; i < items.length; i += batchSize) {
		batches.push(items.slice(i, i + batchSize));
	}

	console.log(
		`Processing ${items.length} items in ${batches.length} batches of ${batchSize} (concurrency: ${concurrency})`,
	);

	// Process each batch
	for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
		// Check for shutdown before starting new batch
		if (shutdownController.isShuttingDown()) {
			console.log('\n⚠️  Shutdown requested. Stopping batch processing...');
			break;
		}

		const batch = batches[batchIndex];
		console.log(
			`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} items)`,
		);

		// Process batch with concurrency control
		const batchResults = await processBatchWithConcurrency(
			batch,
			processor,
			concurrency,
			maxRetries,
			onItemSuccess,
		);

		// Update stats
		for (const result of batchResults) {
			stats.totalProcessed++;
			if (result.success) {
				stats.successful++;
				stats.successfulItems.push({
					item: result.item,
					data: result.data as unknown,
				});
			} else {
				stats.failed++;
				stats.failedItems.push({
					item: result.item,
					error: result.error as Error,
				});
			}
		}

		// Report progress
		const progressPercent = Math.round(
			(stats.totalProcessed / items.length) * 100,
		);
		console.log(
			`Progress: ${stats.totalProcessed}/${items.length} (${progressPercent}%) - ✅ ${stats.successful} successful, ❌ ${stats.failed} failed`,
		);

		if (onProgress) {
			onProgress(stats);
		}

		// Check for shutdown after batch completion
		if (shutdownController.isShuttingDown()) {
			console.log('\n⚠️  Shutdown requested. Stopping batch processing...');
			break;
		}

		// Delay between batches (except for the last one)
		if (batchIndex < batches.length - 1 && batchDelayMs > 0) {
			await sleep(batchDelayMs);
		}
	}

	// Notify that it's now safe to exit
	if (shutdownController.isShuttingDown()) {
		shutdownController.notifySafeToExit();
	}

	return stats;
}

/**
 * Processes a single batch with concurrency control
 */
async function processBatchWithConcurrency<T, R>(
	batch: T[],
	processor: (item: T) => Promise<R>,
	concurrency: number,
	maxRetries: number,
	onItemSuccess?: (item: T, data: R) => void,
): Promise<ProcessingResult<R>[]> {
	const results: ProcessingResult<R>[] = [];

	// Process items in chunks based on concurrency limit
	for (let i = 0; i < batch.length; i += concurrency) {
		const chunk = batch.slice(i, i + concurrency);

		const chunkPromises = chunk.map(async (item) => {
			try {
				const data = await processWithRetry(item, processor, maxRetries);

				// Call onItemSuccess immediately when API call succeeds
				if (onItemSuccess) {
					onItemSuccess(item, data);
				}

				return {
					success: true,
					data,
					item,
				} as ProcessingResult<R>;
			} catch (error) {
				return {
					success: false,
					error: error as Error,
					item,
				} as ProcessingResult<R>;
			}
		});

		const chunkResults = await Promise.allSettled(chunkPromises);

		// Extract results from Promise.allSettled
		for (const result of chunkResults) {
			if (result.status === 'fulfilled') {
				results.push(result.value);
			} else {
				// This shouldn't happen since we're using Promise.allSettled, but just in case
				console.error('Unexpected error in batch processing:', result.reason);
			}
		}

		// Break if shutdown was requested (after completing current chunk)
		if (shutdownController.isShuttingDown()) {
			console.log('✅ Current chunk completed. Stopping further processing...');
			break;
		}
	}

	return results;
}

/**
 * Processes a single item with retry logic
 */
async function processWithRetry<T, R>(
	item: T,
	processor: (item: T) => Promise<R>,
	maxRetries: number,
): Promise<R> {
	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await processor(item);
		} catch (error) {
			lastError = error as Error;

			// Don't retry on certain types of errors (client errors)
			if (!isRetryableError(error)) {
				throw error;
			}

			// If this was the last attempt, throw the error
			if (attempt === maxRetries) {
				throw error;
			}

			// Exponential backoff: 1s, 2s, 4s, etc.
			const delayMs = 2 ** attempt * 1000;
			console.log(
				`Retry attempt ${attempt}/${maxRetries} after ${delayMs}ms for item:`,
				item,
			);
			await sleep(delayMs);
		}
	}

	throw lastError || new Error('Unknown error occurred');
}

/**
 * Determines if an error should trigger a retry
 */
function isRetryableError(error: unknown): boolean {
	// Retry on network errors, timeouts, and server errors (5xx)
	if (error && typeof error === 'object' && 'code' in error) {
		const errorWithCode = error as { code: string };
		if (
			errorWithCode.code === 'ECONNRESET' ||
			errorWithCode.code === 'ETIMEDOUT'
		) {
			return true;
		}
	}

	// Retry on HTTP status codes that indicate temporary issues
	if (error && typeof error === 'object' && 'response' in error) {
		const errorWithResponse = error as { response?: { status?: number } };
		if (errorWithResponse.response?.status) {
			const status = errorWithResponse.response.status;
			// 429: Too Many Requests, 5xx: Server Errors
			return status === 429 || (status >= 500 && status < 600);
		}
	}

	// Don't retry on client errors (4xx except 429)
	return false;
}

/**
 * Utility function to sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a processor function that handles common Strapi API patterns
 */
export function createStrapiProcessor<T, R>(
	apiCall: (item: T) => Promise<R>,
	itemIdExtractor: (item: T) => string | number,
) {
	return async (item: T): Promise<R> => {
		try {
			return await apiCall(item);
		} catch (error) {
			// Add item context to error for better debugging
			const itemId = itemIdExtractor(item);
			const enhancedError = new Error(
				`Failed to process item ${itemId}: ${(error as Error).message}`,
			);
			enhancedError.cause = error;
			throw enhancedError;
		}
	};
}
