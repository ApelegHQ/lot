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

import * as nodejsSandboxVm from 'inline:~untrusted/impl/nodejs/nodejsSandboxVm.inline.js';
import { Worker } from 'node:worker_threads';
import { ISandbox } from '~/types/index.js';
import setupSandboxListeners from '~trusted/lib/setupSandboxListeners.js';
import { INTERNAL_SOURCE_STRING } from '~untrusted/impl/nodejs/constants.js';
import type workerSandboxInner from '~untrusted/impl/worker/workerSandboxInner.js';
import { extractErrorInformation } from '~untrusted/lib/errorModem.js';

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

	const messageChannel = new MessageChannel();

	const sandboxId = (0, Math.random)().toFixed(12).slice(2);

	const externalMethodKeys =
		__buildtimeSettings__.bidirectionalMessaging && externalMethods
			? Object.keys(externalMethods)
			: null;

	const worker = new Worker(nodejsSandboxVm.default, {
		['workerData']: {
			['%id']: sandboxId,
			['%messagePort']: messageChannel.port2,
			['%script']: script,
			['%externalMethodKeys']: externalMethodKeys,
		},
		['env']: Object.create(null),
		['eval']: true,
		['name']: sandboxId,
		['transferList']: [messageChannel.port2 as ReturnType<typeof eval>],
	});

	const errorEventHandler = (e: unknown) => {
		worker.terminate();
		messageChannel.port1.dispatchEvent(
			new MessageEvent('message', {
				['data']: [
					EMessageTypes.GLOBAL_ERROR,
					extractErrorInformation(
						e === undefined ? new Error('Unknown global error') : e,
					),
				],
			}),
		);
		onDestroy();
	};
	const exitEventHandler = (code: number) => {
		messageChannel.port1.dispatchEvent(
			new MessageEvent('message', {
				['data']: [
					EMessageTypes.GLOBAL_ERROR,
					extractErrorInformation(
						new Error(`Worker thread ended with code ${code}`),
					),
				],
			}),
		);
		onDestroy();
	};
	const onDestroy = () => {
		worker.on('error', errorEventHandler);
		worker.on('exit', exitEventHandler);
		abort?.removeEventListener('abort', onDestroy, false);
		worker.terminate();
	};

	worker.on('error', errorEventHandler);
	worker.on('exit', exitEventHandler);

	abort?.addEventListener('abort', onDestroy, false);

	messageChannel.port1.postMessage([
		EMessageTypes.SANDBOX_READY,
		INTERNAL_SOURCE_STRING,
		!!abort,
		true,
		allowedGlobals,
		externalMethodKeys,
	] as [
		EMessageTypes.SANDBOX_READY,
		...Parameters<typeof workerSandboxInner>,
	]);

	messageChannel.port1.start();
	messageChannel.port2.start();

	return setupSandboxListeners(
		messageChannel.port1,
		true,
		// empty manager since data are passed as workerData
		Promise.resolve.bind(Promise),
		externalMethods,
		abort,
	);
};

export default nodejsSandbox;
