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

const inertConstructorProperty = (
	prototype: typeof Function.prototype,
	errorFnName: string,
) => {
	const inertConstructor = function () {
		throw new EvalError(`call to ${errorFnName}() blocked by CSP`);
	};
	const boundInertConstructor = inertConstructor.bind(globalThis);
	defineProperty(boundInertConstructor, 'name', {
		['value']: prototype.constructor.name,
		['writable']: false,
		['configurable']: true,
		['enumerable']: false,
	});
	defineProperty(boundInertConstructor, 'prototype', {
		['value']: prototype,
	});

	return {
		['value']: boundInertConstructor,
		['writable']: false,
		['configurable']: true,
		['enumerable']: false,
	};
};

const tameSetFns = (f: 'setTimeout' | 'setInterval') => {
	const feralFn = globalThis[f];
	const tamedFn = function (...args: Parameters<typeof feralFn>) {
		if (typeof args[0] !== 'function') {
			throw new EvalError(`call to eval() blocked by CSP`);
		}
		feralFn.apply(globalThis, args);
	};
	tamedFn.name = feralFn.name;

	defineProperty(globalThis, f, {
		value: tamedFn.bind(null),
	});
};

const {
	defineProperty,
	freeze,
	getOwnPropertyDescriptor,
	getPrototypeOf,
	setPrototypeOf,
} = Object;

const hardenGlobals = () => {
	const FERAL_FUNCTION = Function;

	const list = [
		'(function(){})',
		'(function*(){})',
		'(async function(){})',
		'(async function*(){})',
	]
		.map((source, i) => {
			try {
				return (0, eval)(source);
			} catch {
				if (i === 0)
					return function () {
						/**/
					};
			}
		})
		.filter(Boolean);

	try {
		// Attempt to tame function constructors
		list.forEach((fnIntrinsic) => {
			try {
				const prototype = getPrototypeOf(fnIntrinsic);
				const origConstructor = prototype.constructor;
				const constructorDescriptor = inertConstructorProperty(
					prototype,
					'Function',
				);
				defineProperty(prototype, 'constructor', constructorDescriptor);

				// Fix inheritance
				if (
					constructorDescriptor.value !==
					FERAL_FUNCTION.prototype.constructor
				) {
					setPrototypeOf(
						constructorDescriptor.value,
						FERAL_FUNCTION.prototype.constructor,
					);
				}

				// Replace globalThis['Function'], etc.
				if (
					getOwnPropertyDescriptor(globalThis, origConstructor.name)
						?.value === origConstructor
				) {
					defineProperty(
						globalThis,
						origConstructor.name,
						constructorDescriptor,
					);
				}
				freeze(prototype);
			} catch {
				// empty
			}
		});

		defineProperty(
			globalThis,
			'eval',
			inertConstructorProperty(getPrototypeOf(eval), 'eval'),
		);
		tameSetFns('setTimeout');
		tameSetFns('setInterval');
		freeze(getPrototypeOf(Object));
		freeze(Object);
	} catch (e) {
		if (e) {
			throw e;
		}
		void e;
	}
};

const disableURLStaticMethods = () => {
	Object.defineProperties(self.URL, {
		['createObjectURL']: {
			writable: true,
			enumerable: true,
			configurable: true,
			value: String.bind(null),
		},
		['revokeObjectURL']: {
			writable: true,
			enumerable: true,
			configurable: true,
			value: String.prototype.at.bind(''),
		},
	});
};

export default hardenGlobals;
export { disableURLStaticMethods };
