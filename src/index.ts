/**
 * This file contains a Rollup loader for Linaria.
 * It uses the transform.ts function to generate class names from source code,
 * returns transformed code without template literals and attaches generated source maps
 */

import { createFilter } from "@rollup/pluginutils";
import { transform, slugify } from "@linaria/babel-preset";
import fs from "fs";
import path from "path";
import type { PluginOptions, Preprocessor } from "@linaria/babel-preset";
import { Plugin } from 'vite';

type RollupPluginOptions = {
  include?: string | string[];
  exclude?: string | string[];
  sourceMap?: boolean;
  preprocessor?: Preprocessor;
} & Partial<PluginOptions>;

export default function linaria({
  include,
  exclude,
  sourceMap,
  preprocessor,
  ...rest
}: RollupPluginOptions = {}): Plugin {
  const filter = createFilter(include, exclude);
  const cssLookup: { [key: string]: string } = {};

  return {
    name: "linaria",
    load(id: string) {
      return cssLookup[id];
    },
    /* eslint-disable-next-line consistent-return */
    resolveId(importee: string) {
      if (importee in cssLookup) return importee;
    },
    // @ts-ignore
    transform(code: string, id: string) {
      // Do not transform ignored and generated files
      if (!filter(id) || id in cssLookup) return;

      const result = transform(code, {
        filename: id,
        preprocessor,
        pluginOptions: rest,
      });

      if (!result.cssText) return;

      let { cssText } = result;

      const slug = slugify(cssText);

      console.log(path.basename(id));

      const basename = path.basename(id);
      const filename = path.join(
        __dirname,
        `./src/.linaria_cache/${basename.replace(
          /(\.js|\.jsx|\.tsx|\.ts)$/,
          ""
        )}_${slug}.css`
      );

      if (sourceMap && result.cssSourceMapText) {
        const map = Buffer.from(result.cssSourceMapText).toString("base64");
        cssText += `/*# sourceMappingURL=data:application/json;base64,${map}*/`;
      }

      cssLookup[filename] = cssText;

      result.code += `\nimport ${JSON.stringify(filename)};\n`;

      writeFileRecursive(filename, cssText);

      /* eslint-disable-next-line consistent-return */
      return { code: result.code, map: result.sourceMap };
    },
    closeBundle() {
      deleteAll("./src/.linaria_cache");
    },
  };
}

const writeFileRecursive = function (
  path: string,
  buffer: string | NodeJS.ArrayBufferView
) {
  let lastPath = path.substring(0, path.lastIndexOf("/"));
  fs.mkdirSync(lastPath, { recursive: true });
  fs.writeFileSync(path, buffer);
};

function deleteAll(path: string) {
  var files = [];
  if (fs.existsSync(path)) {
    files = fs.readdirSync(path);
    files.forEach(function (file) {
      var curPath = path + "/" + file;
      if (fs.statSync(curPath).isDirectory()) {
        // recurse
        deleteAll(curPath);
      } else {
        // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
}
