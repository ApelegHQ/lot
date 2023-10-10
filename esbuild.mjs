#!/usr/bin/env node

/* Copyright © 2021 Exact Realty Limited.
 *
 * Permission to use, copy, modify, and distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */

import inlineScripts from '@exact-realty/esbuild-plugin-inline-js';
import esbuild from 'esbuild';
import googleClosureCompiler from 'google-closure-compiler';
import fs from 'node:fs/promises';
import defaultAllowedGlobalProps from './defaultAllowedGlobalProps.config.mjs';
import manifest from './package.json' assert { type: 'json' };

let closureCompilationLevel = 'WHITESPACE_ONLY';

/**
 * @type {esbuild.Plugin}
 **/
const exactRealtyClosureBuilderPlugin = {
	name: '@exact-realty/closure-compiler',
	setup(build) {
		const origTarget = build.initialOptions.target;

		void origTarget;

		const origFmt = build.initialOptions.format;

		if (origFmt === 'esm' && closureCompilationLevel === 'ADVANCED') {
			// Google Closure Compiler doesn't support library exports it seems
			// So, set format to cjs
			build.initialOptions.format = 'cjs';
		}

		Object.assign(build.initialOptions, {
			target: origFmt === 'esm' ? 'es2020' : 'es2015',
			write: false,
		});

		build.onEnd(async (result) => {
			if (!result.outputFiles) return;

			const outputFiles = await Promise.all(
				result.outputFiles.map((o) => {
					if (
						o.path.endsWith('.js') ||
						o.path.endsWith('.cjs') ||
						o.path.endsWith('.mjs')
					) {
						const compiler = new googleClosureCompiler.compiler({
							js_output_file: o.path,
							compilation_level: closureCompilationLevel,
							language_in: 'ECMASCRIPT_2020',
							language_out: 'ECMASCRIPT_2015',
							rewrite_polyfills: false,
							process_closure_primitives: false,
							apply_input_source_maps: false,
							warning_level: 'QUIET',
							isolate_polyfills: true,
							externs: './closure-externs.js',
							assume_function_wrapper: origFmt === 'esm',
							...(origFmt === 'esm' &&
								closureCompilationLevel === 'ADVANCED' && {
									output_wrapper:
										'var module={};%output%export default module.exports.default;',
								}),
							// chunk_output_type: 'GLOBAL_NAMESPACE',
							/* chunk_output_type:
								build.initialOptions.format === 'esm'
									? 'ES_MODULES'
									: 'GLOBAL_NAMESPACE', */
							env: 'BROWSER',
							// process_common_js_modules: true, // TODO
							// module_resolution: 'NODE', // TODO
						});
						return new Promise((resolve, reject) => {
							const process = compiler.run(
								(exitCode, _stdout, stderr) => {
									if (exitCode === 0) {
										// TODO: Warnings
										resolve(
											fs
												.readFile(o.path)
												.then((contents) => ({
													path: o.path,
													contents: contents,
													text: contents.toString(),
													_written: true,
												})),
										);
									} else {
										return reject(stderr);
									}
								},
							);

							process.stdin.write(o.text);
							process.stdin.end();
						});
					}

					return o;
				}),
			);

			/* if (outputFiles.length) {
				await Promise.all(
					Array.from(
						new Set(
							outputFiles
								.filter((o) => !o._written)
								.map((file) => path.dirname(file.path)),
						),
					).map((dir) => fs.mkdir(dir, { recursive: true })),
				);

				await Promise.all(
					outputFiles
						.filter((o) => !o._written)
						.map((file) => fs.writeFile(file.path, file.contents)),
				);
			} */

			result.outputFiles = outputFiles;
		});
	},
};

/**
 * @type {esbuild.Plugin}
 **/
const lotExportsBuilderPlugin = {
	name: '@exact-realty/lot/exports',
	setup(build) {
		const extension = (() => {
			switch (build.initialOptions.format) {
				case 'cjs':
					return 'cjs';
				case 'esm':
					return 'mjs';
				case 'iife':
					return 'js';
			}
		})();
		build.onResolve(
			{ filter: /^@exports\//, namespace: 'file' },
			(args) => {
				const path = `./${args.path
					.slice(1)
					.replace(/(?<=\.)js$/, extension)}`;
				return {
					path,
					external: true,
				};
			},
		);
	},
};

const sequence = () => {
	const generator = (function* () {
		yield String(17);
		for (let i = 119; i !== 17; i = (29 * i + 7) % 127) {
			yield String(i);
		}
		throw new Error('Sequence depleted');
	})();

	return { next: () => generator.next().value };
};

const EMessageTypesSequence = sequence();

const options = {
	target: 'es2015',
	bundle: true,
	minify: true,
	entryNames: '[name]',
	platform: 'node',
	pure: ['Logger'],
	define: {
		'__buildtimeSettings__.buildTarget': '"generic"',
		'__buildtimeSettings__.buildType':
			process.env['BUILD_TYPE'] === 'release' ? '"release"' : '"debug"',
		...(process.env['BUILD_TYPE'] === 'release' && {
			'Logger.trace': 'Boolean',
			'Logger.debug': 'Boolean',
			'Logger.info': 'Boolean',
		}),
		// Build options
		'__buildtimeSettings__.defaultAllowedGlobalProps': JSON.stringify(
			defaultAllowedGlobalProps,
		),
		'__buildtimeSettings__.sandboxContainmentProbe': 'false',
		'__buildtimeSettings__.fixGlobalTypes': 'true',
		'__buildtimeSettings__.bidirectionalMessaging': 'true',
		'__buildtimeSettings__.scopedTimerFunctions': 'true',
		'__buildtimeSettings__.sandboxInitDeadlineInMs': '4000',
		'__buildtimeSettings__.innerSandboxInitDeadlineInMs': '1500',
		'__buildtimeSettings__.emulatedGlobalContext': 'true',
		'__buildtimeSettings__.hardenGlobals': 'true',
		'__buildtimeSettings__.censorUnsafeExpressions': 'true',
		'__buildtimeSettings__.isolationStategyIframeSole': 'true',
		'__buildtimeSettings__.isolationStategyIframeWorker': 'true',
		'__buildtimeSettings__.contextifyMessagePort': 'true',
		'__buildtimeSettings__.contextifyMessagePortWorkaroundCrash': 'true',
		'__buildtimeSettings__.featureDetectFunctionConstructors': 'true',
		// Enums
		'EMessageTypes.SANDBOX_READY': EMessageTypesSequence.next(),
		'EMessageTypes.REQUEST': EMessageTypesSequence.next(),
		'EMessageTypes.DESTROY': EMessageTypesSequence.next(),
		'EMessageTypes.RESULT': EMessageTypesSequence.next(),
		'EMessageTypes.ERROR': EMessageTypesSequence.next(),
		'EMessageTypes.GLOBAL_ERROR': EMessageTypesSequence.next(),
	},
};

// TODO: Use Google Closure Compiler globally
const plugins = [];

const whitespace = /[ \r\n\t]/g;

/**
 * Simple JS minification
 * @param {string[]} parts
 * @param  {...unknown} args
 * @returns {string}
 */
const minify = (parts, ...args) => {
	const dict = Object.create(null);
	const v = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
	let c = 0;
	return parts
		.map((p, i) => {
			let e = '';
			if (i < args.length) {
				const arg = args[i];
				if (dict[arg]) {
					e = dict[arg];
				} else {
					dict[arg] = e = v[c++];
				}
			}
			return (
				p
					.replace(whitespace, ' ')
					.replace(/[ ]+/g, ' ')
					.replace(/([{(=?:",;&|+!)}])[ ]+/g, '$1')
					.replace(/[ ]+([{(=?:",;&|+!)}])/g, '$1')
					.replace(/[;,]\}/g, '}') + e
			);
		})
		.join('');
};

plugins.push(
	lotExportsBuilderPlugin,
	inlineScripts({
		...options,
		target: 'es2015',
		format: 'iife',
		plugins: plugins,
	}),
);

options.plugins = plugins;

const notice =
	'/** @copyright Copyright (C) 2023 Exact Realty Limited. All rights reserved. */';

const esmOpts = {
	format: 'esm',
	banner: {
		js: notice,
	},
	outExtension: {
		'.js': '.mjs',
	},
};

const umdOpts = {
	format: 'cjs',
	// globalName: '__export__',
	banner: {
		js:
			notice +
			minify`
		(function(${'fallbackPkgName'}){(function (${'global'}, ${'factory'}) {
			if (typeof define === "function" && define["amd"]) {
				define(["require", "exports", "module"], ${'factory'});
			} else {
				var ${'cjsMod'} = (typeof module === "object" && typeof module["exports"] === "object") && module;
				var ${'req'} = (typeof require === "function")
					? require
					: function(n) {throw Error("Cannot find module '" + n + "'");};
				var ${'mod'} = ${'cjsMod'} || Object.create(null, {
					"exports": {
						["configurable"]: true,
						["enumerable"]: true,
						["writable"]: true,
						["value"]: Object.create(null),
					},
				});

				var ${'result'} = ${'factory'}(${'req'}, ${'mod'}["exports"], ${'mod'});

				if (typeof ${'result'} !== "undefined") {
					${'mod'}["exports"] = ${'result'};
				}

				if (!${'cjsMod'}) {
					${'global'}[${'fallbackPkgName'}] = ${'mod'}["exports"];
				}
			}
		})(this, function (require, exports, module) {`,
	},
	footer: {
		js: `});}).call(
			typeof globalThis === "object"
			? globalThis
			: typeof self === "object"
			? self
			: typeof global === "object"
			? global
			: this,
			${JSON.stringify(manifest.name)}
		);`
			.replace(/[\r\n\t ]+/g, ' ')
			.replace(/([{(=?:",;&|+!)}])[ ]+/g, '$1')
			.replace(/[ ]+([{(=?:",;&|+!)}])/g, '$1'),
	},
	outExtension: {
		'.js': '.cjs',
	},
};

await Promise.all(
	[umdOpts, esmOpts].map((extra) =>
		esbuild.build({
			...options,
			...extra,
			entryPoints: ['./src/index.ts'],
			outdir: 'dist',
		}),
	),
);

await Promise.all(
	[umdOpts, esmOpts].map((extra) =>
		esbuild.build({
			...options,
			...extra,
			entryPoints: ['./src/exports/nodejs.ts'],
			outdir: 'dist/exports',
		}),
	),
);

plugins.unshift(exactRealtyClosureBuilderPlugin);
closureCompilationLevel = 'ADVANCED';

options.define['__buildtimeSettings__.isolationStategyIframeSole'] = 'true';
options.define['__buildtimeSettings__.isolationStategyIframeWorker'] = 'true';

/**
 * @param {string[]} entryPoints
 * @returns {Promise<void>}
 */
const browserBuild = (entryPoints) =>
	Promise.all(
		[esmOpts, umdOpts].map((extra) =>
			esbuild.build({
				...options,
				...extra,
				entryPoints,
				outdir: 'dist/exports',
			}),
		),
	);

await browserBuild([
	'./src/exports/bare.ts',
	'./src/exports/browser.ts',
	'./src/exports/worker.ts',
]);

options.define['__buildtimeSettings__.isolationStategyIframeSole'] = 'false';
options.define['__buildtimeSettings__.isolationStategyIframeWorker'] = 'true';

await browserBuild(['./src/exports/browser-worker.ts']);

options.define['__buildtimeSettings__.isolationStategyIframeSole'] = 'true';
options.define['__buildtimeSettings__.isolationStategyIframeWorker'] = 'false';

await browserBuild(['./src/exports/browser-window.ts']);
