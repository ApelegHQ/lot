#!/usr/bin/env node

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

import { glob } from 'glob';
import { spawnSync } from 'node:child_process';

if (process.argv.length !== 3) {
	process.stderr.write('Invalid invocation\n');
	process.exit(-1);
}

const jsfiles = await glob(process.argv[2], { ignore: 'node_modules/**' });

const result = spawnSync(
	process.argv[0],
	[
		'--no-warnings=ExperimentalWarning',
		'--loader',
		new URL('./loader.mjs', import.meta.url).toString(),
		'--test',
		...jsfiles,
	],
	{
		stdio: 'inherit',
		windowsHide: true,
	},
);

if (result.status !== null) {
	process.stderr.write(
		`Test process exited with status code: ${result.status}\n`,
	);
	process.exit(result.status);
}

if (result.signal !== null) {
	process.stderr.write(
		`Test process exited due to signal: ${result.signal}\n`,
	);
	process.exit(-1);
}

if (result.error !== null) {
	process.stderr.write(`Test process resulted in an error\n`);
	console.error(result.error);
	process.exit(-1);
}

process.stderr.write('Unknown or invalid state\n');
process.exit(-1);
