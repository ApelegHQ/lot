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

import esbuild from 'esbuild';
import inlineScripts from '@exact-realty/esbuild-plugin-inline-js';

await esbuild.build({
	entryPoints: ['./src/index.ts'],
	outdir: 'dist',
	bundle: true,
	minify: true,
	format: 'cjs',
	entryNames: '[name]',
	platform: 'node',
	external: ['esbuild'],
	plugins: [
		inlineScripts({
			target: 'es2015',
			plugins: [
				inlineScripts({
					target: 'es2015',
					plugins: [inlineScripts({ target: 'es2015' })],
				}),
			],
		}),
	],
});

await esbuild.build({
	entryPoints: ['./src/index.ts'],
	outdir: 'dist',
	bundle: true,
	minify: true,
	format: 'esm',
	entryNames: '[name]',
	platform: 'node',
	external: ['esbuild'],
	plugins: [
		inlineScripts({
			target: 'es2015',
			plugins: [
				inlineScripts({
					target: 'es2015',
					plugins: [inlineScripts({ target: 'es2015' })],
				}),
			],
		}),
	],
	outExtension: {
		'.js': '.mjs',
	},
});
