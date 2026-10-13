# Passkey Smart-Wallet Prototype (`#44`)

## Architecture Choice: WebAuthn `secp256r1` (ES256) + Soroban Custom Account (`passkey-kit` pattern)

Soroban natively supports `secp256r1` (`verify_sig_ecdsa_secp256r1` host function introduced in Protocol 21) and custom account contracts (`__check_auth`). Following the `passkey-kit` / SEP-0051 architecture:

1. **Passkey Registration (`navigator.credentials.create`)**:
   - Requests an `ES256` (`alg: -7`, `P-256` / `secp256r1`) platform or roaming authenticator passkey bound to the contributor's handle and origin RP ID.
   - Extracts the credential ID and public key bytes to deterministically derive the contributor's testnet smart-wallet account identifier.
2. **Feature Flag**:
   - Controlled via `VITE_ENABLE_PASSKEY_WALLET=true` at build time or `localStorage.setItem('parallax-passkey-wallet', '1')` at runtime in `/me/settings`.
   - When the flag is off (the default), `/me/settings` behaves identically to the standard Stellar `G…` address input.

## Browser Compatibility

| Browser / Platform | Status | Notes |
| :--- | :--- | :--- |
| **Chrome (macOS, Windows, Android)** | Supported | Uses Google Password Manager, Windows Hello, or Touch ID (`alg: -7`). |
| **Safari (macOS 16+, iOS 16+)** | Supported | Syncs across devices via iCloud Keychain with Face ID / Touch ID. |
| **Edge (Windows, macOS)** | Supported | Uses Windows Hello or platform authenticator. |
| **Firefox (Linux without FIDO2 key)** | Partial | Requires a hardware FIDO2 security key (e.g. YubiKey) if no OS platform authenticator is configured. |

## Recovery & Risk Model

- **Cloud-Synced Passkeys (iCloud Keychain / Google Password Manager)**:
  - If a contributor loses a phone or laptop, their passkey is restored automatically when signing into their Apple ID or Google account on a new device.
- **Single-Device Hardware Passkeys (Windows Hello / Hardware Security Key)**:
  - Device-bound passkeys do not leave the TPM. Production smart-wallet contracts should register a secondary recovery signer (e.g. a backup passkey on a second device or a guardian address) before holding large balances.
- **RP ID Domain Binding Risk**:
  - WebAuthn credentials are scoped to the relying party domain (`rp.id`). If Parallax changes its primary domain in the future, existing passkeys bound to the old domain cannot sign for the new origin unless a secondary signer or migration window is provided.
