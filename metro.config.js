// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const originalResolveRequest = config.resolver.resolveRequest;

// @supabase/auth-js's WebAuthn module crashes under Metro/Hermes at require() time, regardless of
// whether the app uses passkeys — see shims/supabase-auth-webauthn.js for the full story.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.endsWith('/lib/webauthn') || moduleName.endsWith('/lib/webauthn.js')) {
    return { type: 'sourceFile', filePath: require.resolve('./shims/supabase-auth-webauthn.js') };
  }
  if (originalResolveRequest) return originalResolveRequest(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
