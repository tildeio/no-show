const shell = require('shelljs');
var path = require('path');

var homeDir = path.resolve(process.cwd());

shell.rm('-rf', 'dist');

tsc({ module: 'es2015',   target: 'esnext', declaration: true });
tsc({ module: 'amd',      target: 'es2015', lib: 'esnext', forof: true });
tsc({ module: 'commonjs', target: 'es2015', lib: 'esnext', forof: true });

shell.mkdir('-p', 'dist/commonjs/node_modules');
shell.ln('-s', `${homeDir}/dist/commonjs/src`, 'dist/commonjs/node_modules/no-show');

function tsc({ target, module, lib, forof, declaration, to }, command) {
  let options = ['-p .'];
  if (lib) options.push(`--lib ${lib}`);
  if (forof) options.push(`--downlevelIteration`);
  if (declaration) options.push(`--declaration --declarationDir dist/types`);

  options.push(`--target ${target}`, `--module ${module}`, `--outDir dist/${module}`);

  shell.exec(`tsc ${options.join(' ')}`, { async: false });
}
