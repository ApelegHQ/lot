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

import {
	aIncludes,
	aIsArray,
	aSlice,
	E,
	oDefineProperty,
	RE,
} from './utils.js';

import { extractErrorInformation } from './errorModem.js';
import genericSandbox from './genericSandbox.js';
import global from './global.js';
import * as Logger from './Logger.js';
import performTaskFactory from './performTaskFactory.js';
import requestHandler from './requestHandler.js';

/**
 * Creates a handler function that can process messages and invoke tasks inside
 * a sandboxed environment.
 * The handler is set up to communicate with the parent through a series of
 * messages (see `requestHandler` and `performTaskFactory`).
 * Cleanup logic is also included to properly close resources.
 *
 * @param script - The JavaScript code to be executed inside the sandbox.
 * @param allowedGlobals - A list of allowed global variables or null/undefined
 * to use default values.
 * @param externalMethodsList - A list of external methods available for the
 * sandboxed script or null/undefined for none (requires bidirectional
 * messaging to be enabled).
 * @param postMessage - Function to post messages to the parent.
 * @param preInit - Function to be executed before initialising the sandbox.
 * @param cleanup - Function to be executed for cleaning up resources, or
 * null/undefined if not required.
 * @returns A handler function that can process incoming messages and invoke
 * tasks within the sandbox.
 */
const createSandboxedHandler = (
	functionConstructor: FunctionConstructor,
	script: string,
	allowedGlobals: string[] | undefined | null,
	externalMethodsList: string[] | undefined | null,
	postMessage: { (data: unknown[]): void },
	preInit: { (): void },
	cleanup: { (): void } | null | undefined,
) => {
	const performTaskMethods =
		__buildtimeSettings__.bidirectionalMessaging &&
		aIsArray(externalMethodsList) &&
		externalMethodsList.length
			? performTaskFactory(!!cleanup, postMessage)
			: undefined;

	if (__buildtimeSettings__.sandboxContainmentProbe) {
		const error = E('ACCESS VIOLATION: THIS VALUE SHOULD NOT BE VISIBLE');
		error['name'] = 'SandboxContainmentError';

		oDefineProperty(global, '__sandbox_containment_probe__', {
			['enumerable']: true,
			['get']() {
				throw error;
			},
			['set']() {
				throw error;
			},
		});
	}

	const sandbox = genericSandbox(
		script,
		allowedGlobals,
		functionConstructor,
		performTaskMethods?.[0],
		externalMethodsList,
	);

	const ctx = sandbox.ctx;

	const handler = (data: unknown[]) => {
		if (
			!aIncludes(
				__buildtimeSettings__.bidirectionalMessaging
					? [
							EMessageTypes.REQUEST,
							EMessageTypes.DESTROY,
							EMessageTypes.RESULT,
							EMessageTypes.ERROR,
					  ]
					: [EMessageTypes.REQUEST, EMessageTypes.DESTROY],
				data[0] as EMessageTypes,
			)
		) {
			return;
		}

		switch (data[0]) {
			case EMessageTypes.DESTROY: {
				if (!cleanup) return;

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
								RE(`${data[2]} is not defined`),
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
					...aSlice(data, 3),
				);

				return;
			}
			case EMessageTypes.RESULT:
			case EMessageTypes.ERROR: {
				if (__buildtimeSettings__.bidirectionalMessaging) {
					performTaskMethods?.[1](data);
				}
				return;
			}
		}
	};

	preInit();

	sandbox.fn();

	return handler;
};

export default createSandboxedHandler;
