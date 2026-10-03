#!/usr/bin/env node
// Alias du générateur existant : node scripts/generate-content.mjs renovation src/data/cities-92.json
import { main } from "./generate-city-content.mjs";
main().catch((error) => { console.error(`Génération interrompue : ${error.message}`); process.exitCode = 1; });
