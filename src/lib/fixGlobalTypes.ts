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
	// Fix global types
	if (typeof Object !== 'function' || {}.constructor !== Object) {
		(({}).constructor as typeof Object).defineProperty(
			globalThis,
			'Object',
			{
				configurable: true,
				writable: true,
				value: {}.constructor,
			},
		);
	}
	if (typeof String !== 'function' || ''.constructor !== String) {
		Object.defineProperty(globalThis, 'String', {
			configurable: true,
			writable: true,
			value: ''.constructor,
		});
	}
	if (typeof Number !== 'function' || (0).constructor !== Number) {
		Object.defineProperty(globalThis, 'Number', {
			configurable: true,
			writable: true,
			value: (0).constructor,
		});
	}
	if (typeof Boolean !== 'function' || (!0).constructor !== Boolean) {
		Object.defineProperty(globalThis, 'Boolean', {
			configurable: true,
			writable: true,
			value: (!0).constructor,
		});
	}
	if (
		typeof Function !== 'function' ||
		function () {
			/* empty */
		}.constructor !== Boolean
	) {
		Object.defineProperty(globalThis, 'Function', {
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
		Object.defineProperty(globalThis, 'BigInt', {
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
		Object.defineProperty(globalThis, 'Symbol', {
			configurable: true,
			writable: true,
			value: Symbol().constructor,
		});
	}
};

export default fixGlobalTypes;
