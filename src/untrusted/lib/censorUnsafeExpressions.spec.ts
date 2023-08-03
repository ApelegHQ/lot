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

import assert from 'node:assert/strict';
import censorUnsafeExpressions from './censorUnsafeExpressions.js';

const testCases: [string, boolean][] = [
	// Import as identifier should always be allowed
	['{ let foo = { "import": "bar" }; foo.import; }', true],
	['{ let foo = { "import": ()=>"bar" }; foo.import(""); }', true],
	['{ let foo = { import() {return "bar"} }; foo.import (); }', true],
	['{ let foo = { import () {return "bar"} }; foo.import(); }', true],
	// Import can be a substring
	['var important="value"', true],
	[
		'(function(){ function important() {return "work"}; important(); })()',
		true,
	],
	// Import as keyword should always fail
	['import("data:text/javascript,")', false],
	[' import("data:text/javascript,")', false],
	['import ("data:text/javascript,")', false],
	[' import ("data:text/javascript,")', false],
	['{ let foo = { ...import ("data:text/javascript,") } }', false],
	['{ let foo = { ...import("data:text/javascript,") } }', false],
	['import * as test from "data:text/javascript,"', false],
	[' import * as test from "data:text/javascript,"', false],
];

describe('Censor unsafe expressions', () => {
	describe('Correctly censors import', () => {
		testCases.forEach(([code, expectation]) => {
			it(`\`${code}\` ${expectation ? 'succeeds' : 'fails'}`, () => {
				const censored = censorUnsafeExpressions(code);

				if (/\bimport\b/.test(censored)) {
					// /\.import/ is allowed but /\.{2,}import/ is not
					const joinStr =
						'(---MAYBE OK IMPORT @' + String(Date.now()) + '---)';
					const temp = censored.split('.import');

					assert.ok(
						!temp.includes('import') &&
							!temp.includes('.' + joinStr),
					);
				}

				const expression = () => (0, eval)(censored);

				if (expectation) {
					assert.doesNotThrow(expression);
				} else {
					assert.throws(expression, {
						name: 'SyntaxError',
						message: /Keyword.*escaped/,
					});
				}
			});
		});
	});
});
