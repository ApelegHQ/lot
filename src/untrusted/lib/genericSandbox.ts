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

import { TE, aIsArray, oCreate } from './utils.js';

import type { IPerformTask, TContext } from '~/types/index.js';
import createContext, { setupExternalMethods } from './createContext.js';
import createWrapperFn from './createWrapperFn.js';
import global from './global.js';
import globalProxy from './globalProxy.js';
import modulePropertyDescriptor from './modulePropertyDescriptor.js';

type TGenericSandbox = {
	(
		script: string,
		allowedGlobals: string[] | undefined | null,
		functionConstructor: (typeof global)['Function'],
		externalCallMethod?: IPerformTask | null,
		externalMethodsList?: string[] | null,
	): { fn: { (): void }; ctx: TContext; revoke: { (): void } };
};

/**
 * Creates a sandbox for script execution.
 * Depending on the build settings, it can either emulate a global context or
 * use the real global context.
 * This function ensures scripts run in a controlled environment, enhancing
 * security by restricting the script's access only to specified global
 * variables and methods.
 *
 * @template TGenericSandbox - Type representation for the sandbox.
 * @param script - The script to be sandboxed.
 * @param allowedGlobals - List of allowed global properties.
 * @param functionConstructor - The function constructor for the global context.
 * @param externalCallMethod - The method used to perform external calls.
 * @param externalMethodsList - List of external method names.
 * @returns Object containing the sandboxed function (`fn`), the context
 * (`ctx`), and a method to revoke the sandbox (`revoke`).
 * @throws {TypeError} Will throw an error if bidirectional messaging is
 * disabled but externalCallMethod or externalMethodsList is provided.
 */
const genericSandbox: TGenericSandbox = (
	script,
	allowedGlobals,
	functionConstructor,
	externalCallMethod,
	externalMethodsList,
) => {
	if (
		!__buildtimeSettings__.bidirectionalMessaging &&
		(externalCallMethod || externalMethodsList)
	) {
		throw TE(
			'Invalid value for externalCallMethod or externalMethodsList. Bidirectional messaging is disabled',
		);
	}

	const sandboxWrapperFn = createWrapperFn(script, functionConstructor);

	if (__buildtimeSettings__.emulatedGlobalContext) {
		const sandboxWrapperThis = createContext(
			allowedGlobals,
			externalCallMethod,
			externalMethodsList,
		);

		// The Proxy only for the `with` statement makes the sandbox
		// work more similarly to what a 'real' global contex would
		// look like, while also handling special edge-cases like
		// [Symbol.unscopables].
		// The one thing that seems impossible to implement is
		// properly throwing `ReferenceError`.
		// This handles, for example, checking that
		// `('undefinedProp' in self)` correctly returns `false` (which
		// it wouldn't otherwise because of 'has' always returning true)
		const sandboxWrapperThisProxy = globalProxy(sandboxWrapperThis);

		return {
			fn: sandboxWrapperFn.bind(sandboxWrapperThisProxy['proxy']),
			ctx: sandboxWrapperThisProxy['proxy'],
			revoke: () => {
				sandboxWrapperThisProxy['revoke']();
			},
		};
	} else {
		if (
			__buildtimeSettings__.bidirectionalMessaging &&
			externalCallMethod &&
			aIsArray(externalMethodsList)
		) {
			setupExternalMethods(
				global,
				externalCallMethod,
				externalMethodsList,
			);
		}

		// No Proxy in this case, since we are explicitly sharing the
		// global scope
		// 'module' is special in that it's not a globally-scoped
		// variable
		const ctx = oCreate(null, {
			// globalThis is used to set 'this' to $global
			['globalThis']: {
				['value']: global,
			},
			['module']: modulePropertyDescriptor,
		});
		ctx['exports'] = ctx['module']['exports'];

		return {
			fn: sandboxWrapperFn.bind(ctx),
			ctx: ctx as unknown as TContext,
			revoke: Boolean,
		};
	}
};

export default genericSandbox;
