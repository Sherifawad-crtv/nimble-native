// Custom entry point so the crash reporter installs before expo-router/entry's own bootstrap
// runs — a crash inside that bootstrap (route discovery, typed-routes setup) happens before
// app/_layout.tsx is ever reached, so a handler registered there never gets the chance to fire.
require('./src/core/crashReporter');
require('expo-router/entry');
