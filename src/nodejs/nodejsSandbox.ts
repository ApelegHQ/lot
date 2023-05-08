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

import * as nodejsSandboxInit from 'inline:./nodejsSandboxInit.inline.js';
import vm from 'node:vm';
import { createContext, createWrapperFn } from '../lib/genericSandbox.js';

const getBuiltins = () => {
	const context = Object.create(null);
	Object.freeze(context);

	vm.createContext(context, {
		codeGeneration: {
			strings: false,
			wasm: false,
		},
	});

	const builtins = Object.create(
		null,
		vm.runInContext(
			'Object.getOwnPropertyDescriptors(globalThis)',
			context,
			{
				displayErrors: process.env['NODE_ENV'] !== 'production',
			},
		),
	);

	return builtins;
};

type TnativeNodejsProxy<TT extends object> = {
	(o: TT): TT;
} & {
	(o: TT, revocable: false): TT;
} & {
	(o: TT, revocable: true): {
		proxy: TT;
		revoke: { (): void };
	};
};

const nativeNodejsProxy = (<T extends object>(o: T, revocable?: boolean) => {
	const handler: ProxyHandler<typeof o> = {
		['apply'](o, thisArg, argArray) {
			if (typeof o === 'function' && o !== Function) {
				try {
					return Reflect.apply(o, thisArg, argArray);
				} catch (e) {
					if (!(e instanceof Object)) throw e;

					throw nativeNodejsProxy(e);
				}
			} else {
				throw nativeNodejsProxy(
					new EvalError('Access to Function.prototype blocked'),
				);
			}
		},
		['construct'](o, argArray, newTarget) {
			if (typeof o === 'function' && o !== Function) {
				try {
					return Reflect.construct(o, argArray, newTarget);
				} catch (e) {
					if (!(e instanceof Object)) throw e;

					throw nativeNodejsProxy(e);
				}
			} else {
				throw nativeNodejsProxy(
					new EvalError('Access to Function.prototype blocked'),
				);
			}
		},
		['setPrototypeOf'](o, v) {
			if (!(o instanceof Object)) {
				return Reflect.setPrototypeOf(o, v);
			}

			return true;
		},
		['defineProperty'](o, p, d) {
			if (!(o instanceof Object)) {
				return Reflect.defineProperty(o, p, d);
			}

			return true;
		},
		['deleteProperty'](o, p) {
			if (!(o instanceof Object)) {
				return Reflect.deleteProperty(o, p);
			}

			return true;
		},
		['preventExtensions'](o) {
			if (!(o instanceof Object)) {
				return Reflect.preventExtensions(o);
			}

			return true;
		},
		['set'](o, p, v) {
			if (!(o instanceof Object)) {
				return Reflect.set(o, p, v);
			}

			return true;
		},
		['get'](o, p) {
			const op = Reflect.get(o, p);
			if (!(op instanceof Object)) return op;

			if ((op as unknown) === Function.prototype) {
				throw new TypeError('Access to Function.prototype blocked');
			}

			return nativeNodejsProxy(op, false);
		},
		['getOwnPropertyDescriptor'](o, p) {
			const opd = Object.getOwnPropertyDescriptor(o, p);
			if (!opd) return opd;

			return {
				...opd,
				...(opd.value && {
					value:
						opd.value instanceof Object
							? nativeNodejsProxy(opd.value)
							: opd.value,
				}),
				...(opd.get && { get: nativeNodejsProxy(opd.get) }),
			};
		},
	};

	return revocable ? Proxy.revocable(o, handler) : new Proxy(o, handler);
}) as TnativeNodejsProxy<ReturnType<typeof eval>>;

const nodejsSandbox = async (
	script: string,
	allowedGlobals?: string[] | null,
	externalMethods?: Record<string, typeof Function.prototype> | null,
	signal?: AbortSignal,
) => {
	const rawContext = createContext(
		allowedGlobals,
		externalMethods &&
			(async (op: string, ...args: unknown[]) => {
				if (
					!Object.prototype.hasOwnProperty.call(externalMethods, op)
				) {
					throw new ReferenceError(`${op} is not defined`);
				}

				const fn = externalMethods[op];

				if (typeof fn !== 'function') {
					throw new TypeError(`${op} is not a function`);
				}

				return JSON.parse(
					JSON.stringify(await externalMethods[op](...args)),
				);
			}),
		externalMethods && Object.keys(externalMethods),
	);
	const wrapperFn = createWrapperFn(script, String);

	const builtinsList = new Set(
		Object.keys(Object.getOwnPropertyDescriptors(getBuiltins())),
	);

	builtinsList.delete('globalThis');
	builtinsList.delete('module');
	builtinsList.delete('self');

	builtinsList.forEach((k) => {
		try {
			delete rawContext[k];
		} catch {
			/* nothing */
		}
	});

	const baseContext = nativeNodejsProxy(rawContext, true);

	const { proxy: contextProxy, revoke: revokeContextProxy } = Proxy.revocable(
		Object.create(null),
		{
			['defineProperty'](o, p, d) {
				return typeof p === 'string' && builtinsList.has(p)
					? Object.defineProperty(o, p, d)
					: Object.defineProperty(baseContext.proxy, p, d);
			},
			['get'](o, p) {
				return typeof p === 'string' && builtinsList.has(p)
					? o[p]
					: baseContext.proxy[p];
			},
			['getOwnPropertyDescriptor'](o, p) {
				return typeof p === 'string' && builtinsList.has(p)
					? Object.getOwnPropertyDescriptor(o, p)
					: Object.getOwnPropertyDescriptor(baseContext.proxy, p);
			},
			['has'](o, p) {
				return typeof p === 'string' && builtinsList.has(p)
					? !!o[p]
					: !!baseContext.proxy[p];
			},
			['set'](o, p, v) {
				return typeof p === 'string' && builtinsList.has(p)
					? Reflect.set(o, p, v)
					: Reflect.set(baseContext.proxy, p, v);
			},
		},
	);

	let context = Object.create(null, {
		globalThis: {
			configurable: true,
			value: contextProxy,
		},
	});

	vm.createContext(context, {
		codeGeneration: {
			strings: false,
			wasm: false,
		},
	});

	vm.runInContext(
		`~function(){${nodejsSandboxInit.default}}();(function(){${wrapperFn}}).call(globalThis);`,
		context,
		{
			displayErrors: process.env['NODE_ENV'] !== 'production',
		},
	);

	const ctx = baseContext.proxy;

	const performTask = async (op: string, ...args: unknown[]) => {
		if (
			!ctx ||
			!ctx['module'] ||
			!ctx['module']['exports'] ||
			!Object.prototype.hasOwnProperty.call(
				ctx['module']['exports'],
				op as PropertyKey,
			)
		) {
			throw new ReferenceError(`${op} is not defined`);
		}

		const fn = ctx['module']['exports'][op as PropertyKey];

		if (typeof fn !== 'function') {
			throw new TypeError(`${op} is not a function`);
		}

		return Function.prototype.apply.call(fn, null, args);
	};

	const performTaskProxy = Proxy.revocable(performTask, {});

	signal?.addEventListener('abort', () => {
		baseContext.revoke();
		revokeContextProxy();
		context = undefined;
		performTaskProxy.revoke();
	});

	return performTaskProxy.proxy;
};

export default nodejsSandbox;
