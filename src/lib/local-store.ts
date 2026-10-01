import { mkdir, readFile, rename, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { LocalLead, LocalPartner } from "../types/local-lead";

type Store = { leads: LocalLead[]; partners: LocalPartner[] };
const state = globalThis as typeof globalThis & { localStoreQueue?: Promise<unknown> };
const directory = path.join(process.cwd(), "src/data");

export class LocalStoreError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(path.join(directory, name), "utf8")); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(name: string, value: unknown) {
  await mkdir(directory, { recursive: true });
  const destination = path.join(directory, name);
  await writeFile(`${destination}.tmp`, JSON.stringify(value, null, 2), "utf8");
  await rename(`${destination}.tmp`, destination);
}

async function apply(store: Store) {
  await writeJson("leads-local.json", store.leads);
  await writeJson("partners-local.json", store.partners);
  await unlink(path.join(directory, "local-store-journal.json"));
}

/** File commune à toutes les opérations du serveur local (un processus Next). */
export function withLocalStore<T>(operation: (store: Store) => T, write = false): Promise<T> {
  const result = (state.localStoreQueue ?? Promise.resolve()).then(async () => {
    // Rejoue une écriture interrompue entre les deux fichiers avant toute lecture.
    const journal = await readJson<Store | null>("local-store-journal.json", null);
    if (journal) await apply(journal);
    const store: Store = {
      leads: await readJson<LocalLead[]>("leads-local.json", []),
      partners: await readJson<LocalPartner[]>("partners-local.json", []),
    };
    if (!Array.isArray(store.leads) || !Array.isArray(store.partners)) throw new Error("Invalid local store");
    const value = operation(store);
    if (write) {
      await writeJson("local-store-journal.json", store);
      await apply(store);
    }
    return value;
  });
  state.localStoreQueue = result.catch(() => undefined);
  return result;
}

export function localResponse(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function localError(error: unknown) {
  return localResponse({ error: error instanceof LocalStoreError ? error.message : "Le stockage local est indisponible. Réessayez." }, error instanceof LocalStoreError ? error.status : 500);
}
