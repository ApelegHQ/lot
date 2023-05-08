/* Copyright © 2023 Exact Realty Limited.
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

import * as fixGlobalTypes from 'inline:./fixGlobalTypes.inline.js';
import type performTaskFactory from './performTaskFactory';

const createWrapperFn = <T extends { (s: string): ReturnType<T> }>(
	script: string,
	Function: T,
) => {
	// It is possible for a malicious script to escape the
	// with block by ending with `});} { <code here >; ({`
	// This is imperfectly mitigated by adding a random number of
	// braces
	const guardCount =
		(globalThis.crypto?.getRandomValues(new Uint16Array(1))[0] ??
			(Math.random() * 65536) | 0) & 0x7ff;
	const sandboxWrapperFn = Function(
		'with(this){' +
			`~function(){${fixGlobalTypes.default}}();` +
			'(function(){' +
			"'use strict';" +
			'{'.repeat(guardCount) +
			script +
			'\r\n/*`*/' +
			'}'.repeat(guardCount) +
			'})();' +
			'}',
	);

	return sandboxWrapperFn;
};

const createContext = (
	allowedGlobals?: string[] | undefined | null,
	externalCallMethod?: ReturnType<typeof performTaskFactory>[0] | null,
	externalMethodsList?: string[] | null,
) => {
	const allowedProps = (Array.isArray(allowedGlobals) && allowedGlobals) || [
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

	const sandboxWrapperThis = Object.create(
		null,
		Object.fromEntries(
			allowedProps
				.map((prop) => [
					prop,
					Object.getOwnPropertyDescriptor(globalThis, prop),
				])
				.filter(([, d]) => !!d),
		),
	);

	Object.defineProperties(sandboxWrapperThis, {
		globalThis: {
			writable: true,
			configurable: true,
			value: sandboxWrapperThis,
		},
		self: { writable: true, configurable: true, value: sandboxWrapperThis },
		module: {
			value: Object.create(null, {
				exports: {
					value: Object.create(null),
					writable: true,
					enumerable: true,
					configurable: true,
				},
			}),
		},
	});

	if (externalCallMethod && Array.isArray(externalMethodsList)) {
		Object.defineProperties(
			sandboxWrapperThis,
			Object.fromEntries(
				externalMethodsList.map((external) => [
					external,
					{
						configurable: true,
						writable: false,
						enumerable: true,
						value: externalCallMethod.bind(null, external),
					},
				]),
			),
		);
	}

	return sandboxWrapperThis;
};

const genericSandbox = (
	script: string,
	allowedGlobals: string[] | undefined | null,
	Function: (typeof globalThis)['Function'],
	externalCallMethod?: ReturnType<typeof performTaskFactory>[0] | null,
	externalMethodsList?: string[] | null,
) => {
	const sandboxWrapperThis = createContext(
		allowedGlobals,
		externalCallMethod,
		externalMethodsList,
	);

	const sandboxWrapperThisProxy = Proxy.revocable(sandboxWrapperThis, {
		['get'](o, p) {
			return o[p];
		},
		['has']() {
			return true;
		},
	});

	const sandboxWrapperFn = createWrapperFn(script, Function);

	return {
		sandboxWrapperFn: sandboxWrapperFn.bind(sandboxWrapperThisProxy.proxy),
		sandboxWrapperThis: sandboxWrapperThisProxy.proxy,
		sandboxWrapperRevoke: sandboxWrapperThisProxy.revoke,
	};
};

export default genericSandbox;
export { createWrapperFn, createContext };
