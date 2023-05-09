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

const defaultAllowedGlobalProps = [
	'Object',
	'Function',
	'Array',
	'Number',
	'parseFloat',
	'parseInt',
	'Infinity',
	'NaN',
	'undefined',
	'Boolean',
	'String',
	'Symbol',
	'Date',
	'Promise',
	'RegExp',
	'Error',
	'AggregateError',
	'EvalError',
	'RangeError',
	'ReferenceError',
	'SyntaxError',
	'TypeError',
	'URIError',
	'JSON',
	'Math',
	'Intl',
	'ArrayBuffer',
	'Uint8Array',
	'Int8Array',
	'Uint16Array',
	'Int16Array',
	'Uint32Array',
	'Int32Array',
	'Float32Array',
	'Float64Array',
	'Uint8ClampedArray',
	'BigUint64Array',
	'BigInt64Array',
	'DataView',
	'Map',
	'BigInt',
	'Set',
	'WeakMap',
	'WeakSet',
	'Proxy',
	'Reflect',
	'FinalizationRegistry',
	'WeakRef',
	'decodeURI',
	'decodeURIComponent',
	'encodeURI',
	'encodeURIComponent',
	'escape',
	'unescape',
	// 'eval', // no eval
	'isFinite',
	'isNaN',
	'console',
	'SharedArrayBuffer',
	'Atomics',
	// setTimeout & setInterval
	'clearInterval',
	'clearTimeout',
	'setInterval',
	'setTimeout',
	// Crypto API
	'Crypto',
	'SubtleCrypto',
	'crypto',
	// Base64 encoding
	'atob',
	'btoa',
	// Text encoding
	'TextDecoder',
	'TextDecoderStream',
	'TextEncoder',
	'TextEncoderStream',
	// URL tools
	'URL', // disableURLStaticMethods should be called
	'URLSearchParams',
	'FormData',
	'Blob',
	'File',
	// Fetch API (not fetch)
	'Request',
	'Response',
	'Headers',
	// Streams
	'ReadableStream',
	'ReadableStreamBYOBReader',
	'ReadableStreamBYOBRequest',
	'ReadableStreamDefaultController',
	'ReadableStreamDefaultReader',
	'TransformStream',
	'TransformStreamDefaultController',
	'WritableStream',
	'WritableStreamDefaultController',
	'WritableStreamDefaultWriter',
	'ByteLengthQueuingStrategy',
	'CountQueuingStrategy',
	'CompressionStream',
	'DecompressionStream',
	// DOMParser
	'DOMParser',
	'EventTarget',
];

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
		'__buildtimeSettings__.bidirectionalMessaging': 'true',
		'__buildtimeSettings__.sandboxInitDeadlineInMs': '4000',
		'__buildtimeSettings__.innerSandboxInitDeadlineInMs': '1500',
		'__buildtimeSettings__.isolationStategyIframeSole': 'true',
		'__buildtimeSettings__.isolationStategyIframeWorker': 'true',
	},
};

const plugins = [];

plugins.push(
	inlineScripts({
		...options,
		target: 'es2015',
		plugins: plugins,
	}),
);

options.plugins = plugins;

await [
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
);

await [
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
);
