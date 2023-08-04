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

const assertRejectsWithFactory =
	<TT>(assert: { (predicate: Promise<TT>, e: ErrorConstructor): unknown }) =>
	(predicate: Promise<TT>, errorName: string | string[]) => {
		if (!Array.isArray(errorName)) errorName = [errorName];

		const errorClass = errorName.map((n) =>
			(n in globalThis &&
				typeof globalThis[n as keyof typeof globalThis] ===
					'function' &&
				(
					globalThis[
						n as keyof typeof globalThis
					] as unknown as typeof Function.prototype
				).prototype instanceof Error) ||
			globalThis[n as keyof typeof globalThis] === Error
				? (globalThis[
						n as unknown as keyof typeof globalThis
				  ] as unknown as ErrorConstructor)
				: Error,
		);

		const mapper = <TU extends ErrorConstructor>(c: TU) =>
			assert(predicate, c);

		if (errorClass.length === 1) {
			return mapper(errorClass[0]);
		}

		return Promise.any(errorClass.map(mapper));
	};

export default assertRejectsWithFactory;
