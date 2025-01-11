type Registry = {
  id: number;
  documentId: string;
}

export class Tracker {
  private registries: Map<number, string>;

  constructor(private filename: string) {
    const json = Deno.readTextFileSync(this.filename);
    const data = JSON.parse(json) as Registry[];
    this.registries = new Map(data.map((registry) => [registry.id, registry.documentId]));
  }
  
  exists(id: number){
    return this.registries.has(id);
  }
  
  register(registry: Registry){
    this.registries.set(registry.id, registry.documentId);
  }

  getDocumentId(id: number) {
    return this.registries.get(id);
  }
  
  save() {
    const data = Array.from(this.registries, ([id, documentId]) => ({ id, documentId }));
    Deno.writeTextFileSync(this.filename, JSON.stringify(data, null, 2));
  }
}