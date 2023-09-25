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

import runNodejsTests from '@test/lib/runNodejsTests.js';

import * as bare from '@dist/exports/bare';

// TODO: Import from '@dist/exports/bare'
import { hardenGlobals, freezePrototypes } from '@dist/index.js';

hardenGlobals();

// See <https://github.com/nodejs/node/issues/49259>
if (process.version) {
	const [major, minor] = process.version
		.slice(1)
		.split('.', 2)
		.map((n) => parseInt(n));
	if (
		(major === 18 && minor >= 18) ||
		(major === 20 && minor >= 6) ||
		major > 20
	) {
		freezePrototypes();
	}
}

runNodejsTests('Bare', bare.default);
