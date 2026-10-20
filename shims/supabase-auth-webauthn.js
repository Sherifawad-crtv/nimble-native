// Stub for @supabase/auth-js's WebAuthn (passkey) support, aliased in via metro.config.js.
//
// GoTrueClient's constructor eagerly runs `new webauthn_1.WebAuthnApi(this)` regardless of
// whether the app ever uses passkeys — unconditionally, every time a Supabase client is created.
// That module (and its dependents) crashes under Metro/Hermes with "undefined cannot be used as
// a constructor" (confirmed via metro-symbolicate against a real device crash; the same code
// loads fine under plain Node, so this is a React Native/Hermes-specific bundling issue, not a
// logic bug in our code). Nimble never uses passkeys, so this app-level shim makes the whole
// problem permanently moot — it is never a real backend/behavioral difference the user can hit.
class WebAuthnApi {
  constructor() {}
}

function unsupported() {
  throw new Error('WebAuthn is not supported in this app.');
}

module.exports = {
  WebAuthnApi,
  webAuthnAbortService: { createNewAbortSignal: unsupported, cancelCeremony() {} },
  browserSupportsWebAuthn: () => false,
  createCredential: unsupported,
  getCredential: unsupported,
  deserializeCredentialCreationOptions: unsupported,
  deserializeCredentialRequestOptions: unsupported,
  serializeCredentialCreationResponse: unsupported,
  serializeCredentialRequestResponse: unsupported,
};
