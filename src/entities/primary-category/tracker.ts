type Registry = {
  id: number;
  documentId: string;
}

const registries: Registry[] = [];
const FILENAME = `${Deno.cwd()}/src/entities/primary-category/registry.json`;

const preload = () => {
  const json = Deno.readTextFileSync(FILENAME);
  const data = JSON.parse(json);
  registries.push(...data);
}

const exists = (id: number) => {
  return !!registries.find((registry) => registry.id === id);
}

const register = (registry: Registry) => {
  registries.push(registry);
}

const save = () => {
  // save registries into a file
  const json = JSON.stringify(registries, null, 2);
  Deno.writeTextFileSync(FILENAME, json);
}

export default {
  preload,
  register,
  exists,
  save,
}