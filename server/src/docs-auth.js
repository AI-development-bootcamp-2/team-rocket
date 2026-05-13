// Injected into the Swagger UI page to auto-authorize using the existing session.
// Calls /auth/refresh (browser sends the httpOnly refreshToken cookie automatically)
// and pre-fills the bearerAuth token so no manual copy-paste is needed.
window.addEventListener('load', function () {
  fetch('/auth/refresh', { method: 'POST', credentials: 'include' })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.accessToken) return;
      var t = setInterval(function () {
        if (window.ui) {
          window.ui.preauthorizeApiKey('bearerAuth', data.accessToken);
          clearInterval(t);
        }
      }, 100);
    })
    .catch(function () {});
});
