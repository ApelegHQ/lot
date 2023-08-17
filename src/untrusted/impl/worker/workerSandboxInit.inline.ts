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

import { aIsArray, aSlice, fnApply } from '~untrusted/lib/utils.js';

import * as Logger from '~untrusted/lib/Logger.js';
import workerSandboxInner from './workerSandboxInner.js';

const listener = (event: MessageEvent) => {
	if (
		!event.isTrusted ||
		!aIsArray(event.data) ||
		event.data[0] !== EMessageTypes.SANDBOX_READY
	)
		return;

	Logger.info('Received SANDBOX_READY from parent. Creating sandbox.');
	globalThis.removeEventListener('message', listener, false);
	// Set allowUntrusted to false
	event.data[2] = false;
	fnApply(workerSandboxInner, null, aSlice(event.data, 1));
};

Logger.info('Worker started, registering event listener');
globalThis.addEventListener('message', listener, false);
