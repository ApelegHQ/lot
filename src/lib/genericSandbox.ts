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
import { IPerformTask, TContext } from '../types/index.js';
import getRandomSecret from './getRandomSecret.js';
import global from './global.js';

const createWrapperFn = <T extends { (s: string): ReturnType<T> }>(
	script: string,
	functionConstructor: T,
): ReturnType<T> => {
	// It is possible for a malicious script to escape the
	// with block by ending with `});} { <code here >; ({`
	// This is imperfectly mitigated by adding a random number of
	// braces
	const guardCount = __buildtimeSettings__.dynamicCodeGeneration
		? ((global.crypto?.getRandomValues(new Uint8Array(1))[0] ??
				(Math.random() * 256) | 0) &
				0xff) +
		  1
		: 0;
	const canary = __buildtimeSettings__.dynamicCodeGeneration
		? getRandomSecret()
		: '';
	const canaryStart = __buildtimeSettings__.dynamicCodeGeneration
		? canary.slice(0, canary.length / 2)
		: '';
	const canaryEnd = __buildtimeSettings__.dynamicCodeGeneration
		? canary.slice(canary.length / 2)
		: 0;

	if (
		!__buildtimeSettings__.dynamicCodeGeneration &&
		script.indexOf('__canary$zzby$') !== -1
	) {
		throw new Error('__canary$zzby$ inside script not supported');
	}

	// Remove import expresions from the code by introducing an escape sequence
	// Strings are unaffected, but using the import keyword will trigger a
	// syntax error
	// This supports properties called 'import', but they must be quoted
	// TODO: Improve regex to support things like { import: 123 } and
	// { import() { return } } (seems difficult without a lot of parsing)
	// Regex: makes an exception for .import so long as there is exactly one
	// dot
	// {
	//	"   import": "   im\\u0070ort",
	//	"  .import": "  .import",
	//	" ..import": " ..im\\u0070ort",
	//	"...import": "...im\\u0070ort",
	//	"import0": "import0",
	//	"0import": "0import",
	//	"ximportx": "ximportx",
	//	"import_": "import_",
	//	"_import": "_import",
	//	"_import_": "_import_"
	//	"import:": "im\\u0070ort:",
	// }
	script = script.replace(/\b(?<=(?:[^.]|[.]{2}))import\b/g, 'im\\u0070ort');

	const sandboxWrapperFn = functionConstructor(
		// The 'with' block restricts access to the global scope
		__buildtimeSettings__.dynamicCodeGeneration
			? 'with(this){' +
					`~function(){${fixGlobalTypes.default}}();` +
					`(function(__canary$${canaryStart}__){` +
					"'use strict';" +
					// The canary is an additional mechanism to ensure that if the
					// code after 'script' is skipped, it will throw because it
					// doesn't know the variable name or its contents, even if it
					// managed to guess the guardCount variable
					`__canary$${canaryStart}__="${canaryEnd}";` +
					// The guard makes it difficult for the script to execute code
					// outside of the 'with' block by having it guess the correct
					// number of parentheses it needs to inject. Since guardCount
					// is random, it cannot be guessed deterministically.
					'('.repeat(guardCount) +
					// Function argument to shadow canary value
					`function(__canary$${canaryStart}__){` +
					script +
					// Prevent the script from excluding the following code
					// via comments or template strings
					'\r\n/*`*/' +
					'}' +
					')'.repeat(guardCount) +
					'();' +
					`if("${canaryEnd}"!==__canary$${canaryStart}__)` +
					'throw "__canary__";' +
					`__canary$${canaryStart}__=void 0;` +
					'})();' +
					'}'
			: 'with(this){' +
					`~function(){${fixGlobalTypes.default}}();` +
					`(function(__canary$zzby$o__){` +
					'__canary$zzby$o__={};' +
					`(function(__canary$zzby$i__){` +
					"'use strict';" +
					'__canary$zzby$i__=__canary$zzby$o__;' +
					'(' +
					// Function arguments to shadow canary values
					`function(__canary$zzby$o__, __canary$zzby$i__){` +
					script +
					// Prevent the script from excluding the following code
					// via comments or template strings
					'\r\n/*`*/' +
					'}' +
					')' +
					'();' +
					`if(__canary$zzby$o__!==__canary$zzby$i__)throw "__canary__";` +
					`__canary$zzby$i__=void 0;` +
					`__canary$zzby$o__=void 0;` +
					'})();' +
					'})();' +
					'}',
	);

	return sandboxWrapperFn;
};

const createContext = (
	allowedGlobals?: string[] | undefined | null,
	externalCallMethod?: IPerformTask | null,
	externalMethodsList?: string[] | null,
): TContext => {
	const allowedProps =
		(Array.isArray(allowedGlobals) && allowedGlobals) ||
		__buildtimeSettings__.defaultAllowedGlobalProps;

	const globalPrototypeChain = [global];

	for (;;) {
		const p = Object.getPrototypeOf(
			globalPrototypeChain[globalPrototypeChain.length - 1],
		);
		if (p === null) break;
		globalPrototypeChain.push(p);
	}

	const getGlobalPropertyDescriptor = (prop: string) => {
		for (const p of globalPrototypeChain) {
			const descriptor = Object.getOwnPropertyDescriptor(p, prop);

			if (descriptor) {
				return descriptor;
			}
		}

		if (global[prop as 'Boolean']) {
			return {
				enumerable: false,
				writable: false,
				configurable: true,
				value: global[prop as 'Boolean'],
			};
		}
	};

	const sandboxWrapperThis = Object.create(
		null,
		Object.fromEntries(
			allowedProps
				.map((prop) => [prop, getGlobalPropertyDescriptor(prop)])
				.filter(([, d]) => !!d),
		),
	);

	Object.defineProperties(sandboxWrapperThis, {
		['global']: {
			writable: true,
			configurable: true,
			value: sandboxWrapperThis,
		},
		['globalThis']: {
			writable: true,
			configurable: true,
			value: sandboxWrapperThis,
		},
		['self']: {
			writable: true,
			configurable: true,
			value: sandboxWrapperThis,
		},
		['module']: {
			value: Object.create(null, {
				['exports']: {
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
	functionConstructor: (typeof global)['Function'],
	externalCallMethod?: IPerformTask | null,
	externalMethodsList?: string[] | null,
): { fn: { (): void }; ctx: TContext; revoke: { (): void } } => {
	if (
		!__buildtimeSettings__.bidirectionalMessaging &&
		(externalCallMethod || externalMethodsList)
	) {
		throw new TypeError(
			'Invalid value for externalCallMethod or externalMethodsList. Bidirectional messaging is disabled',
		);
	}

	const sandboxWrapperThis = createContext(
		allowedGlobals,
		externalCallMethod,
		externalMethodsList,
	);

	const apply = Function.prototype.apply;

	// This proxy is needed to keep global functions that expect to be bound to
	// globalThis working (e.g., clearTimeout)
	const createFunctionProxy = (fn: typeof functionConstructor.prototype) => {
		return new Proxy(fn, {
			['apply'](o, thisArg, argArray) {
				if (typeof o === 'function') {
					return apply.call(
						o,
						thisArg === sandboxWrapperThisProxy.proxy
							? global
							: thisArg,
						argArray,
					);
				}

				throw new TypeError('Not a function');
			},
		});
	};

	// eslint-disable-next-line prefer-const
	let sandboxWrapperThisProxy: {
		proxy: typeof sandboxWrapperThis;
		revoke: { (): void };
	};

	sandboxWrapperThisProxy = Proxy.revocable(sandboxWrapperThis, {
		// TODO: Should we trap getOwnPropertyDescriptor as well?
		// That allows detecting the sandbox and potentially breaks code
		// calling functions this way.
		['get'](o, p) {
			const op = o[p];
			if (
				typeof op === 'function' &&
				!Object.prototype.hasOwnProperty.call(global, p)
			) {
				return createFunctionProxy(op);
			}
			if (op === sandboxWrapperThis) {
				return sandboxWrapperThisProxy.proxy;
			}
			return op;
		},
		['has']() {
			return true;
		},
	});

	const sandboxWrapperFn = createWrapperFn(script, functionConstructor);

	return {
		fn: sandboxWrapperFn.bind(sandboxWrapperThisProxy.proxy),
		ctx: sandboxWrapperThisProxy.proxy,
		revoke: sandboxWrapperThisProxy.revoke,
	};
};

export default genericSandbox;
export { createWrapperFn, createContext };
