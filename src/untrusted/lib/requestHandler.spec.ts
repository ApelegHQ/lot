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

import '~/test/lib/buildTimeSettings.js';

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
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

		const ch = new MessageChannel();
		const op = 'add';
		const args = [2, 3];

		// Check that postMessage was called with the expected result message
		return new Promise<void>((resolve, reject) => {
			ch.port1.onmessage = (ev) => {
				try {
					assert.deepEqual(ev.data, [EMessageTypes.RESULT, 5]);
					resolve();
				} catch (e) {
					reject(e);
				}
			};
			ch.port1.onmessageerror = (ev) => {
				reject(ev.data);
			};
			requestHandler(ctx, ch.port2, op, ...args);
		});
	});

	it('should handle asynchronous task execution and send the result', () => {
		const ctx = {
			async asyncTask(v: string) {
				return new Promise((resolve) => {
					setTimeout(() => resolve('Async result: ' + v), 5);
				});
			},
		};

		const ch = new MessageChannel();
		const op = 'asyncTask';
		const args: unknown[] = ['a'];

		// Check that postMessage was called with the expected result message
		return new Promise<void>((resolve, reject) => {
			ch.port1.onmessage = (ev) => {
				try {
					assert.deepEqual(ev.data, [
						EMessageTypes.RESULT,
						'Async result: a',
					]);
					resolve();
				} catch (e) {
					reject(e);
				}
			};
			ch.port1.onmessageerror = (ev) => {
				reject(ev.data);
			};
			requestHandler(ctx, ch.port2, op, ...args);
		});
	});

	it('should handle an undefined operation and send an error message', () => {
		const ctx = {
			add: (a: number, b: number) => a + b,
		};

		const ch = new MessageChannel();

		// Operation 'subtract' is not defined in the context.
		const op = 'subtract';

		return new Promise<void>((resolve, reject) => {
			ch.port1.onmessage = (ev) => {
				try {
					assert.ok(Array.isArray(ev.data));
					assert.equal(ev.data.length, 2);
					assert.equal(ev.data[0], EMessageTypes.ERROR);

					assert.throws(
						() => {
							throw reconstructErrorInformation(
								(ev.data as unknown[])[1],
							);
						},
						{
							name: 'ReferenceError',
							message: `${op} is not defined`,
						},
					);

					resolve();
				} catch (e) {
					reject(e);
				}
			};
			ch.port1.onmessageerror = (ev) => {
				reject(ev.data);
			};

			requestHandler(ctx, ch.port2, op);
		}).finally(() => {
			assert.equal(postMessageStub.calls.length, 0);
		});
	});
});
