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

import esbuild from 'esbuild';

export default (
	resolveDir: string,
	path: string,
	exportName: string,
): Promise<string> =>
	esbuild
		.build({
			stdin: {
				contents: `import { ${exportName} as $$ } from ${JSON.stringify(
					path,
				)}; self[${JSON.stringify(exportName)}] = $$; self.m = $$;`,
				loader: 'js',
				resolveDir: resolveDir,
				sourcefile: 'browser-bundle.mjs',
			},
			bundle: true,
			format: 'iife',
			platform: 'node',
			write: false,
		})
		.then((buildResult) => buildResult.outputFiles[0].text);
