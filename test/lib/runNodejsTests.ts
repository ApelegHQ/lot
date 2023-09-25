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

import '~untrusted/lib/nodejsLoadWebcrypto.js'; // MUST BE AT THE TOP

import assertRejectsWithFactory from '@test/lib/assertRejectsWithFactory.js';
import baseTests from '@test/lib/baseTests.json';
import wrapper from '@test/lib/wrapper.js';
import assert from 'node:assert/strict';
import type { ISandbox } from '~/types/index.js';

const assertRejectsWith = assertRejectsWithFactory((predicate, c) =>
	assert.rejects(predicate, c),
);

const runNodejsTests = (name: string, m: ISandbox) => {
	describe(name, () => {
		describe('Can run tasks', async () => {
			it(
				'should return result for sync task',
				wrapper(async (signal) => {
					const sandbox = await m(
						'module.exports={foo:()=>"bar"}',
						null,
						null,
						signal,
					);
					const result = await sandbox('foo');
					assert.equal(result, 'bar');
				}),
			);

			it(
				'should return result for async task',
				wrapper(async (signal) => {
					const sandbox = await m(
						'module.exports={foo:()=>Promise.resolve("bar")}',
						null,
						null,
						signal,
					);
					const result = await sandbox('foo');
					assert.equal(result, 'bar');
				}),
			);

			it(
				'should return result for multiple arguments',
				wrapper(async (signal) => {
					const sandbox = await m(
						'module.exports={foo:(a,b)=>"bar"+b+a}',
						null,
						null,
						signal,
					);
					const result = await sandbox('foo', 'X', 'Y');
					assert.equal(result, 'barYX');
				}),
			);
		});

		describe('Error conditions', async () => {
			it(
				'invalid syntax causes error',
				wrapper((signal) => {
					const sandbox = m('\u0000', null, null, signal);
					return assertRejectsWith(sandbox, 'SyntaxError');
				}),
			);

			baseTests.forEach(([expression, errorName]: unknown[]) => {
				if (String(expression).includes('return')) return;
				it(
					`${expression} ${
						errorName === true
							? 'succeeds'
							: `causes error ${JSON.stringify(errorName)}`
					}`,
					wrapper((signal) => {
						const sandbox = m(
							String(expression),
							null,
							null,
							signal,
						);
						if (errorName === true) {
							return sandbox;
						} else if (
							typeof errorName === 'string' ||
							Array.isArray(errorName)
						) {
							return assertRejectsWith(sandbox, errorName);
						}
					}),
				);
			});

			baseTests.forEach(([expression, errorName]: unknown[]) => {
				it(
					`Task with ${expression} ${
						errorName === true
							? 'succeeds'
							: `causes error ${JSON.stringify(errorName)}`
					}`,
					wrapper((signal) => {
						const sandbox = m(
							`module.exports={foo:function(){${expression}}}`,
							null,
							null,
							signal,
						);
						if (errorName === 'SyntaxError') {
							return assertRejectsWith(sandbox, errorName);
						} else {
							return sandbox.then((r) => {
								const t = r('foo');
								if (
									typeof errorName === 'string' ||
									Array.isArray(errorName)
								) {
									return assertRejectsWith(t, errorName);
								}
								return t;
							});
						}
					}),
				);
			});
		});
	});
};

export default runNodejsTests;
