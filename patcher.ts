import { statSync } from "https://deno.land/std@0.177.0/node/_fs/_fs_stat.ts";
import {
  basename,
  dirname,
  resolve,
} from "https://deno.land/std@0.177.0/path/mod.ts";

export async function patcher(files: ("MAIN-enUS" | "SUB-enUS")[]) {
  const execDir =
    basename(Deno.execPath()).startsWith("DEBUG-") &&
    basename(Deno.execPath()).endsWith(".exe")
      ? dirname(Deno.execPath())
      : Deno.cwd();

  const UNREAL_PACK_UTIL_PATH = resolve(execDir, "./UnrealPak.exe");
  const PT_UTIL_PATH = resolve(execDir, "./Parseltongue.exe");

  try {
    statSync(UNREAL_PACK_UTIL_PATH);
  } catch (e) {
    console.error(e);
    alert("Файл UnrealPak.exe не знайдено");
    Deno.exit(1);
  }

  try {
    statSync(PT_UTIL_PATH);
  } catch (e) {
    console.error(e);
    alert("Файл Parseltongue.exe не знайдено");
    Deno.exit(1);
  }

  const ORIGIN_PAK_PATH = Deno.args[0];

  if (!ORIGIN_PAK_PATH) {
    alert("*.pak файл для обробки не вказано");
    Deno.exit(1);
  }

  const PAK_CWD = dirname(ORIGIN_PAK_PATH);
  const PACK_NAME = basename(ORIGIN_PAK_PATH);

  const PACK_UNPACK_DIR = resolve(
    PAK_CWD,
    `${PACK_NAME.replace(".pak", "")}-unwraped/`
  );

  /**
   * extract pak file
   */
  await Deno.run({
    cwd: PAK_CWD,
    cmd: [UNREAL_PACK_UTIL_PATH, ORIGIN_PAK_PATH, `-extract`, PACK_UNPACK_DIR],
  }).status();

  const IN_PAK_PATH = "Phoenix/Content/Localization/WIN64";

  /**
   * Extract bin files
   */
  function parseltangue(filename: string) {
    return Deno.run({
      cwd: PAK_CWD,
      cmd: [PT_UTIL_PATH, resolve(PACK_UNPACK_DIR, IN_PAK_PATH, filename)],
    }).status();
  }

  for (const file of files) {
    await parseltangue(`${file}.bin`);
  }

  /**
   * Path json files
   */
  function patchJSON(filename: string) {
    const filePath = resolve(PACK_UNPACK_DIR, IN_PAK_PATH, filename);
    const originData: Record<string, string> = JSON.parse(
      Deno.readTextFileSync(filePath)
    );
    const patchedData: Record<string, string> = {};

    for (const key in originData) {
      // Ігнорувати іконки клавіш
      if (
        key.toLowerCase().startsWith("inputaction_") ||
        key.toLowerCase().startsWith("keyboard_")
      ) {
        patchedData[key] = originData[key];
        continue;
      }
      patchedData[key] = originData[key].includes(key)
        ? originData[key]
        : originData[key].trim().startsWith("[[")
        ? originData[key].replace("[[", `[[${key}: `).replace("]]", `]]${key}:`)
        : `${key}: ${originData[key]}`;
    }

    Deno.writeTextFileSync(filePath, JSON.stringify(patchedData));
  }

  for (const file of files) {
    await patchJSON(`${file}.json`);
  }

  /**
   * Pack json to bin files
   */
  for (const file of files) {
    await parseltangue(`${file}.json`);
  }

  /**
   * Create pak
   */

  const OUTPUT_PAK_PATH = resolve(
    PAK_CWD,
    PACK_NAME.replace(".pak", `--DEBUG--${files.join("-")}.pak`)
  );

  Deno.writeTextFileSync(
    resolve(PACK_UNPACK_DIR, "./.filelist.txt"),
    `"${resolve(PACK_UNPACK_DIR, "*.*")}" "..\\..\\..\\*.*"`
  );

  await Deno.run({
    cwd: PAK_CWD,
    cmd: [
      UNREAL_PACK_UTIL_PATH,
      OUTPUT_PAK_PATH,
      `-create="${resolve(PACK_UNPACK_DIR, "./.filelist.txt")}"`,
      "-compress",
    ],
  }).status();

  Deno.removeSync(PACK_UNPACK_DIR, {
    recursive: true,
  });

  // await Deno.run({
  //   cwd: PAK_CWD,
  //   cmd: [
  //     UNREAL_PACK_UTIL_PATH,
  //     OUTPUT_PAK_PATH,
  //     `-extract`,
  //     "C:\\Users\\kozac\\Dev\\pack-debugger\\test-unpack",
  //   ],
  // }).status();
}
