import config from '@/config/index.ts';

type Registry = {
	id: number;
	documentId: string;
};

export class Tracker {
	private registries: Map<number, string>;
	private filename: string;

	constructor(pathname: string) {
		this.filename = `${pathname}/registry.${config.env}.json`;

		try {
			const json = Deno.readTextFileSync(this.filename);
			const data = JSON.parse(json) as Registry[];
			this.registries = new Map(
				data.map((registry) => [registry.id, registry.documentId]),
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
		this.registries.set(registry.id, registry.documentId);
	}

	getDocumentId(id: number) {
		return this.registries.get(id);
	}

	save() {
		const data = Array.from(this.registries, ([id, documentId]) => ({
			id,
			documentId,
		}));
		Deno.writeTextFileSync(this.filename, JSON.stringify(data, null, 2));
	}
}
