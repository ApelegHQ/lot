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

import singleUseFunctionConstructor from '~/untrusted/lib/singleUseFunctionConstructor.js';

import { aIsArray } from '~untrusted/lib/utils.js';

import createSandboxedHandler from '~untrusted/lib/createSandboxedHandler.js';
import { extractErrorInformation } from '~untrusted/lib/errorModem.js';
import hardenGlobals, {
	disableURLStaticMethods,
} from '~untrusted/lib/hardenGlobals.js';
import * as Logger from '~untrusted/lib/Logger.js';
import recursivelyDeleteProperty from '~untrusted/lib/recursivelyDeleteProperty.js';

/**
 * Factory function to create an event listener for 'message' events.
 *
 * The created event listener filters incoming message events based on given
 * criteria (shape, isTrusted attribute and message type) and then invokes the
 * provided handler function if the criteria are met.
 *
 * @returns A function that takes in a handler function to be executed when the
 * message event criteria are met and a flag determining if untrusted messages
 * should be allowed. This returned function, when invoked, returns a cleanup
 * function that can be used to remove the added event listener.
 */
const createMessageEventListener = (() => {
	return (handler: { (data: unknown[]): void }, allowUntrusted: boolean) => {
		const eventListener = (event: MessageEvent) => {
			if (
				(!allowUntrusted && !event.isTrusted) ||
				!aIsArray(event.data) ||
				![
					EMessageTypes.REQUEST,
					EMessageTypes.RESULT,
					EMessageTypes.ERROR,
				].includes(event.data[0] as EMessageTypes)
			) {
				return;
			}

			handler(event.data);
		};

		globalThis.addEventListener('message', eventListener);

		return () => {
			globalThis.removeEventListener('message', eventListener);
		};
	};
})();

/**
 * Setups up a sandboxed environment for the web worker and initiates execution
 * of the provided script.
 *
 * This function also sets up message event listeners to communicate with the
 * main thread and revokes or restricts global properties and methods to
 * enhance security.
 *
 * @param script - The script to be executed in the worker.
 * @param revocable - Determines if the sandbox can be torn down.
 * @param allowUntrusted - Determines if untrusted messages should be allowed.
 * @param allowedGlobals - List of global properties/methods that should remain
 * accessible.
 * @param externalMethodsList - List of external methods available to the
 * sandboxed environment.
 */
const workerSandboxInner = (
	script: string,
	revocable: boolean,
	allowUntrusted: boolean,
	allowedGlobals: string[] | undefined | null,
	externalMethodsList: string[] | undefined | null,
) => {
	const postMessage = globalThis['postMessage'].bind(globalThis);
	const close = globalThis['close'].bind(globalThis);

	try {
		Logger.info('Setting up worker sandbox.');

		// Remove methods from DedicatedWorkerGlobalScope
		recursivelyDeleteProperty(globalThis, 'close');
		recursivelyDeleteProperty(globalThis, 'postMessage');

		hardenGlobals();
		disableURLStaticMethods();

		const revokeRootMessageEventListener = createMessageEventListener(
			createSandboxedHandler(
				singleUseFunctionConstructor,
				script,
				allowedGlobals,
				externalMethodsList,
				postMessage,
				Boolean,
				revocable
					? () => {
							revokeRootMessageEventListener();
							close();
					  }
					: undefined,
			),
			allowUntrusted,
		);

		Logger.info(
			'Finished setting up worker sandbox. Sending SANDBOX_READY to parent.',
		);
		postMessage([EMessageTypes.SANDBOX_READY]);
	} catch (e) {
		Logger.warn(
			'Error setting up worker sandbox. Sending GLOBAL_ERROR to parent.',
		);

		postMessage([EMessageTypes.GLOBAL_ERROR, extractErrorInformation(e)]);
		close();
	}
};

export default workerSandboxInner;
