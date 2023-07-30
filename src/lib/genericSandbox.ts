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
 * PERFORMANCE 5OF THIS SOFTWARE.
 */

import { IPerformTask, TContext } from '../types/index.js';
import censorUnsafeExpressions from './censorUnsafeExpressions.js';
import enhancedWrapper from './enhancedWrapper.js';
import global from './global.js';

const createWrapperFn = <T extends { (s: string): ReturnType<T> }>(
	script: string,
	functionConstructor: T,
): ReturnType<T> => {
	if (__buildtimeSettings__.censorUnsafeExpressions) {
		script = censorUnsafeExpressions(script);
	}

	if (__buildtimeSettings__.enhancedWrapper) {
		script = enhancedWrapper(script);
	}

	const sandboxWrapperFn = functionConstructor(script);

	return sandboxWrapperFn;
};

const setupExternalMethods = (
	ctx: object,
	externalCallMethod: IPerformTask,
	externalMethodsList: string[],
) => {
	Object.defineProperties(
		ctx,
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
};

const setupContextGlobalRefs = (ctx: object) => {
	Object.defineProperties(ctx, {
		['global']: {
			writable: true,
			configurable: true,
			value: ctx,
		},
		['globalThis']: {
			writable: true,
			configurable: true,
			value: ctx,
		},
		['self']: {
			writable: true,
			configurable: true,
			value: ctx,
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

		if (global[prop as keyof typeof global]) {
			return {
				enumerable: false,
				writable: false,
				configurable: true,
				value: global[prop as keyof typeof global],
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

	setupContextGlobalRefs(sandboxWrapperThis);

	if (
		__buildtimeSettings__.bidirectionalMessaging &&
		externalCallMethod &&
		Array.isArray(externalMethodsList)
	) {
		setupExternalMethods(
			sandboxWrapperThis,
			externalCallMethod,
			externalMethodsList,
		);
	}

	return sandboxWrapperThis;
};

const propertyIsOverridable = <T>(o: T, p: PropertyKey) => {
	const propertyDescriptor = Object.getOwnPropertyDescriptor(o, p);
	return (
		!propertyDescriptor ||
		propertyDescriptor['configurable'] ||
		propertyDescriptor['writable']
	);
};

type TGenericSandbox = {
	(
		script: string,
		allowedGlobals: string[] | undefined | null,
		functionConstructor: (typeof global)['Function'],
		externalCallMethod?: IPerformTask | null,
		externalMethodsList?: string[] | null,
	): { fn: { (): void }; ctx: TContext; revoke: { (): void } };
};

const genericSandbox: TGenericSandbox =
	__buildtimeSettings__.emulatedGlobalContext
		? (
				script,
				allowedGlobals,
				functionConstructor,
				externalCallMethod,
				externalMethodsList,
		  ) => {
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
				const createFunctionProxy = (
					fn: typeof functionConstructor.prototype,
				) => {
					return new Proxy(fn, {
						['apply'](o, thisArg, argArray) {
							if (typeof o === 'function') {
								return apply.call(
									o,
									[
										sandboxWrapperThisProxy.proxy,
										sandboxWrapperThisInnerProxy.proxy,
									].includes(thisArg)
										? global
										: thisArg,
									argArray,
								);
							}

							throw new TypeError('Not a function');
						},
					});
				};

				const { proxy: symbols, revoke: revokeSymbols } =
					Proxy.revocable(Object.create(null), {});

				const sandboxWrapperThisInnerProxy: {
					proxy: typeof sandboxWrapperThis;
					revoke: { (): void };
				} = Proxy.revocable(sandboxWrapperThis, {
					['get'](o, p) {
						const op = o[p];
						if (
							typeof op === 'function' &&
							global[p as keyof typeof global] === op &&
							propertyIsOverridable(o, p)
						) {
							return createFunctionProxy(op);
						}
						if (op === sandboxWrapperThis) {
							return sandboxWrapperThisInnerProxy.proxy;
						}
						return op;
					},
					['getOwnPropertyDescriptor'](o, p) {
						const op = symbols[p] || o[p];
						const pd =
							Object.getOwnPropertyDescriptor(symbols, p) ||
							Object.getOwnPropertyDescriptor(o, p);

						if (!pd) {
							return pd;
						}

						if (
							typeof op === 'function' &&
							global[p as keyof typeof global] === op &&
							propertyIsOverridable(o, p)
						) {
							const value = createFunctionProxy(op);
							if (pd['get']) {
								pd['get'] = () => value;
							} else {
								pd['value'] = value;
							}
						}
						if (op === sandboxWrapperThis) {
							const value = sandboxWrapperThisInnerProxy.proxy;
							if (pd['get']) {
								pd['get'] = () => value;
							} else {
								pd['value'] = value;
							}
						}

						return pd;
					},
					['defineProperty'](o, p, a) {
						if (!propertyIsOverridable(o, p)) {
							return false;
						}
						Object.defineProperty(
							typeof p === 'symbol' ? symbols : o,
							p,
							a,
						);
						return true;
					},
					['deleteProperty'](o, p) {
						return delete symbols[p] && delete o[p];
					},
				});

				// Double-Proxy makes the sandbox work more similarly to what
				// a 'real' global contex would look like, while also handling
				// special edge-cases like [Symbol.unscopables]
				// The one thing that seems impossible to implement is
				// properly throwing ReferenceError.
				const sandboxWrapperThisProxy: {
					proxy: typeof sandboxWrapperThis;
					revoke: { (): void };
				} = Proxy.revocable(sandboxWrapperThisInnerProxy.proxy, {
					['get'](o, p) {
						// Block getting symbols
						// This is especially relevant for [Symbol.unscopables]
						// Getting/setting symbols on the inner proxy (using
						// a self reference) should work fine
						if (typeof p !== 'string') {
							return;
						}
						return o[p];
					},
					['has']() {
						return true;
					},
				});

				const sandboxWrapperFn = createWrapperFn(
					script,
					functionConstructor,
				);

				return {
					fn: sandboxWrapperFn.bind(sandboxWrapperThisProxy.proxy),
					ctx: sandboxWrapperThisProxy.proxy,
					revoke: () => {
						sandboxWrapperThisInnerProxy.revoke();
						sandboxWrapperThisProxy.revoke();
						revokeSymbols();
					},
				};
		  }
		: (
				script,
				_,
				functionConstructor,
				externalCallMethod,
				externalMethodsList,
		  ) => {
				if (
					!__buildtimeSettings__.bidirectionalMessaging &&
					(externalCallMethod || externalMethodsList)
				) {
					throw new TypeError(
						'Invalid value for externalCallMethod or externalMethodsList. Bidirectional messaging is disabled',
					);
				}

				const sandboxWrapperFn = createWrapperFn(
					script,
					functionConstructor,
				);

				setupContextGlobalRefs(global);

				if (
					__buildtimeSettings__.bidirectionalMessaging &&
					externalCallMethod &&
					Array.isArray(externalMethodsList)
				) {
					setupExternalMethods(
						global,
						externalCallMethod,
						externalMethodsList,
					);
				}

				return {
					fn: sandboxWrapperFn.bind(global),
					ctx: global as unknown as TContext,
					revoke: Boolean,
				};
		  };

export default genericSandbox;
export { createContext, createWrapperFn };
