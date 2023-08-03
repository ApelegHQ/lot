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
import { nodejsSandbox as m } from '../../../dist/index';
import baseTests from '../../lib/baseTests.json';

describe('Node.js', () => {
	const controller = new AbortController();
	const signal = controller.signal;

	after(async function () {
		controller.abort();
	});

	describe('Can run tasks', () => {
		it('should return result for sync task', async () => {
			const sandbox = await m(
				'module.exports={foo:()=>"bar"}',
				null,
				null,
				signal,
			);
			const result = await sandbox('foo');
			assert.equal(result, 'bar');
		});

		it('should return result for async task', async () => {
			const sandbox = await m(
				'module.exports={foo:()=>Promise.resolve("bar")}',
				null,
				null,
				signal,
			);
			const result = await sandbox('foo');
			assert.equal(result, 'bar');
		});

		it('should return result for multiple arguments', async () => {
			const sandbox = await m(
				'module.exports={foo:(a,b)=>"bar"+b+a}',
				null,
				null,
				signal,
			);
			const result = await sandbox('foo', 'X', 'Y');
			assert.equal(result, 'barYX');
		});
	});
	describe('Error conditions', () => {
		it('invalid syntax causes error', async () => {
			const sandbox = m('\u0000', null, null, signal);
			await assert.rejects(sandbox);
		});

		baseTests.forEach(([expression, errorName]: unknown[]) => {
			if (String(expression).includes('return')) return;
			it(`${expression} ${
				errorName === true
					? 'succeeds'
					: `causes error ${JSON.stringify(errorName)}`
			}`, async () => {
				const sandbox = m(String(expression), null, null, signal);
				if (errorName === true) {
					await assert.doesNotReject(sandbox);
				} else {
					await assert.rejects(sandbox, {
						name:
							// TODO: Handle this in a different
							// way. ReferenceError only happens
							// when not using globalProxy
							errorName === 'ReferenceError'
								? 'TypeError'
								: errorName,
					});
				}
			});
		});

		baseTests.forEach(([expression, errorName]: unknown[]) => {
			it(`Task with ${expression} ${
				errorName === true
					? 'succeeds'
					: `causes error ${JSON.stringify(errorName)}`
			}`, async () => {
				const sandbox = m(
					`module.exports={foo:function(){${expression}}}`,
					null,
					null,
					signal,
				);
				if (errorName === 'SyntaxError') {
					await assert.rejects(sandbox, { name: errorName });
				} else {
					const result = (await sandbox)('foo');
					if (errorName === true) {
						await assert.doesNotReject(result);
					} else {
						await assert.rejects(result, {
							name:
								// TODO: Handle this in a different
								// way. ReferenceError only happens
								// when not using globalProxy
								errorName === 'ReferenceError'
									? 'TypeError'
									: errorName,
						});
					}
				}
			});
		});
	});
});
