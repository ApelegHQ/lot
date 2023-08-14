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

if (typeof __buildtimeSettings__ !== 'object')
	Reflect.set(globalThis, '__buildtimeSettings__', {});

Reflect.set(__buildtimeSettings__, 'buildType', 'debug');

import assert from 'node:assert/strict';
import { reconstructErrorInformation } from './errorModem.js';
import requestHandler from './requestHandler.js';

describe('requestHandler', () => {
	let postMessageStub: {
		(...args: unknown[]): void;
		calls: {
			args: unknown[];
		}[];
	};

	beforeEach(() => {
		postMessageStub = ((...args: unknown[]) => {
			postMessageStub.calls.push({ args });
		}) as unknown as typeof postMessageStub;
		postMessageStub.calls = [];
	});

	afterEach(() => {
		// sinon.restore();
	});

	it('should handle synchronous task execution and send the result', () => {
		const ctx = {
			add: (a: number, b: number) => a + b,
			multiply: (a: number, b: number) => a * b,
		};

		const id = 'task123';
		const op = 'add';
		const args = [2, 3];

		requestHandler(postMessageStub, ctx, id, op, ...args);

		// Check that postMessage was called with the expected result message
		assert.deepEqual(postMessageStub.calls, [
			{ args: [[EMessageTypes.RESULT, id, 5]] },
		]);
	});

	it('should handle asynchronous task execution and send the result', async () => {
		const ctx = {
			async asyncTask(v: string) {
				return new Promise((resolve) => {
					setTimeout(() => resolve('Async result: ' + v), 5);
				});
			},
		};

		const id = 'task456';
		const op = 'asyncTask';
		const args: unknown[] = ['a'];

		requestHandler(postMessageStub, ctx, id, op, ...args);

		// Wait for the asynchronous result to be sent via postMessage
		await new Promise((resolve) => setTimeout(resolve, 40));

		// Check that postMessage was called with the expected result message
		assert.deepEqual(postMessageStub.calls, [
			{ args: [[EMessageTypes.RESULT, id, 'Async result: a']] },
		]);
	});

	it('should handle an undefined operation and send an error message', () => {
		const ctx = {
			add: (a: number, b: number) => a + b,
		};

		const id = 'task789';

		// Operation 'subtract' is not defined in the context.
		const op = 'subtract';

		requestHandler(postMessageStub, ctx, id, op);

		assert.equal(postMessageStub.calls.length, 1);
		assert.equal(postMessageStub.calls[0].args.length, 1);
		assert.ok(Array.isArray(postMessageStub.calls[0].args[0]));
		assert.equal((postMessageStub.calls[0].args[0] as unknown[]).length, 3);
		assert.deepEqual(
			(postMessageStub.calls[0].args[0] as unknown[]).slice(0, 2),
			[EMessageTypes.ERROR, id],
		);
		assert.ok(Array.isArray(postMessageStub.calls[0].args[0][2]));
		assert.throws(
			() => {
				throw reconstructErrorInformation(
					(postMessageStub.calls[0].args[0] as unknown[])[2],
				);
			},
			{
				name: 'ReferenceError',
				message: `${op} is not defined`,
			},
		);
	});
});
