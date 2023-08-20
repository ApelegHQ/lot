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

const redefineGlobal = (() => {
	const defineProperty = ({}.constructor as typeof Object)['defineProperty'];
	const getOwnPropertyDescriptor = ({}.constructor as typeof Object)[
		'getOwnPropertyDescriptor'
	];

	if (
		typeof defineProperty !== 'function' ||
		typeof getOwnPropertyDescriptor !== 'function'
	) {
		return;
	}

	return (p: string, v: unknown, bindAndRename?: boolean) => {
		if (bindAndRename) {
			try {
				v = (v as typeof Function.prototype).bind(globalThis);
				defineProperty(v, 'name', { ['value']: v });
			} catch {
				// empty
			}
		}

		try {
			const d = getOwnPropertyDescriptor(globalThis, p);
			if (!d) {
				defineProperty(globalThis, p, {
					['configurable']: true,
					['writable']: true,
					['value']: v,
				});
			} else if (d['configurable'] || d['writable']) {
				defineProperty(globalThis, p, {
					['value']: v,
				});
			}
		} catch {
			// empty
		}
	};
})();

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
	if (!__buildtimeSettings__.fixGlobalTypes || !redefineGlobal) return;

	const realObject = {}.constructor as ObjectConstructor;

	// Fix global types
	if (typeof Object !== 'function' || realObject !== Object) {
		redefineGlobal('Object', realObject);
	}
	if (typeof Array !== 'function' || [].constructor !== Array) {
		redefineGlobal('Array', [].constructor);
	}
	if (typeof String !== 'function' || ''.constructor !== String) {
		redefineGlobal('String', ''.constructor);
	}
	if (typeof Number !== 'function' || (0).constructor !== Number) {
		redefineGlobal('Number', (0).constructor);
	}
	if (typeof Boolean !== 'function' || (!0).constructor !== Boolean) {
		redefineGlobal('Boolean', (!0).constructor);
	}
	if (
		typeof Function !== 'function' ||
		function () {
			/* empty */
		}.constructor !== Function
	) {
		redefineGlobal(
			'Function',
			function () {
				/* empty */
			}.constructor,
		);
	}
	if (
		typeof BigInt === 'function' &&
		typeof BigInt(0) === 'bigint' &&
		BigInt(0).constructor !== BigInt
	) {
		redefineGlobal('BigInt', BigInt(0).constructor);
	}
	if (
		typeof Symbol === 'function' &&
		typeof Symbol() === 'symbol' &&
		Symbol().constructor !== Symbol
	) {
		redefineGlobal('Symbol', Symbol().constructor);
	}

	try {
		[].constructor(-1);
	} catch (e) {
		if (e) {
			if (
				typeof RangeError !== 'function' ||
				!(e instanceof RangeError)
			) {
				redefineGlobal('RangeError', (e as RangeError).constructor);
			}
		}
	}

	try {
		typeof decodeURI === 'function' && void decodeURI('%');
	} catch (e) {
		if (e) {
			if (typeof URIError !== 'function' || !(e instanceof URIError)) {
				redefineGlobal('URIError', (e as URIError).constructor);
			}
		}
	}

	if (
		typeof Error !== 'function' ||
		(typeof realObject.getPrototypeOf === 'function' &&
			realObject.getPrototypeOf(RangeError) !== Error)
	) {
		redefineGlobal('Error', realObject.getPrototypeOf(RangeError));
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
		try {
			evalErrorFn.prototype.message = '';
			evalErrorFn.prototype.name = 'EvalError';
			realObject.setPrototypeOf(evalErrorFn.prototype, Error.prototype);
		} catch {
			// empty
		}
		redefineGlobal('EvalError', evalErrorFn);
	}

	// Missing errors: AggregateError, ReferenceError, SyntaxError
	// Other missing: Promise

	if (typeof eval !== 'function') {
		const fn = function () {
			throw new EvalError('call to eval() blocked by CSP');
		}.bind(globalThis);
		redefineGlobal('eval', fn, true);
	}
};

export default fixGlobalTypes;
