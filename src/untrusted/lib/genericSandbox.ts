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

import { IPerformTask, TContext } from '../../types/index.js';
import censorUnsafeExpressions from './censorUnsafeExpressions.js';
import enhancedWrapper from './enhancedWrapper.js';
import $global from './global.js';
import globalProxy from './globalProxy.js';
import modulePropertyDescriptor from './modulePropertyDescriptor.js';
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

const createWrapperFn = <T extends { (s: string): ReturnType<T> }>(
	script: string,
	functionConstructor: T,
): ReturnType<T> => {
	if (typeof script !== 'string') {
		throw TE('called on incompatible ' + typeof script);
	}

	if (__buildtimeSettings__.censorUnsafeExpressions) {
		script = censorUnsafeExpressions(script);
	}

	if (__buildtimeSettings__.enhancedWrapper) {
		script = enhancedWrapper(script);
	} else {
		script =
			'(function(module){\r\n' +
			`${script}` +
			'\r\n}).call(this.globalThis,this.module);';
	}

	const sandboxWrapperFn = functionConstructor(script);

	return sandboxWrapperFn;
};

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
					['writable']: false,
					['enumerable']: true,
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
		aForEach(['parent', 'self', 'top'], (k) => {
			if (k in $global) {
				propertiesDescriptor[k] = selfPropertyDescriptor;
			}
		});
	} else if (typeof self === 'object') {
		propertiesDescriptor['self'] = selfPropertyDescriptor;
	} else if (typeof global === 'object') {
		propertiesDescriptor['global'] = selfPropertyDescriptor;
	}

	oDefineProperties(ctx, propertiesDescriptor);
};

// This proxy is needed to keep global functions that expect to be bound to
// globalThis working (e.g., clearTimeout)
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
					throw TE(
						'Invalid value for externalCallMethod or externalMethodsList. Bidirectional messaging is disabled',
					);
				}

				const sandboxWrapperFn = createWrapperFn(
					script,
					functionConstructor,
				);

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
					throw TE(
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
					aIsArray(externalMethodsList)
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
				const ctx = oCreate(null, {
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
