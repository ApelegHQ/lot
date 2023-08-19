# 🏜️ @exact-realty/lot 🏖️

 [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=Exact-Realty_ecmascript-sandbox&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=Exact-Realty_ecmascript-sandbox)
 [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=Exact-Realty_ecmascript-sandbox&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=Exact-Realty_ecmascript-sandbox)
 [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=Exact-Realty_ecmascript-sandbox&metric=bugs)](https://sonarcloud.io/summary/new_code?id=Exact-Realty_ecmascript-sandbox)
 [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Exact-Realty_ecmascript-sandbox&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=Exact-Realty_ecmascript-sandbox)
 [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=Exact-Realty_ecmascript-sandbox&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=Exact-Realty_ecmascript-sandbox)
 ![NPM Downloads](https://img.shields.io/npm/dw/@exact-realty/lot?style=flat-square)

Welcome to `@exact-realty/lot` — the versatile ECMAScript sandbox
you've been looking for!

Our sandbox supports multiple runtimes and allows for bidirectional
communication, ensuring you have the flexibility and security to run your code
in various environments. 

### 🚀 Features

- Support for multiple runtimes:
    * Browser (using an iframe with a worker inside or just an iframe)
    * Dedicated worker (can run in the browser or with Deno)
    * Node.js
- Browser isolation using Content Security Policy (CSP)
- Message passing using the `MessageEvent` class and event listeners for secure
  communication using the structured clone algorithm
- Hardening of global variables, including `Function` and `eval`, to prevent
  direct code execution
- Bidirectional communication, enabling the parent to call into the sandbox and
  vice versa

### 💻 Installation

To install, run:

```sh
npm install "@exact-realty/lot"
```

```sh
yarn add "@exact-realty/lot"
```

### 📚 Usage

Using our sandbox is easy! First, import the desired sandbox function, then call
it with your code and any additional parameters. Here's an example using
`browserSandbox`:

```js
import { browserSandbox } from '@exact-realty/ecmascript-sandbox';

const sandbox = await browserSandbox(`
  /* sandboxed code*/;
  module.exports={hello:(name)=>\`Hello, ${name}!\`}; 
`);
const result = await sandbox('hello', 'World');
console.log(result); // Output: "Hello, World!"
```

Our sandbox provides two interfaces:

```typescript
export interface IPerformTask {
  (op: string, ...args: unknown[]): Promise<unknown>;
}

export interface ISandbox {
  (
    script: string,
    allowedGlobals?: string[] | undefined | null,
    externalMethods?: Record<string, unknown> | null,
    abort?: AbortSignal,
    options?: TSandboxOptions,
  ): Promise<IPerformTask>;
}

export type TSandboxOptions = {
	browserRequireWorker?: boolean;
	workerType?: WorkerOptions['type'];
}
```

`ISandbox` is an interface for the `browserSandbox`, `nodejsSandbox` and
`workerSandbox` functions. It takes a string `script` representing the code to
be sandboxed, an optional array of allowed global variables `allowedGlobals`, an
optional object of external methods `externalMethods`, and an optional
AbortSignal `abort`. It returns a promise that resolves to an implementation of
`IPerformTask`.

`IPerformTask` is an interface for the result of the various sandbox function.
It takes a string `op` representing the function name and a list of arguments,
and it returns a promise that resolves to the result of the task.

The script to be sandboxed, `script`, must expose an object in `module.exports`
with a dictionary of the different functions that can be called from outside.
The type of `module.exports` is `Record<string, typeof Function.prototype>`.

### 🤝 Contributing

We welcome any contributions and feedback! Please feel free to submit pull
requests, bug reports or feature requests to our GitHub repository.

### ❗️ Disclaimer

⚠️ Please note that even though we have implemented several security measures,
it's important to understand that sandbox escapes are always a possibility.
Running untrusted code in Node.js is especially risky due to its inherent
platform limitations. Our sandbox relies on `node:vm`, which was not designed
for running untrusted code.

To mitigate these risks, we strongly recommend taking a security-in-depth
approach and relying on additional security mechanisms such as process
isolation, `seccomp(2)`, `pledge(2)`, `ProcessSystemCallDisablePolicy` and
SELinux, to name a few. Where feasible, we also recommend static code analysis
and code reviews, as well as adequate auditing and logging.

Note that the sandbox does not prevent denial-of-service attacks such as
infinite loops or memory exhaustion. It's important to take appropriate measures
to prevent these types of attacks, such as setting resource limits or using
timeouts.

### 📜 License

This project is released under the ISC license. Check out the `LICENSE` file for
more information.
