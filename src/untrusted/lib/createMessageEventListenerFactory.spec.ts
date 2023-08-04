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

import './nodejsLoadWebcrypto.js'; // MUST BEFORE ANY LOCAL IMPORTS

import assert from 'node:assert/strict';
import createMessageEventListenerFactory from './createMessageEventListenerFactory.js';

describe('createMessageEventListenerFactory', () => {
	let addEventListener: typeof EventTarget.prototype.addEventListener;
	let removeEventListener: typeof EventTarget.prototype.addEventListener;
	let defaultEventTarget: EventTarget;
	let parentOrigin: string;
	let parent: MessageEventSource | null;
	let secret: string | undefined;

	beforeEach(() => {
		addEventListener = EventTarget.prototype.addEventListener;
		removeEventListener = EventTarget.prototype.removeEventListener;
		defaultEventTarget = new EventTarget();
		parentOrigin = 'https://example.com';
		parent = null;
		secret = 'secret';
	});

	it('should create an event listener with the given handler', async () => {
		let called = false;
		const handler = (data: unknown) => {
			assert.deepEqual(data, ['test']);
			called = true;
		};

		const factory = createMessageEventListenerFactory(
			addEventListener,
			removeEventListener,
			defaultEventTarget,
			parentOrigin,
			parent,
			secret,
			true,
		);
		const unregister = factory(handler);

		const event = new MessageEvent('message', { data: [secret, 'test'] });
		Object.defineProperty(event, 'origin', { value: parentOrigin });
		defaultEventTarget.dispatchEvent(event);

		await new Promise<void>((resolve, reject) => {
			setTimeout(() => {
				called
					? resolve()
					: reject(new Error('Handler should have been called'));
			}, 50);
		});

		unregister(); // clean up
	});

	it("should not call handler if parent origin doesn't match", async () => {
		let called = false;
		const handler = () => {
			called = true;
		};

		const factory = createMessageEventListenerFactory(
			addEventListener,
			removeEventListener,
			defaultEventTarget,
			parentOrigin,
			parent,
			secret,
			false,
		);
		const unregister = factory(handler);

		const event = new MessageEvent('message', {
			data: [secret, 'test'],
		});
		Object.defineProperty(event, 'origin', {
			value: 'wrong+' + parentOrigin,
		});
		defaultEventTarget.dispatchEvent(event);

		await new Promise<void>((resolve, reject) => {
			setTimeout(() => {
				!called
					? resolve()
					: reject(new Error('Handler should not have been called'));
			}, 50);
		});

		unregister(); // clean up
	});

	it('should not call handler if event is untrusted and allowUntrusted is false', async () => {
		let called = false;
		const handler = () => {
			called = true;
		};

		const factory = createMessageEventListenerFactory(
			addEventListener,
			removeEventListener,
			defaultEventTarget,
			parentOrigin,
			parent,
			secret,
			false,
		);
		const unregister = factory(handler);

		const event = new MessageEvent('message', {
			data: [secret, 'test'],
		});
		Object.defineProperty(event, 'origin', { value: parentOrigin });
		defaultEventTarget.dispatchEvent(event);

		await new Promise<void>((resolve, reject) => {
			setTimeout(() => {
				!called
					? resolve()
					: reject(new Error('Handler should not have been called'));
			}, 50);
		});

		unregister(); // clean up
	});
});
