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

		Object.assign(build.initialOptions, {
			target: 'es2020',
			write: false,
		});

		build.onEnd(async (result) => {
			if (!result.outputFiles) return;

			const outputFiles = await Promise.all(
				result.outputFiles.map((o) => {
					if (o.path.endsWith('.js') || o.path.endsWith('.mjs')) {
						const compiler = new googleClosureCompiler.compiler({
							js_output_file: o.path,
							compilation_level: 'ADVANCED',
							language_in: 'ECMASCRIPT_2020',
							language_out: 'ECMASCRIPT_2020',
							rewrite_polyfills: false,
							process_closure_primitives: false,
							apply_input_source_maps: false,
							warning_level: 'QUIET',
							chunk_output_type:
								build.initialOptions.format === 'esm'
									? 'ES_MODULES'
									: 'GLOBAL_NAMESPACE',
							env: 'BROWSER',
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
		'__buildtimeSettings__.fixGlobalTypes': 'true',
		'__buildtimeSettings__.dynamicCodeGeneration': 'true',
		'__buildtimeSettings__.bidirectionalMessaging': 'true',
		'__buildtimeSettings__.sandboxInitDeadlineInMs': '4000',
		'__buildtimeSettings__.innerSandboxInitDeadlineInMs': '1500',
		'__buildtimeSettings__.enhancedWrapper': 'true',
		'__buildtimeSettings__.emulatedGlobalContext': 'true',
		'__buildtimeSettings__.hardenGlobals': 'true',
		'__buildtimeSettings__.censorUnsafeExpressions': 'true',
		'__buildtimeSettings__.isolationStategyIframeSole': 'true',
		'__buildtimeSettings__.isolationStategyIframeWorker': 'true',
	},
};

void exactRealtyClosureBuilderPlugin;

// TODO: Use Google Closure Compiler
const plugins = isNaN(0) ? [exactRealtyClosureBuilderPlugin] : [];

plugins.push(
	inlineScripts({
		...options,
		target: 'es2015',
		format: 'iife',
		plugins: plugins,
	}),
);

options.plugins = plugins;

await Promise.all(
	[
		{
			format: 'cjs',
		},
		{
			format: 'esm',
			outExtension: {
				'.js': '.mjs',
			},
		},
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
		},
		{
			format: 'esm',
			outExtension: {
				'.js': '.mjs',
			},
		},
	].map((extra) =>
		esbuild.build({
			...options,
			...extra,
			entryPoints: [
				'./src/exports/browser.ts',
				'./src/exports/nodejs.ts',
				'./src/exports/worker.ts',
			],
			outdir: 'dist/exports',
		}),
	),
);
