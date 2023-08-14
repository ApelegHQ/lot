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
import postMessageWrapper from './postMessageWrapper.js';

describe('postMessageWrapper', () => {
	let mockPostMessage: {
		fn: MessagePort['postMessage'];
		sender: { (): void };
		calls: unknown[];
	};
	let wrappedFunction: MessagePort['postMessage'];

	beforeEach(() => {
		// Reset the mock function before each test
		mockPostMessage = {
			calls: [],
			sender: Boolean,
			fn(data) {
				this.sender();
				this.calls.push(data);
			},
		};
		wrappedFunction = postMessageWrapper(
			mockPostMessage.fn.bind(mockPostMessage),
		);
	});

	it('should successfully call postMessage with provided data', () => {
		wrappedFunction(['some data']);

		assert.deepEqual(mockPostMessage.calls, [['some data']]);
	});

	it('should send an error message if postMessage fails', () => {
		let count = 0;
		mockPostMessage.sender = () => {
			if (count++ === 0) {
				throw 'test error';
			}
		};

		wrappedFunction(['some data', 'test task id']);

		assert.deepEqual(mockPostMessage.calls, [
			[EMessageTypes.ERROR, 'test task id', 'test error'],
		]);
	});

	it('should not send anything if postMessage fails repeatedly', () => {
		mockPostMessage.sender = () => {
			throw new Error('test error');
		};

		wrappedFunction(['some data', 'test task id']);

		assert.deepEqual(mockPostMessage.calls, []);
	});
});
