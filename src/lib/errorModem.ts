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

const MAX_DEPTH = 3;

const extractErrorInformation = (e: unknown, depth?: number) => {
	if (!['object', 'function'].includes(typeof e)) {
		return e;
	} else if (
		e instanceof Error ||
		Object.prototype.hasOwnProperty.call(e, 'stack')
	) {
		const d: unknown[] = [
			(e as Error).name && String((e as Error).name),
			(e as Error).message && String((e as Error).message),
			String((e as Error).stack),
		].map(String);

		if (
			(!depth || depth < MAX_DEPTH) &&
			Object.prototype.hasOwnProperty.call(e, 'cause')
		) {
			d[3] = extractErrorInformation(
				(e as Error & { cause: unknown })['cause'],
				depth ? depth + 1 : 1,
			);
		}

		return d;
	} else {
		return String(e);
	}
};

const reconstructErrorInformation = (d: unknown, depth?: number) => {
	if (
		Array.isArray(d) &&
		d.length &&
		(d.length === 3 || d.length === 4) &&
		typeof d[2] === 'string'
	) {
		const errorClass =
			Object.prototype.hasOwnProperty.call(
				globalThis,
				d[0] as PropertyKey,
			) &&
			typeof globalThis[d[0] as 'Error'] === 'function' &&
			globalThis[d[0] as 'Error'].prototype instanceof Error
				? globalThis[d[0] as 'Error']
				: Error;

		const e = Object.create(errorClass.prototype);

		if (d[0] !== errorClass.name) {
			Object.defineProperty(e, 'name', {
				configurable: true,
				writable: true,
				value: String(d[0]),
			});
		}
		if (d[1]) {
			Object.defineProperty(e, 'message', {
				configurable: true,
				writable: true,
				value: String(d[1]),
			});
		}
		Object.defineProperty(e, 'stack', {
			configurable: true,
			writable: true,
			value: String(d[2]),
		});
		if ((!depth || depth < MAX_DEPTH) && d.length === 4) {
			Object.defineProperty(e, 'cause', {
				configurable: true,
				writable: true,
				value: reconstructErrorInformation(d[3], depth ? depth + 1 : 1),
			});
		}

		return e;
	}

	return d;
};

export { extractErrorInformation, reconstructErrorInformation };
