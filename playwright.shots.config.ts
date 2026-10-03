import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Solo per le schermate delle presentazioni: non fa parte dei controlli automatici.
export default defineConfig({ ...base, testDir: "shots" });
