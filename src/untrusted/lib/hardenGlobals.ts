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

import global from './global.js';
import {
	EE,
	aFilter,
	aForEach,
	aMap,
	oDefineProperties,
	oDefineProperty,
	oFreeze,
	oGetOwnPropertyDescriptor,
	oGetPrototypeOf,
	oSetPrototypeOf,
} from './utils.js';

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

const tameSetTimerFn = (f: 'setTimeout' | 'setInterval') => {
	const feralFn = global[f];

	if (typeof feralFn !== 'function') return;

	const tamedFn = function (...args: Parameters<typeof feralFn>) {
		if (typeof args[0] !== 'function') {
			throw EE(`call to eval() blocked by CSP`);
		}
		feralFn.apply(global, args);
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

const disableURLStaticMethods = () => {
	global.URL &&
		oDefineProperties(global.URL, {
			['createObjectURL']: {
				['writable']: true,
				enumerable: true,
				['configurable']: true,
				['value']: String.bind(null),
			},
			['revokeObjectURL']: {
				['writable']: true,
				enumerable: true,
				['configurable']: true,
				['value']: String.prototype.at.bind(''),
			},
		});
};

export default hardenGlobals;
export { disableURLStaticMethods };
