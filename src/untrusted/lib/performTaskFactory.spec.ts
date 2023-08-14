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
import performTaskFactory from './performTaskFactory.js';

describe('performTaskFactory', () => {
	it('should create a performTask instance and execute tasks successfully', async () => {
		// Mock postMessageOutgoing to capture the data sent by performTask
		let capturedData: unknown[] = [];
		let postMessageOutgoingMock = (data: unknown[]) => {
			capturedData = data;
		};

		const [performTask, resultHandler, cleanup] = performTaskFactory(
			true,
			postMessageOutgoingMock,
		);

		assert(typeof performTask === 'function');
		assert(typeof resultHandler === 'function');

		const mockData = [1, 2, 3];
		const mockTask = 'mockTask';

		// Execute the task
		const taskPromise = performTask(mockTask, ...mockData);

		assert.ok(Array.isArray(capturedData));
		const taskId = capturedData[1];
		capturedData[1] = '%[[TASK_ID]]';

		// Ensure that the data were sent correctly
		assert.deepEqual(capturedData, [
			EMessageTypes.REQUEST,
			capturedData[1],
			mockTask,
			...mockData,
		]);

		// Simulate receiving a result from the worker
		const mockResult = 'mockResult';
		resultHandler([EMessageTypes.RESULT, taskId, mockResult]);

		// Ensure that the task promise resolves with the correct result
		const result = await taskPromise;
		assert.equal(result, mockResult);

		// Clean up the performTask instance
		cleanup();

		// Ensure that the performTask methods are revoked
		// (mocking postMessageOutgoing.data to check if it's called or not)
		postMessageOutgoingMock = () => {
			throw new Error(
				'postMessageOutgoing.data should not be called after cleanup.',
			);
		};

		// Execute a task after cleanup, which should throw an error
		assert.rejects(() => performTask(mockTask, ...mockData));
	});
});
