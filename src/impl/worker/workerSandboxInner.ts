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

import EMessageTypes from '../../EMessageTypes.js';
import createSandboxedHandler from '../../lib/createSandboxedHandler.js';
import { extractErrorInformation } from '../../lib/errorModem.js';
import hardenGlobals, {
	disableURLStaticMethods,
} from '../../lib/hardenGlobals.js';
import * as Logger from '../../lib/Logger.js';

const createMessageEventListener = (() => {
	return (handler: { (data: unknown[]): void }) => {
		const eventListener = (event: MessageEvent) => {
			if (
				!event.isTrusted ||
				!Array.isArray(event.data) ||
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

		self.addEventListener('message', eventListener);

		return () => {
			self.removeEventListener('message', eventListener);
		};
	};
})();

const workerSandboxInner = (
	script: string,
	allowedGlobals: string[] | undefined | null,
	externalMethodsList: string[] | undefined | null,
) => {
	try {
		Logger.info('Setting up worker sandbox.');

		// Remove methods from DedicatedWorkerGlobalScope
		// TODO: Seemingly not working
		const selfPrototype = Object.getPrototypeOf(self);
		const postMessage = self.postMessage.bind(self);
		const close = self.close.bind(self);
		delete selfPrototype.postMessage;
		delete selfPrototype.close;

		void hardenGlobals;
		void disableURLStaticMethods;
		hardenGlobals();
		disableURLStaticMethods();

		const revokeRootMessageEventListener = createMessageEventListener(
			createSandboxedHandler(
				script,
				allowedGlobals,
				externalMethodsList,
				postMessage,
				Boolean,
				() => {
					revokeRootMessageEventListener();
					close();
				},
			),
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
	}
};

export default workerSandboxInner;
