/* Copyright © 2023 Apeleg Limited.
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

import singleUseFunctionConstructor from '~/untrusted/lib/singleUseFunctionConstructor.js';

import type createErrorEventListenerFactory from '~untrusted/lib/createErrorEventEventListenerFactory.js';
import type createMessageEventListenerFactory from '~untrusted/lib/createMessageEventListenerFactory.js';
import createSandboxedHandler from '~untrusted/lib/createSandboxedHandler.js';
import { extractErrorInformation } from '~untrusted/lib/errorModem.js';
import { disableURLStaticMethods } from '~untrusted/lib/hardenGlobals.js';
import * as Logger from '~untrusted/lib/Logger.js';
import tightenCsp from '~untrusted/lib/tightenCsp.js';

/**
 * Manages the sandbox environment for an iframe, either setting it up or
 * handling any encountered errors.
 *
 * @param messagePort - The port for sending/receiving messages.
 * @param script - The script content to be executed inside the sandbox.
 * @param revocable - Determines if the sandbox can be torn down.
 * @param allowedGlobals - List of global properties/methods that should remain
 * accessible.
 * @param externalMethodsList - List of external methods available to the
 * sandboxed environment.
 * @param createMessageEventListener - A factory function to create a message
 * event listener.
 * @param createErrorEventListener - A factory function to create an error
 * event listener.
 * @param close - A function to close the sandbox environment and release
 * resources
 * @returns A promise that settles when the setup is complete or on error.
 * @throws Will throw an error if there's an issue with setting up the iframe
 */
const iframeSoleSandboxManager = async (
	messagePort: MessagePort,
	script: string,
	revocable: boolean,
	allowedGlobals: string[] | undefined | null,
	externalMethodsList: string[] | undefined | null,
	createMessageEventListener: ReturnType<
		typeof createMessageEventListenerFactory
	>,
	createErrorEventListener: ReturnType<
		typeof createErrorEventListenerFactory
	>,
	close: { (): void },
): Promise<void> => {
	const postMessageOutgoing = messagePort.postMessage.bind(messagePort);

	try {
		Logger.info('Setting up iframe fallback sandbox');

		disableURLStaticMethods();

		const revokeRootMessageEventListener = createMessageEventListener(
			messagePort,
			createSandboxedHandler(
				singleUseFunctionConstructor,
				script,
				allowedGlobals,
				externalMethodsList,
				postMessageOutgoing,
				tightenCsp,
				revocable
					? () => {
							revokeRootMessageEventListener();
							revokeRootErrorEventListener();
							close();
						}
					: undefined,
			),
		);
		const revokeRootErrorEventListener = createErrorEventListener();

		Logger.info(
			'Finished setting up iframe fallback sandbox. Sending SANDBOX_READY to parent.',
		);

		postMessageOutgoing([EMessageTypes.SANDBOX_READY]);
	} catch (e) {
		Logger.warn(
			'Error setting up iframe fallback sandbox. Sending GLOBAL_ERROR to parent.',
		);
		postMessageOutgoing([
			EMessageTypes.GLOBAL_ERROR,
			extractErrorInformation(e),
		]);
	}
};

export default iframeSoleSandboxManager;
