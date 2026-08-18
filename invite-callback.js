(() => {
  "use strict";

  function parseInviteCallback(href) {
    const url = new URL(href, "https://example.invalid/");
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    if (url.searchParams.has("code")) return {type:"pkce"};
    if (hash.has("access_token") && hash.has("refresh_token")) return {type:"implicit"};
    return {type:"none"};
  }

  window.CHEM_INVITE_CALLBACK = Object.freeze({parseInviteCallback});
})();
