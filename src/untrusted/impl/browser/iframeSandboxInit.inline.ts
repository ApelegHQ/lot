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

if (
	!__buildtimeSettings__.isolationStategyIframeSole &&
	!__buildtimeSettings__.isolationStategyIframeWorker
) {
	// At least one strategy must be chosen
	throw new Error('Not implemented');
}

import {
	E,
	aIsArray,
	aSlice,
	fnApply,
	sSlice,
	sSplit,
} from '~untrusted/lib/utils.js';

if (parent === self || self === top) {
	throw E('Iframe cannot be detached');
}

import * as Logger from '~untrusted/lib/Logger.js';
import iframeSandboxInner from './iframeSandboxInner.js';

const location = self.location;

const [initMesssageKeyA, initMesssageKeyB] = sSplit(
	sSlice(location.hash, 1),
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

const parentOrigin =
	'ancestorOrigins' in location &&
	location['ancestorOrigins'] &&
	location['ancestorOrigins'][0] &&
	location['ancestorOrigins'][0] !== 'null'
		? location['ancestorOrigins'][0]
		: '*';

parent.postMessage(
	[initMesssageKeyA, EMessageTypes.SANDBOX_READY],
	parentOrigin,
);
