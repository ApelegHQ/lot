#!/usr/bin/env node

/* Copyright © 2023 Apeleg Limited.
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

import cc from '@apeleghq/esbuild-plugin-closure-compiler';
import inlineScripts from '@apeleghq/esbuild-plugin-inline-js';
import esbuild from 'esbuild';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import defaultAllowedGlobalProps from './defaultAllowedGlobalProps.config.mjs';

/**
 * @type {esbuild.Plugin}
 **/
const lotExportsBuilderPlugin = {
	name: '@apeleghq/lot/exports',
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

const plugins = [];

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
	'/** @copyright Copyright (C) 2023 Apeleg Limited. All rights reserved. */';

const esmOpts = {
	format: 'esm',
	banner: {
		js: notice,
	},
	outExtension: {
		'.js': '.mjs',
	},
};

const cjsOpts = {
	format: 'cjs',
	banner: {
		js: notice + `(function(require){`,
	},
	// This function is used to load the necessary file and execute it.
	// It checks if the file is an ES module and returns its default export or
	// the named export accordingly.
	// This is to avoid weird `.default` exports, as the current implementation
	// does not properly handle non-default exports. However, non-default
	// exports are not currently in use, so this issue is not a concern.
	footer: {
		js:
			'})(function(path){' +
			'var m=require(path);' +
			'if(Object.prototype.hasOwnProperty.call(m,"__esModule")&&m.__esModule&&Object.prototype.hasOwnProperty.call(m,"default"))' +
			'return m.default;' +
			'return m;' +
			'});',
	},
	outExtension: {
		'.js': '.cjs',
	},
};

const umdOpts = {
	format: 'cjs',
	// globalName: '__export__',
	banner: {
		js: notice,
	},
	outExtension: {
		'.js': '.cjs',
	},
};

await Promise.all(
	[cjsOpts, esmOpts].map((extra) =>
		esbuild.build({
			...options,
			...extra,
			entryPoints: ['./src/index.ts'],
			outdir: 'dist',
		}),
	),
);

plugins.unshift(
	cc({
		compilation_level: 'ADVANCED',
		language_in: 'ECMASCRIPT_2020',
		language_out: 'ECMASCRIPT_2015',
		rewrite_polyfills: false,
		process_closure_primitives: false,
		apply_input_source_maps: false,
		env: 'BROWSER',
		externs: './closure-externs.js',
	}),
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

const cjsDeclarationFiles = async (directoryPath) => {
	const entries = await readdir(directoryPath, {
		withFileTypes: true,
		recursive: true,
	});

	await Promise.all(
		entries
			.filter((entry) => {
				return entry.isFile() && entry.name.endsWith('.d.ts');
			})
			.map(async (file) => {
				const name = join(file.path, file.name);
				const newName = name.slice(0, -2) + 'cts';

				const contents = await readFile(name, { encoding: 'utf-8' });
				await writeFile(
					newName,
					contents.replace(/(?<=\.)js(?=['"])/g, 'cjs'),
				);
			}),
	);
};

await cjsDeclarationFiles('dist');
