import config from '@/config/index.ts';

type Registry = {
	id: number;
	documentId: string;
	updated_at?: string;
	// biome-ignore lint/suspicious/noExplicitAny: file collection needs Strapi 5 id (not documentId) in order to be used when connecting to other collection
	[key: string]: any;
};

export class Tracker {
	private registries: Map<number, Registry>;
	private filename: string;
	private entity: string;

	constructor(entity: string) {
		this.entity = entity;
		this.filename = `${Deno.cwd()}/src/entities/${entity}/registry.${config.env}.json`;

		try {
			const json = Deno.readTextFileSync(this.filename);
			const data = JSON.parse(json) as Registry[];
			this.registries = new Map(
				data.map((registry) => [registry.id, registry]),
			);
		} catch (error) {
			if (!(error instanceof Deno.errors.NotFound)) {
				throw error;
			}

			this.registries = new Map();
			this.save();
		}
	}

	exists(id: number) {
		return this.registries.has(id);
	}

	register(registry: Registry) {
		this.registries.set(registry.id, registry);
	}

	getDocumentId(id: number) {
		return this.registries.get(id)?.documentId;
	}

	isStale(id: number, updated_at: string) {
		const registry = this.registries.get(id);
		if (!registry) {
			return false;
		}
		return registry.updated_at !== updated_at;
	}

	update(id: number, updated_at: string) {
		const registry = this.registries.get(id);

		if (!registry) {
			throw new Error(
				`Tracker update failed: ${this.entity} - ${id} not found`,
			);
		}

		this.registries.set(id, { ...registry, updated_at });
	}

	save() {
		// ignoring id from value
		const data = Array.from(this.registries, ([id, { id: _id, ...rest }]) => ({
			id,
			...rest,
		}));
		Deno.writeTextFileSync(this.filename, JSON.stringify(data, null, 2));
	}
}
