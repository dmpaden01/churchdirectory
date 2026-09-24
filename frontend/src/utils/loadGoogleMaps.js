// Loads the Google Maps JavaScript API once per page load and resolves with
// `google.maps`. Loaded on demand (only when the Family Map is opened) since
// every load of the API counts toward Google's billing.
let loading = null;
let authFailureHandler = null;

// Google reports a rejected key (wrong referrer, API not enabled, billing
// off) only through this global callback, after the script itself loaded.
window.gm_authFailure = () => authFailureHandler?.();

export function onGoogleMapsAuthFailure(handler) {
  authFailureHandler = handler;
  return () => { if (authFailureHandler === handler) authFailureHandler = null; };
}

export function loadGoogleMaps(apiKey) {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const callback = '__churchDirectoryMapsReady';
      window[callback] = () => {
        delete window[callback];
        resolve(window.google.maps);
      };
      const script = document.createElement('script');
      script.src = 'https://maps.googleapis.com/maps/api/js'
        + `?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=${callback}`;
      script.async = true;
      script.onerror = () => {
        loading = null;
        script.remove();
        reject(new Error('Could not load Google Maps.'));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}
