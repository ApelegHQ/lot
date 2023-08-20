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
// import path from 'node:path';
import defaultAllowedGlobalProps from './defaultAllowedGlobalProps.config.mjs';

/**
 * @type {esbuild.Plugin}
 **/
const exactRealtyClosureBuilderPlugin = {
	name: '@exact-realty/closure-compiler',
	setup(build) {
		const origTarget = build.initialOptions.target;

		void origTarget;

		const origFmt = build.initialOptions.format;

		if (origFmt === 'esm') {
			// Google Closure Compiler doesn't support library exports it seems
			// So, set format to cjs
			build.initialOptions.format = 'cjs';
		}

		Object.assign(build.initialOptions, {
			target: origFmt === 'iife' ? 'es2015' : 'es2020',
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
							compilation_level: 'ADVANCED',
							language_in: 'ECMASCRIPT_2020',
							language_out: 'ECMASCRIPT_2015',
							rewrite_polyfills: false,
							process_closure_primitives: false,
							apply_input_source_maps: false,
							warning_level: 'QUIET',
							isolate_polyfills: true,
							externs: './closure-externs.js',
							assume_function_wrapper: origFmt !== 'iife',
							...(origFmt === 'esm' && {
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
	external: ['esbuild'],
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
		// Enums
		'EMessageTypes.SANDBOX_READY': EMessageTypesSequence.next(),
		'EMessageTypes.REQUEST': EMessageTypesSequence.next(),
		'EMessageTypes.DESTROY': EMessageTypesSequence.next(),
		'EMessageTypes.RESULT': EMessageTypesSequence.next(),
		'EMessageTypes.ERROR': EMessageTypesSequence.next(),
		'EMessageTypes.GLOBAL_ERROR': EMessageTypesSequence.next(),
	},
};

void exactRealtyClosureBuilderPlugin;

// TODO: Use Google Closure Compiler globally
const plugins = [];

plugins.push(
	inlineScripts({
		...options,
		target: 'es2015',
		format: 'iife',
		plugins: plugins,
	}),
);

options.plugins = plugins;

const esmOpts = {
	format: 'esm',
	outExtension: {
		'.js': '.mjs',
	},
};

await Promise.all(
	[
		{
			format: 'cjs',
		},
		esmOpts,
	].map((extra) =>
		esbuild.build({
			...options,
			...extra,
			entryPoints: ['./src/index.ts'],
			outdir: 'dist',
		}),
	),
);

await Promise.all(
	[
		{
			format: 'cjs',
			outExtension: {
				'.js': '.cjs',
			},
		},
		esmOpts,
	].map((extra) =>
		esbuild.build({
			...options,
			...extra,
			entryPoints: ['./src/exports/nodejs.ts'],
			outdir: 'dist/exports',
		}),
	),
);

plugins.unshift(exactRealtyClosureBuilderPlugin);

const umdOpts = {
	format: 'iife',
	globalName: '__export__',
	banner: {
		js: `(function(){(function (global, factory) {
			if (typeof define === 'function' && define['amd']) {
				define(factory);
			} else if (typeof module === 'object' && typeof exports !== 'undefined' && module['exports'] === exports) {
				module['exports'] = factory();
			} else {
				var mod = Object.create(null, {
					['exports']: {
						['configurable']: true,
						['enumerable']: true,
						['writable']: true,
						['value']: factory(),
					}
				});
				global['index'] = mod.exports;
			}
		})(
			typeof globalThis !== 'undefined'
				? globalThis
				: typeof self !== 'undefined'
				? self
				: this,
			function () {`,
	},
	footer: {
		js: ';return __export__;});})();',
	},
};

options.define['__buildtimeSettings__.isolationStategyIframeSole'] = 'true';
options.define['__buildtimeSettings__.isolationStategyIframeWorker'] = 'true';

/**
 * @param {string[]} entryPoints
 * @returns {Promise<void>}
 */
const browserBuild = (entryPoints) =>
	Promise.all(
		[
			{
				format: 'cjs',
				outExtension: {
					'.js': '.cjs',
				},
			},
			esmOpts,
			umdOpts,
		].map((extra) =>
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
