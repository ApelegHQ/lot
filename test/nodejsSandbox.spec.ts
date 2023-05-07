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
import { nodejsSandbox as m } from '../dist/index';

describe('Node.js', () => {
	describe('Can run tasks', () => {
		it('should return result for sync task', async () => {
			const sandbox = await m('module.exports={foo:()=>"bar"}');
			const result = await sandbox('foo');
			assert.equal(result, 'bar');
		});

		it('should return result for async task', async () => {
			const sandbox = await m(
				'module.exports={foo:()=>Promise.resolve("bar")}',
			);
			const result = await sandbox('foo');
			assert.equal(result, 'bar');
		});
	});
	describe('Error conditions', () => {
		it('invalid syntax causes error', async () => {
			const sandbox = m('%');
			assert.rejects(sandbox);
		});

		const SUCCESS = Symbol();

		const tests: [string, string | typeof SUCCESS][] = [
			['""', SUCCESS],
			['%', 'SyntaxError'],
			['eval("")', 'EvalError'],
			['clearTimeout(setTimeout("", 1000))', 'EvalError'],
			['clearInterval(setInterval("", 1000))', 'EvalError'],
			['clearTimeout(setTimeout(Boolean, 1000))', SUCCESS],
			// This causes the tests to hang
			// ['clearInterval(setInterval(Boolean, 1000))', SUCCESS],
			['Function("")', 'EvalError'],
			['new Function("")', 'EvalError'],
			['(()=>{}).constructor("")', 'EvalError'],
			['new ((()=>{}).constructor)("")', 'EvalError'],
			['(async ()=>{}).constructor("")', 'EvalError'],
			['new ((async ()=>{}).constructor)("")', 'EvalError'],
			['(function* (){}).constructor("")', 'EvalError'],
			['new ((function* (){}).constructor)("")', 'EvalError'],
			['(async function* (){}).constructor("")', 'EvalError'],
			['new ((async function* (){}).constructor)("")', 'EvalError'],
			['TextEncoder.constructor("")', 'EvalError'],
			['new (TextEncoder.constructor)("")', 'EvalError'],
			['TextEncoder.constructor.bind(TextEncoder)("")', 'EvalError'],
			[
				'Function.prototype.bind.call(TextEncoder.constructor, TextEncoder)("")',
				'EvalError',
			],
			['class x extends Boolean.constructor{};new x()', 'EvalError'],
			['class x extends Boolean{};new x()', SUCCESS],
			['class x extends TextEncoder.constructor{}', 'TypeError'],
			['class x extends URL.constructor{}', 'TypeError'],
			// These fail because of prototype being non-writable and non-configurable, even though perhaps they should succeed
			// ['class x extends TextEncoder{}', SUCCESS],
			// ['class x extends URL{}', SUCCESS],
		];

		tests.forEach(([expression, errorName]) => {
			it(`${expression} ${
				errorName === SUCCESS
					? 'succeeds'
					: `causes error ${JSON.stringify(errorName)}`
			}`, async () => {
				const sandbox = m(expression);
				if (errorName === SUCCESS) {
					await assert.doesNotReject(sandbox);
				} else {
					await assert.rejects(sandbox, { name: errorName });
				}
			});
		});

		tests.forEach(([expression, errorName]) => {
			it(`Task with ${expression} ${
				errorName === SUCCESS
					? 'succeeds'
					: `causes error ${JSON.stringify(errorName)}`
			}`, async () => {
				const sandbox = m(`module.exports={foo:()=>{${expression}}}`);
				if (errorName === 'SyntaxError') {
					await assert.rejects(sandbox, { name: errorName });
				} else {
					const result = (await sandbox)('foo');
					if (errorName === SUCCESS) {
						await assert.doesNotReject(result);
					} else {
						await assert.rejects(result, { name: errorName });
					}
				}
			});
		});
	});
});
