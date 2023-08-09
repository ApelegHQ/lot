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

const destructuredPromiseFactory = (): [
	Promise<void>,
	{ (): void },
	{ (reason?: Error): void },
] => {
	return (() => {
		let resolve_: { (): void } = Boolean;
		let reject_: { (reason?: Error): void } = Boolean;

		const promise = new Promise<void>((resolve, reject) => {
			resolve_ = resolve;
			reject_ = reject;
		});
		return [promise, resolve_, reject_];
	})();
};

describe('createMessageEventListenerFactory', () => {
	let addEventListener: typeof EventTarget.prototype.addEventListener;
	let removeEventListener: typeof EventTarget.prototype.addEventListener;

	beforeEach(() => {
		addEventListener = EventTarget.prototype.addEventListener;
		removeEventListener = EventTarget.prototype.removeEventListener;
	});

	it('should create an event listener with the given handler', async () => {
		const [promise1, resolve1, reject1] = destructuredPromiseFactory();
		const [promise2, resolve2, reject2] = destructuredPromiseFactory();
		const [promise3, resolve3, reject3] = destructuredPromiseFactory();

		const handler1 = (data: unknown) => {
			assert.deepEqual(data, ['test']);
			resolve1();
		};
		const handler2 = () =>
			reject2(
				Error(
					'Handler called when isTrusted and allowUntrusted are false',
				),
			);
		const handler3 = () => reject3();

		const ch = new MessageChannel();
		ch.port1.start();
		ch.port2.start();

		const factory1 = createMessageEventListenerFactory(
			addEventListener,
			removeEventListener,
			true,
		);
		const factory2 = createMessageEventListenerFactory(
			addEventListener,
			removeEventListener,
			false,
		);

		const unregister1 = factory1(ch.port2, handler1);
		const unregister2 = factory2(ch.port2, handler2);
		const unregister3 = factory1(ch.port2, handler3);

		const ev = new MessageEvent('message', {
			data: ['test'],
		});
		assert.equal(ev.isTrusted, false);
		ch.port2.dispatchEvent(ev);

		setTimeout(
			() => reject1(Error('Timed out waiting for handler to be called')),
			64,
		);
		setTimeout(resolve2, 128);
		setTimeout(resolve3, 64);

		await Promise.all([promise1, promise2, assert.rejects(promise3)]);

		unregister1(); // clean up
		unregister2(); // clean up
		unregister3(); // clean up
	});
});
