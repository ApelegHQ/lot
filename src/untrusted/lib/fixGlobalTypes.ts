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

/**
 * Ensures that global type constructors (e.g., Object, Array, String, etc.)
 * and related error classes are set to expected values, fixing them if
 * necessary.
 *
 * The function checks various global constructors (Object, Array, String,
 * Number, Boolean, Function, BigInt, Symbol, and some error classes) and makes
 * sure that they are of the correct type and correspond to expected behaviuors.
 * If not, it uses Object.defineProperty to overwrite the incorrect values with
 * the expected constructors.
 *
 * Additionally, this function tests specific error conditions (e.g.,
 * RangeError, URIError) and ensures that they are defined correctly.
 *
 * The process includes:
 * 1. Ensuring basic type constructors (Object, Array, String, Number, Boolean,
 * Function) match expectations.
 * 2. Verifying and correcting BigInt and Symbol constructors if available.
 * 3. Testing and ensuring the RangeError and URIError classes through specific
 * error-triggering conditions.
 * 4. Making sure the Error class and its prototype match expected values.
 * 5. Defining or fixing the EvalError class and handling the 'eval' function
 * based on the environment.
 * 6. Additional handling could be extended for other error types or global
 * constructs.
 *
 * Note: The function relies on `__buildtimeSettings__.fixGlobalTypes`, and if this flag is not set, the function returns without making any changes.
 */
const fixGlobalTypes = () => {
	if (!__buildtimeSettings__.fixGlobalTypes) return;

	const defineProperty = ({}.constructor as typeof Object)['defineProperty'];

	// Fix global types
	if (typeof Object !== 'function' || {}.constructor !== Object) {
		defineProperty(globalThis, 'Object', {
			['configurable']: true,
			['writable']: true,
			['value']: {}.constructor,
		});
	}
	if (typeof Array !== 'function' || [].constructor !== Array) {
		defineProperty(globalThis, 'Array', {
			['configurable']: true,
			['writable']: true,
			['value']: [].constructor,
		});
	}
	if (typeof String !== 'function' || ''.constructor !== String) {
		defineProperty(globalThis, 'String', {
			['configurable']: true,
			['writable']: true,
			['value']: ''.constructor,
		});
	}
	if (typeof Number !== 'function' || (0).constructor !== Number) {
		defineProperty(globalThis, 'Number', {
			['configurable']: true,
			['writable']: true,
			['value']: (0).constructor,
		});
	}
	if (typeof Boolean !== 'function' || (!0).constructor !== Boolean) {
		defineProperty(globalThis, 'Boolean', {
			['configurable']: true,
			['writable']: true,
			['value']: (!0).constructor,
		});
	}
	if (
		typeof Function !== 'function' ||
		function () {
			/* empty */
		}.constructor !== Function
	) {
		defineProperty(globalThis, 'Function', {
			['configurable']: true,
			['writable']: true,
			['value']: function () {
				/* empty */
			}.constructor,
		});
	}
	if (
		typeof BigInt === 'function' &&
		typeof BigInt(0) === 'bigint' &&
		BigInt(0).constructor !== BigInt
	) {
		defineProperty(globalThis, 'BigInt', {
			['configurable']: true,
			['writable']: true,
			['value']: BigInt(0).constructor,
		});
	}
	if (
		typeof Symbol === 'function' &&
		typeof Symbol() === 'symbol' &&
		Symbol().constructor !== Symbol
	) {
		defineProperty(globalThis, 'Symbol', {
			['configurable']: true,
			['writable']: true,
			['value']: Symbol().constructor,
		});
	}

	try {
		[].constructor(-1);
	} catch (e) {
		if (e) {
			if (
				typeof RangeError !== 'function' ||
				!(e instanceof RangeError)
			) {
				defineProperty(globalThis, 'RangeError', {
					['configurable']: true,
					['writable']: true,
					['value']: (e as RangeError).constructor,
				});
			}
		}
	}

	try {
		typeof decodeURI === 'function' && void decodeURI('%');
	} catch (e) {
		if (e) {
			if (typeof URIError !== 'function' || !(e instanceof URIError)) {
				defineProperty(globalThis, 'URIError', {
					['configurable']: true,
					['writable']: true,
					['value']: (e as URIError).constructor,
				});
			}
		}
	}

	if (
		typeof Error !== 'function' ||
		Object.getPrototypeOf(RangeError) !== Error
	) {
		defineProperty(globalThis, 'Error', {
			configurable: true,
			writable: true,
			value: Object.getPrototypeOf(RangeError),
		});
	}

	if (typeof EvalError !== 'function') {
		const evalErrorFn: ErrorConstructor = function (
			this: unknown,
			message?: string,
		) {
			if (!(this instanceof evalErrorFn)) {
				return new evalErrorFn(message);
			}
			if (message) {
				this.message = message;
			}
			return this;
		} as unknown as ErrorConstructor;
		evalErrorFn.prototype.message = '';
		evalErrorFn.prototype.name = 'EvalError';
		Object.setPrototypeOf(evalErrorFn.prototype, Error.prototype);
		defineProperty(globalThis, 'EvalError', {
			['configurable']: true,
			['writable']: true,
			['value']: evalErrorFn,
		});
	}

	// Missing errors: AggregateError, ReferenceError, SyntaxError
	// Other missing: Promise

	if (typeof eval !== 'function') {
		const fn = function () {
			throw new EvalError('call to eval() blocked by CSP');
		}.bind({});
		defineProperty(fn, 'name', {
			['configurable']: true,
			['value']: 'eval',
		});
		defineProperty(globalThis, 'eval', {
			['configurable']: true,
			['writable']: true,
			['value']: fn,
		});
	}
};

export default fixGlobalTypes;
