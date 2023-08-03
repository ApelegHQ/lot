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

import { TE } from './utils.js';

/**
 * Creates an error event listener factory function.
 *
 * @param addEventListener - The function to add an event listener.
 * @param removeEventListener - The function to remove an event listener.
 * @param defaultEventTarget - The default event target to attach the listener
 * to if no worker is provided.
 * @param postMessage - The function to post a message with the error
 * information.
 * @returns A function that takes an optional handler and worker, adds an
 * 'error' event listener to the appropriate target, and returns a function to
 * remove the listener.
 * @throws {TypeError} When 'addEventListener' is called on an object that does
 * not implement the EventTarget interface.
 */
const createErrorEventListenerFactory =
	(
		addEventListener: typeof EventTarget.prototype.addEventListener,
		removeEventListener: typeof EventTarget.prototype.addEventListener,
		defaultEventTarget: EventTarget,
		postMessage: { (data: unknown[]): void },
	) =>
	(
		handler?: {
			(): void;
		},
		worker?: Worker,
	) => {
		if (
			worker &&
			typeof Worker === 'function' &&
			!(worker instanceof Worker)
		) {
			throw TE(
				"'addEventListener' called on an object that does not implement interface EventTarget.",
			);
		}

		const target = worker ? worker : defaultEventTarget;

		const eventListener = handler
			? (event: ErrorEvent) => {
					if (!event.isTrusted) return;
					handler();
			  }
			: (event: ErrorEvent) => {
					if (!event.isTrusted) return;
					// TODO get error info from event instead of sending it raw
					postMessage([EMessageTypes.GLOBAL_ERROR, event]);
			  };

		addEventListener.call(
			target,
			'error',
			eventListener as { (event: Event): void },
			false,
		);

		return () =>
			removeEventListener.call(
				target,
				'error',
				eventListener as { (event: Event): void },
				false,
			);
	};

export default createErrorEventListenerFactory;
