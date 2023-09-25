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

import {
	PX,
	TE,
	aFilter,
	aForEach,
	aIsArray,
	aMap,
	aPush,
	fnApply,
	oCreate,
	oDefineProperties,
	oDefineProperty,
	oFreeze,
	oFromEntries,
	oGetOwnPropertyDescriptor,
	oGetPrototypeOf,
} from './utils.js';

import { IPerformTask, TContext } from '~/types/index.js';
import $global from './global.js';

/**
 * Setup external methods for a given context.
 * This function adds specified external methods to a given context, ensuring
 * they are bound correctly.
 * It's used to expose only specific external functions to the sandboxed
 * environment when bidirectional messaging is enabled.
 *
 * @param ctx - The context to setup the external methods on.
 * @param externalCallMethod - The method used to perform external calls.
 * @param externalMethodsList - List of method names to be set up.
 */
const setupExternalMethods = (
	ctx: object,
	externalCallMethod: IPerformTask,
	externalMethodsList: string[],
) => {
	oDefineProperties(
		ctx,
		oFromEntries(
			aMap(externalMethodsList, (external) => [
				external,
				{
					['configurable']: true,
					['enumerable']: true,
					['value']: externalCallMethod.bind(null, external),
				},
			]),
		),
	);
};

/**
 * Setup references to the global object in a given context.
 *
 * This function is used in conjunction with the emulated global context
 * setting to allow sandboxed code to work normally.
 *
 * Depending on the environment (browser or node), it sets up various
 * references like `window`, `self`, and `global`. The global object references
 * set up are intended to mirror that of the host environment, with the
 * exception of `globalThis`, which is always set.
 *
 * @param ctx - The context where global references will be set up.
 */
const setupContextGlobalRefs = (ctx: object) => {
	const propertiesDescriptor: PropertyDescriptorMap = {};

	const selfPropertyDescriptor: PropertyDescriptor = {
		['writable']: true,
		['configurable']: true,
		['value']: ctx,
	};

	propertiesDescriptor['globalThis'] = selfPropertyDescriptor;

	// Additional references to globalThis based on the host environment
	if (
		typeof window === 'object' &&
		typeof Window === 'function' &&
		window instanceof Window
	) {
		propertiesDescriptor['window'] = selfPropertyDescriptor;
		aForEach(['parent', 'self', 'top'], (k) => {
			if (
				k in $global &&
				typeof $global[k as keyof typeof globalThis] === 'object' &&
				$global[k as keyof typeof globalThis] !== null
			) {
				propertiesDescriptor[k] = selfPropertyDescriptor;
			}
		});
	} else if (typeof self === 'object' && self !== null) {
		propertiesDescriptor['self'] = selfPropertyDescriptor;
	} else if (typeof global === 'object' && global !== null) {
		propertiesDescriptor['global'] = selfPropertyDescriptor;
	}

	oDefineProperties(ctx, propertiesDescriptor);
};

/**
 * Creates a proxy for global functions.
 * This ensures that when global functions (like `clearTimeout`) are invoked
 * within the sandbox, they maintain their expected behaviour, as they may
 * expect to be bound to the real global context.
 *
 * @param ctx - The sandbox context.
 * @param fn - The global function to be proxied.
 * @returns A proxied version of the given function.
 */
const createGlobalFunctionProxy = (() => {
	return (ctx: object, fn: typeof Function.prototype) => {
		return new PX(fn, {
			['apply'](o, thisArg, argArray) {
				if (typeof o === 'function') {
					return fnApply(
						o,
						oGetPrototypeOf(thisArg) === ctx ? $global : thisArg,
						argArray,
					);
				}

				throw TE('Not a function');
			},
			['setPrototypeOf']() {
				return false;
			},
		});
	};
})();

/**
 * Converts a descriptor's value or getter to a proxied function.
 * This function ensures that when a descriptor's value or getter is a function,
 * it's proxied correctly to maintain expected behaviuors within the sandboxed
 * context.
 * This security feature prevents potential vulnerabilities or issues when
 * invoking such functions in the sandbox.
 *
 * @param ctx - The context in which the descriptor operates.
 * @param a - The descriptor to convert.
 * @returns The modified descriptor or undefined if input isn't an object.
 */
const descriptorToFunctionProxy = (ctx: object, a?: PropertyDescriptor) => {
	if (typeof a !== 'object') return a;

	if (typeof a['value'] === 'function') {
		a['value'] = createGlobalFunctionProxy(ctx, a['value']);
	} else if (typeof a['get'] === 'function') {
		const v = a['get'].call($global);
		if (typeof v === 'function') {
			const nameDescriptor = oGetOwnPropertyDescriptor(a['get'], 'name');
			const newGetter = (() => createGlobalFunctionProxy(ctx, v)).bind(
				null,
			);
			if (nameDescriptor) {
				oDefineProperty(newGetter, 'name', nameDescriptor);
			}
			a['get'] = newGetter;
		}
	}
	return a;
};

/**
 * Creates a secure sandbox context.
 * The context is specifically designed to only expose allowed global properties
 * to the sandboxed script. This acts as a major security layer, preventing the
 * script from accessing or mutating potentially harmful or sensitive global
 * variables and functions.
 *
 * @param allowedGlobals - List of allowed global properties.
 * @param externalCallMethod - Method used to perform external calls.
 * @param externalMethodsList - List of external method names.
 * @returns The secure sandbox context.
 */
const createContext = (
	allowedGlobals?: string[] | undefined | null,
	externalCallMethod?: IPerformTask | null,
	externalMethodsList?: string[] | null,
): TContext => {
	const allowedProps =
		(aIsArray(allowedGlobals) && allowedGlobals) ||
		__buildtimeSettings__.defaultAllowedGlobalProps;

	const globalPrototypeChain = [$global];

	for (;;) {
		const p = oGetPrototypeOf(
			globalPrototypeChain[globalPrototypeChain.length - 1],
		);
		if (p === null) break;
		aPush(globalPrototypeChain, p);
	}

	const getGlobalPropertyDescriptor = (prop: string) => {
		for (const p of globalPrototypeChain) {
			const descriptor = oGetOwnPropertyDescriptor(p, prop);

			if (descriptor) {
				return descriptor;
			}
		}

		if ($global[prop as keyof typeof $global]) {
			return {
				['enumerable']: false,
				['writable']: false,
				['configurable']: true,
				['value']: $global[prop as keyof typeof $global],
			};
		}
	};

	const contextPrototype = oCreate(null);
	// Prevent modifying the prototype
	oFreeze(contextPrototype);

	const sandboxWrapperThis = oCreate(contextPrototype);

	setupContextGlobalRefs(sandboxWrapperThis);

	oDefineProperties(
		sandboxWrapperThis,
		oFromEntries(
			aFilter(
				aMap(allowedProps, (prop) => [
					prop,
					descriptorToFunctionProxy(
						contextPrototype,
						getGlobalPropertyDescriptor(prop),
					),
				]),
				(v): v is [string, PropertyDescriptor] => !!v[1],
			),
		),
	);

	if (
		__buildtimeSettings__.bidirectionalMessaging &&
		externalCallMethod &&
		aIsArray(externalMethodsList)
	) {
		setupExternalMethods(
			sandboxWrapperThis,
			externalCallMethod,
			externalMethodsList,
		);
	}

	return sandboxWrapperThis;
};

export default createContext;
export { setupExternalMethods };
