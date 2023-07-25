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

import * as nodejsSandboxVm from 'inline:./nodejsSandboxVm.inline.js';
import { Worker } from 'node:worker_threads';
import EMessageTypes from '../../EMessageTypes.js';
import { extractErrorInformation } from '../../lib/errorModem.js';
import getRandomUuid from '../../lib/getRandomUuid.js';
import setupSandboxListeners from '../../lib/setupSandboxListeners.js';
import { ISandbox } from '../../types/index.js';

const nodejsSandbox: ISandbox = async (
	script,
	allowedGlobals,
	externalMethods,
	abort,
) => {
	if (!__buildtimeSettings__.bidirectionalMessaging && externalMethods) {
		throw new TypeError(
			'Invalid value for externalMethods. Bidirectional messaging is disabled',
		);
	}

	const eventTargetIncoming = new EventTarget();
	const originIncoming = 'urn:uuid:' + getRandomUuid();

	const worker = new Worker(nodejsSandboxVm.default, {
		['workerData']: {
			['abort']: !!abort,
			['allowedGlobals']: allowedGlobals,
			['externalMethods']:
				externalMethods && Object.keys(externalMethods),
			['script']: script,
		},
		['env']: Object.create(null),
		['eval']: true,
	});

	const messageEventHandler = (message: unknown) => {
		eventTargetIncoming.dispatchEvent(
			new MessageEvent('message', {
				...(message !== undefined && { data: message }),
				['origin']: originIncoming,
			}),
		);
	};
	const errorEventHandler = (e: unknown) => {
		worker.terminate();
		eventTargetIncoming.dispatchEvent(
			new MessageEvent('message', {
				data: [
					EMessageTypes.GLOBAL_ERROR,
					extractErrorInformation(
						e === undefined ? new Error('Unknown global error') : e,
					),
				],
				['origin']: originIncoming,
			}),
		);
		onDestroy();
	};
	const exitEventHandler = (code: number) => {
		eventTargetIncoming.dispatchEvent(
			new MessageEvent('message', {
				data: [
					EMessageTypes.GLOBAL_ERROR,
					extractErrorInformation(
						new Error(`Worker thread ended with code ${code}`),
					),
				],
				['origin']: originIncoming,
			}),
		);
		onDestroy();
	};
	const onDestroy = () => {
		worker.on('message', messageEventHandler);
		worker.on('error', errorEventHandler);
		worker.on('exit', exitEventHandler);
		abort?.removeEventListener('abort', onDestroy, false);
		worker.terminate();
	};

	const postMessageOutgoing = (message: unknown) => {
		worker.postMessage(message);
	};

	worker.on('message', messageEventHandler);
	worker.on('error', errorEventHandler);
	worker.on('exit', exitEventHandler);

	abort?.addEventListener('abort', onDestroy, false);

	return setupSandboxListeners(
		eventTargetIncoming,
		originIncoming,
		null,
		undefined,
		true,
		postMessageOutgoing,
		// empty manager since data are passed as workerData
		async () => {},
		externalMethods,
		abort,
	);
};

export default nodejsSandbox;
