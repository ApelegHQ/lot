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

import { extractErrorInformation } from './errorModem.js';

/**
 * Wraps the given postMessage function to provide error handling.
 *
 * This wrapper attempts ensures that messages are sent successfully, despite
 * errors when sending a message. If an error occurs during message sending,
 * it tries to send an error message with detailed information.
 * If that fails, it sends a generic error message. If even that fails, it does
 * nothing and the error is silently caught. This function is meant to be used
 * for returning the result of running tasks (when communicating across
 * realms). For task requests, having sending a message fail does not require
 * special handling, as the error is delivered locally.
 *
 * @param postMessage - The original postMessage function.
 * @returns A wrapped postMessage function with error handling.
 *
 * @example
 * const wrappedPostMessage = postMessageWrapper(originalPostMessage);
 * wrappedPostMessage(["DATA", "Some Data"]);
 */
const postMessageWrapper =
	(postMessage: { (data: unknown[]): void }) => (data: unknown[]) => {
		try {
			postMessage(data);
		} catch (e) {
			try {
				postMessage([
					EMessageTypes.ERROR,
					data[1],
					extractErrorInformation(e),
				]);
			} catch {
				try {
					postMessage([
						EMessageTypes.ERROR,
						data[1],
						'Error sending task result',
					]);
				} catch {
					// empty
				}
			}
		}
	};

export default postMessageWrapper;
