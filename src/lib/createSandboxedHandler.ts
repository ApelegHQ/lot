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

import EMessageTypes from '../EMessageTypes.js';
import { extractErrorInformation } from './errorModem.js';
import genericSandbox from './genericSandbox.js';
import * as Logger from './Logger.js';
import performTaskFactory from './performTaskFactory.js';
import requestHandler from './requestHandler.js';

const FERAL_FUNCTION = Function;

const createSandboxedHandler = (
	script: string,
	allowedGlobals: string[] | undefined | null,
	externalMethodsList: string[] | undefined | null,
	postMessage: { (data: unknown[]): void },
	preInit: { (): void },
	cleanup: { (): void },
) => {
	const performTaskMethods =
		__buildtimeSettings__.bidirectionalMessaging &&
		Array.isArray(externalMethodsList) &&
		externalMethodsList.length
			? performTaskFactory(postMessage)
			: undefined;

	const sandbox = genericSandbox(
		script,
		allowedGlobals,
		FERAL_FUNCTION,
		performTaskMethods?.[0],
		externalMethodsList,
	);

	const ctx = sandbox.ctx;

	const handler = (data: unknown[]) => {
		if (
			!(
				__buildtimeSettings__.bidirectionalMessaging
					? [
							EMessageTypes.REQUEST,
							EMessageTypes.DESTROY,
							EMessageTypes.RESULT,
							EMessageTypes.ERROR,
					  ]
					: [EMessageTypes.REQUEST, EMessageTypes.DESTROY]
			).includes(data[0] as EMessageTypes)
		) {
			return;
		}

		switch (data[0]) {
			case EMessageTypes.DESTROY: {
				Logger.debug('Received DESTROY from parent');

				sandbox.revoke();
				postMessage = Boolean;

				if (__buildtimeSettings__.bidirectionalMessaging) {
					performTaskMethods?.[2]();
				}

				cleanup();

				return;
			}
			case EMessageTypes.REQUEST: {
				Logger.debug(
					'Received REQUEST for task [' + data[1] + '] ' + data[2],
				);

				if (!ctx?.['module']?.['exports']) {
					try {
						postMessage([
							EMessageTypes.ERROR,
							data[1],
							extractErrorInformation(
								new ReferenceError(`${data[2]} is not defined`),
							),
						]);
					} catch {
						// empty
					}
					return;
				}

				requestHandler(
					postMessage,
					ctx['module']['exports'],
					data[1],
					data[2],
					data[3],
				);
			}
			// eslint-disable-next-line no-fallthrough
			case EMessageTypes.RESULT:
			case EMessageTypes.ERROR: {
				if (__buildtimeSettings__.bidirectionalMessaging) {
					performTaskMethods?.[1](data);
				}
			}
		}
	};

	preInit();

	sandbox.fn();

	return handler;
};

export default createSandboxedHandler;
