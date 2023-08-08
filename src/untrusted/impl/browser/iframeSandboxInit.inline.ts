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

import * as Logger from '../../lib/Logger.js';
import { aIsArray, aSlice, fnApply, sSlice, sSplit } from '../../lib/utils.js';
import iframeSandboxInner from './iframeSandboxInner.js';

const [initMesssageKeyA, initMesssageKeyB] = sSplit(
	sSlice(self.location.hash, 1),
	'-',
);

const listener = (event: MessageEvent) => {
	if (
		!event.isTrusted ||
		event.source !== parent ||
		!aIsArray(event.data) ||
		event.data[1] !== EMessageTypes.SANDBOX_READY ||
		event.data[0] !== initMesssageKeyB ||
		(event.data.length !== 7 && event.data.length !== 8)
	)
		return;

	Logger.info('Received SANDBOX_READY from parent. Creating sandbox.');

	self.removeEventListener('message', listener, false);

	fnApply(iframeSandboxInner, null, aSlice(event.data, 2));
};

Logger.info('Iframe loaded, registering event listener');
self.addEventListener('message', listener, false);

parent.postMessage(
	[initMesssageKeyA, EMessageTypes.SANDBOX_READY],
	// We don't know the origin yet
	'*',
);
