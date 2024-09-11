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

export type TOp<
	T,
	TK = T extends object ? keyof T : string,
> = TK extends keyof T
	? T[TK] extends (...args: never) => unknown
		? TK
		: never
	: TK;
export type TOpArgs<
	T,
	TK = T extends object ? keyof T : string,
> = TK extends keyof T
	? T[TK] extends (...args: infer A) => unknown
		? A
		: never
	: unknown[];
export type TOpRet<
	T,
	TK = T extends object ? keyof T : string,
> = TK extends keyof T
	? Awaited<T[TK] extends (...args: never) => infer R ? R : never>
	: unknown;

/**
 * Interface representing a function to perform a task.
 */
export interface IPerformTask<T = unknown> {
	/**
	 * Performs a task.
	 *
	 * @param op - The operation to be performed.
	 * @param args - Variable list of arguments.
	 * @returns Returns a promise resolving to the result.
	 */
	(op: TOp<T>, ...args: TOpArgs<T>): Promise<TOpRet<T>>;
}

/**
 * Interface representing a function to execute a script in a sandboxed
 * environment.
 */
export interface ISandbox<T = unknown> {
	/**
	 * Executes a script in a sandbox.
	 *
	 * @param script - The script to be executed.
	 * @param allowedGlobals - Optional list of allowed global variables.
	 * @param externalMethods - Optional dictionary of external methods or
	 * variables available as globals to the script.
	 * @param abort - Optional abort signal to terminate the execution.
	 * @param options - Optional configuration options for the sandbox.
	 * @returns Returns a promise resolving to a function that can perform
	 * sandboxed tasks.
	 */
	(
		script: string,
		allowedGlobals?: string[] | undefined | null,
		externalMethods?: Record<string, unknown> | null,
		abort?: AbortSignal,
		options?: TSandboxOptions,
	): Promise<IPerformTask<T>>;
}

/**
 * Type representing the context in which the sandboxed script is executed.
 */
export type TContext = Record<PropertyKey, unknown> & {
	/** The global `this` reference within the context. */
	globalThis: TContext;
	/** Represents the commonJS module object with its exports. */
	module: { exports: unknown };
};

/**
 * Type representing the configuration options for the sandbox.
 */
export type TSandboxOptions = {
	/**
	 * Indicates if the worker should be treated like a browser or node.js worker.
	 * If true, the worker is a browser worker. Otherwise, it's treated as a node.js worker.
	 */
	browserRequireWorker?: boolean;
	/** The type of the worker to be used (e.g., "classic", "module"). */
	workerType?: WorkerOptions['type'];
};
