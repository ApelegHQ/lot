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

/// <reference types="deno-types" />

import m from '@dist/exports/worker.mjs';

import * as assert from 'https://deno.land/std@0.197.0/testing/asserts.ts';
import assertRejectsWithFactory from '@test/lib/assertRejectsWithFactory.ts';
import baseTests from '@test/lib/baseTests.json' assert { type: 'json' };
import wrapper from '@test/lib/wrapper.ts';

const assertRejectsWith = assertRejectsWithFactory((predicate, c) =>
	assert.assertRejects(() => predicate, c),
);

Deno.test('Deno', async (t) => {
	await t.step('Can run tasks', async (t) => {
		await t.step(
			'should return result for sync task',
			wrapper(async (signal) => {
				const sandbox = await m(
					'module.exports={foo:()=>"bar"}',
					null,
					null,
					signal,
					{ workerType: 'module' },
				);
				const result = await sandbox('foo');
				assert.assertEquals(result, 'bar');
			}),
		);

		await t.step(
			'should return result for async task',
			wrapper(async (signal) => {
				const sandbox = await m(
					'module.exports={foo:()=>Promise.resolve("bar")}',
					null,
					null,
					signal,
					{ workerType: 'module' },
				);
				const result = await sandbox('foo');
				assert.assertEquals(result, 'bar');
			}),
		);

		await t.step(
			'should return result for multiple arguments',
			wrapper(async (signal) => {
				const sandbox = await m(
					'module.exports={foo:(a,b)=>"bar"+b+a}',
					null,
					null,
					signal,
					{ workerType: 'module' },
				);
				const result = await sandbox('foo', 'X', 'Y');
				assert.assertEquals(result, 'barYX');
			}),
		);
	});

	await t.step('Error conditions', async (t) => {
		await t.step(
			'invalid syntax causes error',
			wrapper((signal) => {
				const sandbox = m('\u0000', null, null, signal, {
					workerType: 'module',
				});
				return assertRejectsWith(sandbox, 'SyntaxError');
			}),
		);

		for (const test of baseTests.map(
			([expression, errorName]: unknown[]) =>
				async () => {
					if (String(expression).includes('return')) return;
					await t.step(
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
								{ workerType: 'module' },
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
				},
		)) {
			await test();
		}

		for (const test of baseTests.map(
			([expression, errorName]: unknown[]) =>
				async () => {
					await t.step(
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
								{ workerType: 'module' },
							);
							if (errorName === 'SyntaxError') {
								return assertRejectsWith(sandbox, errorName);
							} else {
								return sandbox.then(
									(r: { (s: string): Promise<unknown> }) => {
										const t = r('foo');
										if (
											typeof errorName === 'string' ||
											Array.isArray(errorName)
										) {
											return assertRejectsWith(
												t,
												errorName,
											);
										}
										return t;
									},
								);
							}
						}),
					);
				},
		)) {
			await test();
		}
	});
});
