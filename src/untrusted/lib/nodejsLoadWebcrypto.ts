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

// Node.js version 18 and lower don't have globalThis.crypto defined
// by default
if (
	typeof process === 'object' &&
	process !== null &&
	/^v(\d+)\./.test(process.version) &&
	parseInt(process.version.slice(1)) <= 18 &&
	!('crypto' in globalThis) &&
	typeof require === 'function'
) {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const webcrypto = require('node:crypto')['webcrypto'];
	if (webcrypto) {
		Object.defineProperty(globalThis, 'crypto', {
			['enumerable']: true,
			['configurable']: true,
			['get']: () => webcrypto,
		});
	}
}
