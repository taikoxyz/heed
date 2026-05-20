# Security

## Pinata JWT storage

The web app needs a Pinata JWT to pin encrypted mail to IPFS. The JWT is
stored **unencrypted** in the browser's `localStorage` under the
`heed:settings` key.

### Threat model / tradeoff

- `localStorage` is plaintext on disk and readable by any JavaScript running
  on the app's origin. A cross-site scripting (XSS) bug, a malicious
  dependency, or a compromised browser extension with access to the origin
  can read the token.
- There is no key-encryption-at-rest in the browser: any key we could use to
  encrypt the JWT would itself have to live on the same origin, so it would
  not raise the bar against an attacker who can already run scripts here.
- We accept this tradeoff because the alternative (server-side key custody)
  would undermine the client-only, self-custodial design of Heed.

### Recommendations

- Use a **scoped** Pinata key limited to `pinFileToIPFS` / `pinJSONToIPFS`,
  never an account-wide admin key.
- Clear the JWT when you are done sending (Settings → "Clear JWT") or wipe
  all local state (Settings → "Clear all settings").
- Treat any device where the JWT has been entered as holding a pinning
  credential until it is cleared.

## Reporting a vulnerability

Please open a private security advisory or contact the maintainers rather
than filing a public issue for sensitive reports.
