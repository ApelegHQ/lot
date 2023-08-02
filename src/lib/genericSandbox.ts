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
import $global from './global.js';
import globalProxy from './globalProxy.js';
import modulePropertyDescriptor from './modulePropertyDescriptor.js';

const createWrapperFn = <T extends { (s: string): ReturnType<T> }>(
	script: string,
	functionConstructor: T,
): ReturnType<T> => {
	if (__buildtimeSettings__.censorUnsafeExpressions) {
		script = censorUnsafeExpressions(script);
	}

	if (__buildtimeSettings__.enhancedWrapper) {
		script = enhancedWrapper(script);
	} else {
		script = `(function(module){${script}}).call(this.globalThis,this.module);`;
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
					['configurable']: true,
					['writable']: false,
					enumerable: true,
					['value']: externalCallMethod.bind(null, external),
				},
			]),
		),
	);
};

const setupContextGlobalRefs = (ctx: object) => {
	const propertiesDescriptor: PropertyDescriptorMap = {};

	const selfPropertyDescriptor: PropertyDescriptor = {
		['writable']: true,
		['configurable']: true,
		['value']: ctx,
	};

	propertiesDescriptor['globalThis'] = selfPropertyDescriptor;

	// Additional references to globalThis based on the host environment
	if (typeof window === 'object') {
		propertiesDescriptor['window'] = selfPropertyDescriptor;
		['parent', 'self', 'top'].forEach((k) => {
			if (k in $global) {
				propertiesDescriptor[k] = selfPropertyDescriptor;
			}
		});
	} else if (typeof self === 'object') {
		propertiesDescriptor['self'] = selfPropertyDescriptor;
	} else if (typeof global === 'object') {
		propertiesDescriptor['global'] = selfPropertyDescriptor;
	}

	Object.defineProperties(ctx, propertiesDescriptor);
};

// This proxy is needed to keep global functions that expect to be bound to
// globalThis working (e.g., clearTimeout)
const createGlobalFunctionProxy = (() => {
	// `Function` may not be available
	const apply = (() => {}).apply as typeof Function.prototype.apply;
	const getPrototypeOf = Object.getPrototypeOf;

	return (ctx: object, fn: typeof Function.prototype) => {
		return new Proxy(fn, {
			['apply'](o, thisArg, argArray) {
				if (typeof o === 'function') {
					return apply.call(
						o,
						getPrototypeOf(thisArg) === ctx ? $global : thisArg,
						argArray,
					);
				}

				throw new TypeError('Not a function');
			},
		});
	};
})();

const descriptorToFunctionProxy = (ctx: object, a?: PropertyDescriptor) => {
	if (typeof a !== 'object') return a;

	if (typeof a['value'] === 'function') {
		a['value'] = createGlobalFunctionProxy(ctx, a['value']);
	} else if (typeof a['get'] === 'function') {
		const v = a['get'].call($global);
		if (typeof v === 'function') {
			const nameDescriptor = Object.getOwnPropertyDescriptor(
				a['get'],
				'name',
			);
			const newGetter = (() => createGlobalFunctionProxy(ctx, v)).bind(
				null,
			);
			if (nameDescriptor) {
				Object.defineProperty(newGetter, 'name', nameDescriptor);
			}
			a['get'] = newGetter;
		}
	}
	return a;
};

const createContext = (
	allowedGlobals?: string[] | undefined | null,
	externalCallMethod?: IPerformTask | null,
	externalMethodsList?: string[] | null,
): TContext => {
	const allowedProps =
		(Array.isArray(allowedGlobals) && allowedGlobals) ||
		__buildtimeSettings__.defaultAllowedGlobalProps;

	const globalPrototypeChain = [$global];

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

		if ($global[prop as keyof typeof $global]) {
			return {
				enumerable: false,
				['writable']: false,
				['configurable']: true,
				['value']: $global[prop as keyof typeof $global],
			};
		}
	};

	const contextPrototype = Object.create(null);
	// Prevent modifying the prototype
	Object.freeze(contextPrototype);

	const sandboxWrapperThis = Object.create(contextPrototype);

	setupContextGlobalRefs(sandboxWrapperThis);

	Object.defineProperties(
		sandboxWrapperThis,
		Object.fromEntries(
			allowedProps
				.map((prop) => [
					prop,
					descriptorToFunctionProxy(
						contextPrototype,
						getGlobalPropertyDescriptor(prop),
					),
				])
				.filter(([, d]) => !!d),
		),
	);

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

type TGenericSandbox = {
	(
		script: string,
		allowedGlobals: string[] | undefined | null,
		functionConstructor: (typeof $global)['Function'],
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

				// The Proxy only for the `with` statement makes the sandbox
				// work more similarly to what a 'real' global contex would
				// look like, while also handling special edge-cases like
				// [Symbol.unscopables].
				// The one thing that seems impossible to implement is
				// properly throwing `ReferenceError`.
				// This handles, for example, checking that
				// `('undefinedProp' in self)` correctly returns `false` (which
				// it wouldn't otherwise because of 'has' always returning true)
				const sandboxWrapperThisProxy = globalProxy(sandboxWrapperThis);

				const sandboxWrapperFn = createWrapperFn(
					script,
					functionConstructor,
				);

				return {
					fn: sandboxWrapperFn.bind(sandboxWrapperThisProxy['proxy']),
					ctx: sandboxWrapperThisProxy['proxy'],
					revoke: () => {
						sandboxWrapperThisProxy['revoke']();
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

				if (
					__buildtimeSettings__.bidirectionalMessaging &&
					externalCallMethod &&
					Array.isArray(externalMethodsList)
				) {
					setupExternalMethods(
						$global,
						externalCallMethod,
						externalMethodsList,
					);
				}

				// No Proxy in this case, since we are explicitly sharing the
				// global scope
				// 'module' is special in that it's not a globally-scoped
				// variable
				const ctx = Object.create(null, {
					// globalThis is used to set 'this' to $global
					['globalThis']: {
						['value']: $global,
					},
					['module']: modulePropertyDescriptor,
				});

				return {
					fn: sandboxWrapperFn.bind(ctx),
					ctx: ctx as unknown as TContext,
					revoke: Boolean,
				};
		  };

export default genericSandbox;
export { createContext, createWrapperFn };
