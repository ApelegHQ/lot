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

const fixGlobalTypes = () => {
	if (!__buildtimeSettings__.fixGlobalTypes) return;

	const defineProperty = ({}.constructor as typeof Object)['defineProperty'];

	// Fix global types
	if (typeof Object !== 'function' || {}.constructor !== Object) {
		defineProperty(globalThis, 'Object', {
			configurable: true,
			writable: true,
			value: {}.constructor,
		});
	}
	if (typeof Array !== 'function' || [].constructor !== Array) {
		defineProperty(globalThis, 'Array', {
			configurable: true,
			writable: true,
			value: [].constructor,
		});
	}
	if (typeof String !== 'function' || ''.constructor !== String) {
		defineProperty(globalThis, 'String', {
			configurable: true,
			writable: true,
			value: ''.constructor,
		});
	}
	if (typeof Number !== 'function' || (0).constructor !== Number) {
		defineProperty(globalThis, 'Number', {
			configurable: true,
			writable: true,
			value: (0).constructor,
		});
	}
	if (typeof Boolean !== 'function' || (!0).constructor !== Boolean) {
		defineProperty(globalThis, 'Boolean', {
			configurable: true,
			writable: true,
			value: (!0).constructor,
		});
	}
	if (
		typeof Function !== 'function' ||
		function () {
			/* empty */
		}.constructor !== Function
	) {
		defineProperty(globalThis, 'Function', {
			configurable: true,
			writable: true,
			value: function () {
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
			configurable: true,
			writable: true,
			value: BigInt(0).constructor,
		});
	}
	if (
		typeof Symbol === 'function' &&
		typeof Symbol() === 'symbol' &&
		Symbol().constructor !== Symbol
	) {
		defineProperty(globalThis, 'Symbol', {
			configurable: true,
			writable: true,
			value: Symbol().constructor,
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
					configurable: true,
					writable: true,
					value: (e as RangeError).constructor,
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
					configurable: true,
					writable: true,
					value: (e as URIError).constructor,
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

	// Missing: AggregateError, ReferenceError, SyntaxError

	if (typeof EvalError !== 'function') {
		const evalErrorFn: EvalErrorConstructor = function (
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
		} as unknown as EvalErrorConstructor;
		evalErrorFn.prototype.message = '';
		evalErrorFn.prototype.name = 'EvalError';
		Object.setPrototypeOf(evalErrorFn.prototype, Error.prototype);
		defineProperty(globalThis, 'EvalError', {
			configurable: true,
			writable: true,
			value: evalErrorFn,
		});
	}

	if (typeof eval !== 'function') {
		const fn = function () {
			throw new EvalError(`call to eval() blocked by CSP`);
		}.bind({});
		Object.defineProperty(fn, 'name', {
			configurable: true,
			value: 'eval',
		});
		defineProperty(globalThis, 'eval', {
			configurable: true,
			writable: true,
			value: fn,
		});
	}
};

export default fixGlobalTypes;
