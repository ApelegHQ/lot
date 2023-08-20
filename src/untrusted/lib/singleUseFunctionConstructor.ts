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
 * A proxy for the `Function` constructor that becomes unusable after a
 * single use.
 *
 * - If it is invoked as a function (e.g., `singleUseFunctionConstructor(...)`,
 * it behaves like the `Function` constructor, then immediately revokes itself
 * after the function has been called.
 * - If it is invoked using the `new` keyword (e.g.,
 * `new singleUseFunctionConstructor(...)`, it behaves like the `Function`
 * constructor, then immediately revokes itself after function instantiated has
 * been called.
 *
 * @returns {Function} A revocable version of the native `Function` constructor.
 *
 * const myFunction = singleUseFunctionConstructor("x", "return x * 2");
 * console.log(myFunction(5)); // Outputs: 10
 *
 * // Any subsequent attempts to use myFunction will throw an error
 */
const singleUseFunctionConstructor = (() => {
	const FERAL_FUNCTION = Proxy.revocable(Function, {});

	const revocables: { (): void }[] = [];

	const p = <T extends typeof Function.prototype>(o: T) =>
		Proxy.revocable(o, {
			['apply'](target, thisArg, argArray) {
				FERAL_FUNCTION.revoke();
				for (let i = 0; i < revocables.length; i++) {
					revocables[i]();
				}
				revocables.length = 0;
				const result = target.apply(thisArg, argArray);
				return result;
			},
			['construct']() {
				return undefined as unknown as object;
			},
			['getOwnPropertyDescriptor']() {
				return undefined;
			},
			['getPrototypeOf']() {
				return null;
			},
		});

	return new Proxy(FERAL_FUNCTION.proxy, {
		['apply'](target, thisArg, argArray) {
			const r = p(target.apply(thisArg, argArray));
			revocables[revocables.length] = r.revoke;
			return r.proxy;
		},
		['construct'](target, argArray) {
			const r = p(new target(...argArray));
			revocables[revocables.length] = r.revoke;
			return r.proxy;
		},
		['get']() {
			return undefined;
		},
		['getOwnPropertyDescriptor']() {
			return undefined;
		},
		['getPrototypeOf']() {
			return null;
		},
	});
})();

export default singleUseFunctionConstructor;
