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
	EE,
	aFilter,
	aForEach,
	aMap,
	fnApply,
	oDefineProperties,
	oDefineProperty,
	oFreeze,
	oGetOwnPropertyDescriptor,
	oGetPrototypeOf,
	oSetPrototypeOf,
} from './utils.js';

import global from './global.js';

/**
 * Ensures that a constructor and its properties are inert, preventing potential
 * tampering or modification by malicious code. The resulting 'constructor' is
 * not a constructor and cannot be used to dynamically execute code.
 *
 * This function helps maintain the security guarantees of the sandbox
 * by ensuring that critical properties of constructors cannot be altered.
 *
 * @param constructorRef - Reference to the constructor whose properties need to be made inert.
 * @param errorFnName - The name of the function to show in error messages
 * @returns An inert constructor
 */
const inertConstructorProperty = (
	prototype: typeof Function.prototype,
	errorFnName: string,
) => {
	const inertConstructor = function () {
		throw EE(`call to ${errorFnName}() blocked by CSP`);
	};
	const boundInertConstructor = inertConstructor.bind(global);
	try {
		oDefineProperty(
			boundInertConstructor,
			'name',
			oGetOwnPropertyDescriptor(prototype.constructor, 'name') || {
				['value']: prototype.constructor.name,
				['writable']: false,
				['configurable']: true,
				['enumerable']: false,
			},
		);
	} catch {
		// 'name' might be read-only in certain environments
	}
	oDefineProperty(boundInertConstructor, 'prototype', {
		['value']: prototype,
	});

	return {
		['value']: boundInertConstructor,
		['writable']: false,
		['configurable']: true,
		['enumerable']: false,
	};
};

/**
 * Tames the global `setTimeout` and `setInterval` functions to ensure
 * they can't be exploited or misused to execute code dynamically by passing
 * a string.
 *
 * @param f - The original global setTimeout function.
 * @returns Tamed versions of setTimeout and setInterval that only accept
 * functions as callback arguments
 */
const tameSetTimerFn = (f: 'setTimeout' | 'setInterval') => {
	const feralFn = global[f];

	if (typeof feralFn !== 'function') return;

	const tamedFn = function (...args: Parameters<typeof feralFn>) {
		if (typeof args[0] !== 'function') {
			throw EE(`call to eval() blocked by CSP`);
		}
		return fnApply(feralFn, global, args);
	};
	try {
		oDefineProperty(
			tamedFn,
			'name',
			oGetOwnPropertyDescriptor(feralFn, 'name') || {
				['value']: feralFn.name,
				['writable']: false,
				['configurable']: true,
				['enumerable']: false,
			},
		);
	} catch {
		// 'name' might be read-only in certain environments
	}

	oDefineProperty(global, f, {
		['value']: tamedFn.bind(null),
	});
};

/**
 * Harden global objects and their properties, ensuring they're non-configurable
 * and immutable to prevent tampering.
 *
 * This is a security measure to ensure that malicious scripts cannot modify
 * global objects, potentially changing their behaviuor to bypass security
 * measures.
 */
const hardenGlobals: { (): void } = __buildtimeSettings__.hardenGlobals
	? () => {
			const FERAL_FUNCTION = hardenGlobals.constructor;

			const list = aFilter(
				aMap(
					[
						'(function(){})',
						'(function*(){})',
						'(async function(){})',
						'(async function*(){})',
					],
					(source, i) => {
						try {
							return (0, eval)(source);
						} catch {
							if (i === 0)
								return function () {
									/**/
								};
						}
					},
				),
				Boolean as unknown as {
					(v?: FunctionConstructor): v is FunctionConstructor;
				},
			);

			try {
				// Attempt to tame function constructors
				aForEach(list, (fnIntrinsic) => {
					try {
						const prototype = oGetPrototypeOf(fnIntrinsic);
						const origConstructor = prototype.constructor;
						const constructorDescriptor = inertConstructorProperty(
							prototype,
							'Function',
						);
						oDefineProperty(
							prototype,
							'constructor',
							constructorDescriptor,
						);

						// Fix inheritance
						if (
							constructorDescriptor.value !==
							FERAL_FUNCTION.prototype.constructor
						) {
							oSetPrototypeOf(
								constructorDescriptor.value,
								FERAL_FUNCTION.prototype.constructor,
							);
						}

						// Replace global['Function'], etc.
						if (
							oGetOwnPropertyDescriptor(
								global,
								origConstructor.name,
							)?.value === origConstructor
						) {
							oDefineProperty(
								global,
								origConstructor.name,
								constructorDescriptor,
							);
						}
						oFreeze(prototype);
					} catch {
						// empty
					}
				});

				oDefineProperty(
					global,
					'eval',
					inertConstructorProperty(
						oGetPrototypeOf(
							typeof eval === 'function' ? eval : function () {},
						),
						'eval',
					),
				);
				tameSetTimerFn('setTimeout');
				tameSetTimerFn('setInterval');
				oFreeze(oGetPrototypeOf(Object));
				oFreeze(Object);
			} catch (e) {
				if (e) {
					throw e;
				}
				void e;
			}
	  }
	: Boolean;

/**
 * Disables static methods on the URL object that could be misused for probing
 * or information disclosure or to cause certain DoS attacks.
 *
 * By removing or wrapping potentially harmful static methods, the URL object
 * remains safe to use without risk of information leakage or other unexpected
 * behaviour.
 */
const disableURLStaticMethods = () => {
	global.URL &&
		oDefineProperties(global.URL, {
			['createObjectURL']: {
				['writable']: true,
				['enumerable']: true,
				['configurable']: true,
				['value']: String.bind(null),
			},
			['revokeObjectURL']: {
				['writable']: true,
				['enumerable']: true,
				['configurable']: true,
				['value']: String.prototype.at.bind(''),
			},
		});
};

export default hardenGlobals;
export { disableURLStaticMethods };
