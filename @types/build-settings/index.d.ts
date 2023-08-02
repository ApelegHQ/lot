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

/**
 * Namespace that encapsulates various build-time settings.
 * @namespace
 */
declare namespace __buildtimeSettings__ {
	/**
	 * Specifies the target environment for the build.
	 */
	const buildTarget: 'browser' | 'generic' | 'nodejs' | 'worker';

	/**
	 * Specifies the type of build, either release or debug.
	 */
	const buildType: 'release' | 'debug';

	/**
	 * An array of default allowed global properties.
	 *
	 * A default list is already provided by the distribution in the file
	 * called `defaultAllowedGlobalProps.config.mjs` located at the root.
	 * These are the global properties that are considered 'safe' and will be
	 * used when setting up a sandbox if the argument is not given.
	 *
	 * This flag has no effect unless `emulatedGlobalContext` is also enabled.
	 *
	 */
	const defaultAllowedGlobalProps: string[];

	/**
	 * Flag to indicate whether dynamic code generation is enabled.
	 *
	 * This flag is at the moment relevant only in combination with the
	 * `enhancedWrapper` flag, although in the future it may find additional
	 * uses.
	 * When this flag is enabled, steps are taken to minimise the use of
	 * non-deterministic generated code, so that in theory every piece of code
	 * executed can be known in advance, and used in combination with other
	 * protection mechanisms, such as SRI. In practice, the browser security
	 * model still requires broad permissions that provide little benefit to
	 * disabling dynamic code generation.
	 *
	 * WARNING: This flag has security implications and you should not disable
	 * it without careful consideration. Disabling generated code could result
	 * in especially crafted but non syntactically-valid code being able to
	 * escape confinement and gain access the global scope.
	 */
	const dynamicCodeGeneration: boolean;

	/**
	 * Deadline in milliseconds for sandbox initialisation.
	 */
	const sandboxInitDeadlineInMs: number;

	/**
	 * Inner deadline in milliseconds for sandbox initialisation.
	 */
	const innerSandboxInitDeadlineInMs: number;

	/**
	 * Flag to indicate whether enhanced wrapper is enabled.
	 *
	 * Enabling this flag will wrap any user-provided code within a `with`
	 * statement to limit its scope, as well activate some additional measures,
	 * such as 'fixing' missing or wrongly-set globals and enforcing strict
	 * mode.
	 *
	 * WARNING: This flag has security implications and you should not disable
	 * it without careful consideration.
	 */
	const enhancedWrapper: boolean;

	/**
	 * Flag to indicate whether emulated global context is enabled.
	 *
	 * Enabling this flag will create a Proxy that emulates the global scope,
	 * such that the sandboxed code does not have direct access to alter the
	 * global scope (but it may still affect the global scope through shared
	 * references).
	 *
	 * This flag is most effective in combination with `enhancedWrapper`.
	 *
	 * WARNING: This flag has security implications and you should not disable
	 * it without careful consideration.
	 */
	const emulatedGlobalContext: boolean;

	/**
	 * Flag to indicate whether globals are hardened.
	 *
	 * Enabling this flag will monkey-patch some JavaScript internals known to
	 * support arbitrary code execution (e.g., the Function constructors, eval,
	 * setTimeout, etc) or which are otherwise unsafe.
	 *
	 * WARNING: This flag has security implications and you should not disable
	 * it without careful consideration.
	 */
	const hardenGlobals: boolean;

	/**
	 * Flag to indicate whether unsafe expressions are censored.
	 *
	 * Certain JavaScript expressions are unsafe and cannot be monkey-patched,
	 * such as `import`. Enabling this flag will replace such expressions with
	 * expressions that are safe, at the cost of, in some cases, producing
	 * syntactically-invalid code out of code that was safe.
	 * To avoid the above error, replace all uses of the naked 'import'
	 * word (such as in identifiers) with string notation.
	 * For example, replace:
	 *    'var foo = { country: "utopia", import: "widgets" };'
	 * with:
	 *    'var foo = { country: "utopia", "import": "widgets" };'
	 *
	 * WARNING: This flag has security implications and you should not disable
	 * it without careful consideration.
	 */
	const censorUnsafeExpressions: boolean;

	/**
	 * Flag to indicate whether isolation strategy uses iframe worker.
	 *
	 * (Relevant only for the browser sandbox). Enabling this flag will build
	 * support for running a sandboxed environment that is running in a Worker
	 * placed inside an <IFRAME>. This provides the benefits of a Worker (more
	 * restrictive environment, parallel execution, no access to the DOM, etc.)
	 * with the benefits of an <IFRAME> (separate, more restrictive, CSP from
	 * the parent document).
	 *
	 * WARNING: This flag has security implications and you should not disable
	 * it without careful consideration.
	 */
	const isolationStategyIframeWorker: boolean;

	/**
	 * Flag to indicate whether isolation strategy uses iframe solely.
	 *
	 * The default strategy when starting a sandbox in a browser is to run a
	 * Worker inside an <IFRAME> (see isolationStategyIframeWorker), and, if
	 * that fails (for example, because workers are not supported), to fall
	 * back to running a sandbox just inside an <IFRAME>. This is done for
	 * compatibility and graceful degradation reasons, but it provides less
	 * isolation and having both mechanisms enabled requires about doubling the
	 * bundle size.
	 *
	 * To reduce bundle size, you may disable either this flag or
	 * isolationStategyIframeWorker. If you do not wish to use <IFRAME>s at
	 * all (i.e., you are looking for just a Worker), neither flag is relevant
	 * and you should use a `workerSandbox` directly.
	 *
	 * WARNING: This flag has security implications and is enabled by default.
	 * It can be safely disabled.
	 */
	const isolationStategyIframeSole: boolean;

	/**
	 * Flag to indicate whether bidirectional messaging is enabled.
	 *
	 * The host environment can always communicate with a sandbox instance, but
	 * a sandbox may not always be able to communicate with its host other than
	 * responding. Enabling this flag enables bidirectional commnunication,
	 * which makes it simpler for a sandbox to request outside resources from
	 * its host. For example, this may allow a sandbox to 'fetch' addtional
	 * resources it may need.
	 *
	 * If you do not need this feature, you may disable this flag and thus
	 * also reduce bundle size.
	 *
	 * WARNING: This flag has security implications and is enabled by default.
	 * It can be safely disabled.
	 */
	const bidirectionalMessaging: boolean;

	/**
	 * Flag to indicate whether global types are fixed.
	 *
	 * A sandboxed environment (especially when `emulatedGlobalContext`
	 * is enabled) may be missing certain global variables that are normally
	 * expected to be present by JavaScript code, such as the `Object`
	 * constructor. Enabling this flag ensures that some of these common
	 * globals are available.
	 *
	 * Enabling this flag does not provide access to anything that wouldn't
	 * otherwise have been available to sandboxed code. For instance, while the
	 * decision to make `Object` unavailable may have been deliberate, it is
	 * still possible to access it as `{}.constructor`.
	 *
	 * The goal of this flag is to reduce the odds of code accidentally
	 * breaking due to certain commonly used globals being unavailable.
	 */
	const fixGlobalTypes: boolean;
}
