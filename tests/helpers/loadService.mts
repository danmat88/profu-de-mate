import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

/** Execute the real service with explicit native adapters; no source-pattern assertions. */
export function serviceLoader(mocks: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const cache = new Map<string, { exports: any }>();
  const nativeRequire = createRequire(import.meta.url);
  function load(path: string): any {
    const fullPath = resolve(path);
    if (cache.has(fullPath)) return cache.get(fullPath)!.exports;
    const module = { exports: {} as any };
    cache.set(fullPath, module);
    const code = ts.transpileModule(readFileSync(fullPath, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    runInNewContext(code, {
      module, exports: module.exports, console, Promise, Date, setTimeout, clearTimeout,
      __DEV__: false, process: { env: {} }, ...globals,
      require: (specifier: string) => {
        if (specifier in mocks) return mocks[specifier];
        if (specifier.startsWith('.')) {
          const base = resolve(dirname(fullPath), specifier);
          const target = [base, base + '.ts', base + '.tsx', resolve(base, 'index.ts'), base.replace(/\.js$/, '.ts')]
            .find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
          if (!target) throw new Error('Unresolved local dependency: ' + specifier);
          const mockKey = relative(process.cwd(), target).split(sep).join('/');
          if (mockKey in mocks) return mocks[mockKey];
          return load(target);
        }
        if (specifier.startsWith('node:')) return nativeRequire(specifier);
        throw new Error('Unmocked native dependency: ' + specifier);
      },
    }, { filename: fullPath });
    return module.exports;
  }
  return load;
}
