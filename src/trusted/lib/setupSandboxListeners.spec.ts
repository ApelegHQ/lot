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

Reflect.set(__buildtimeSettings__, 'sandboxInitDeadlineInMs', 100);

import setupSandboxListeners from './setupSandboxListeners.js';

describe('setupSandboxListeners', () => {
	let controller: AbortController;

	beforeEach(() => {
		controller = new AbortController();
	});

	afterEach(() => {
		controller.abort();
	});

	it('should handle SANDBOX_READY message', () => {
		const messageChannel = new MessageChannel();
		return new Promise<void>((resolve, reject) => {
			const managerFunction = async () => {
				messageChannel.port2.postMessage([EMessageTypes.SANDBOX_READY]);
			};

			messageChannel.port1.onmessage = (ev) => {
				if (
					!Array.isArray(ev.data) ||
					ev.data.length !== 1 ||
					ev.data[0] !== EMessageTypes.SANDBOX_READY
				)
					return reject(new Error('Unexpected message format'));
				resolve();
			};

			setupSandboxListeners(
				messageChannel.port1,
				true,
				managerFunction,
				undefined,
				controller.signal,
			).catch(reject);
		}).finally(() => {
			messageChannel.port1.close();
			messageChannel.port2.close();
		});
	});

	it('should handle GLOBAL_ERROR message', () => {
		const messageChannel = new MessageChannel();
		return new Promise<void>((resolve, reject) => {
			const managerFunction = async () => {
				messageChannel.port2.postMessage([
					EMessageTypes.GLOBAL_ERROR,
					new Error('test error'),
				]);
			};

			messageChannel.port1.onmessage = (ev) => {
				if (
					!Array.isArray(ev.data) ||
					ev.data.length !== 2 ||
					ev.data[0] !== EMessageTypes.GLOBAL_ERROR ||
					!(ev.data[1] instanceof Error) ||
					ev.data[1].message !== 'test error'
				)
					return reject(new Error('Unexpected message format'));
				resolve();
			};

			setupSandboxListeners(
				messageChannel.port1,
				true,
				managerFunction,
				undefined,
				controller.signal,
			).catch(reject);
		}).finally(() => {
			messageChannel.port1.close();
			messageChannel.port2.close();
		});
	});

	it('should handle no message', () => {
		const messageChannel = new MessageChannel();
		return new Promise<void>((resolve, reject) => {
			const managerFunction = async () => {
				// empty
			};

			messageChannel.port1.onmessage = () => {
				reject(new Error('Unexpected message format'));
			};

			setupSandboxListeners(
				messageChannel.port1,
				true,
				managerFunction,
				undefined,
				controller.signal,
			).catch((e) => {
				if (
					e instanceof Error &&
					e.name === 'Error' &&
					e.message &&
					e.message.includes('Timed out')
				) {
					return resolve();
				}
				reject(new Error('unexpected error'));
			});
		}).finally(() => {
			messageChannel.port1.close();
			messageChannel.port2.close();
		});
	});
});
