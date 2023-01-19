import { writeFile } from "fs/promises";
import produce from "immer";
import minimist from "minimist";
import { chromium } from "playwright";

import type { ICategory, ISubCategory } from "types";
import { getCategories } from "./get_categories.js";
import { getParts } from "./get_parts.js";
import { getSubCategories } from "./get_subcategories.js";
import { getVehicle } from "./get_vehicle.js";

export interface IArgs {
  headless?: string;
  vin?: string;
}

export const baseUrl = "https://toyodiy.com";
// export const vin = "TRJ120W-GGPEK";
const main = async () => {
  const { headless, vin } = minimist(process.argv.slice(2)) as IArgs;
  if (typeof vin !== "string") {
    throw Error("NO VIN");
  }

  const browser = await chromium.launch({ headless: !(headless === "false") });
  const page = await browser.newPage();

  let data: Record<string, ICategory<Record<string, ISubCategory>>> = {};

  try {
    const vehicle = await getVehicle(page, vin);

    const categories = await getCategories(page, vehicle);
    for (const category of categories) {
      data = produce(data, (draft) => {
        draft[category.name] = {
          href: category.href,
          name: category.name,
          children: {},
        };
      });

      const subCategories = await getSubCategories(page, category.href);
      for (const subCategory of subCategories) {
        data = produce(data, (draft) => {
          draft[category.name].children[subCategory.name] = {
            href: subCategory.href,
            name: subCategory.name,
            children: [],
          };
        });

        console.log(
          `CATEGORY: ${
            categories.map(({ name }) => name).indexOf(category.name) + 1
          }/${categories.length} SUBCATEGORY: ${
            subCategories.map(({ name }) => name).indexOf(subCategory.name) + 1
          }/${subCategories.length}`
        );
        const parts = await getParts(page, subCategory.href);

        data = produce(data, (draft) => {
          draft[category.name].children[subCategory.name].children = parts;
        });

        await page.waitForTimeout(1000);
      }
    }
  } catch (error) {
    throw error;
  } finally {
    const now = new Date();
    const date = `${now.getFullYear()}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}T${now
      .getHours()
      .toString()
      .padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now
      .getSeconds()
      .toString()
      .padStart(2, "0")}`;
    await writeFile(`./${vin}#${date}.json`, JSON.stringify(data));
    await browser.close();
  }
};

main().catch((error) => {
  const _error = error as Error;
  console.log(_error.message);
});
