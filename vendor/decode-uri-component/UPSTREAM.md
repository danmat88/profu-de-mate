# CommonJS compatibility for the upstream security fix

Source: https://raw.githubusercontent.com/SamVerschueren/decode-uri-component/v0.5.0/index.js

Upstream SHA-256: 9401353df38f8010ad7035fe8d666bce6a4902bc1cff809afc4ab23fa2e0bdaa

Only the default export is changed to module.exports. query-string 7 requires a CommonJS callable; overriding it with upstream ESM directly changes that contract in Metro. Keep the MIT license. Remove this compatibility copy when React Navigation upgrades its query-string dependency. This file is a source backport, not an assertion about reachability of a vulnerability.
