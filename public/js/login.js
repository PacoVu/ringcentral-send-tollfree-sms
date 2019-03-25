var OAuthCode = function(authUri, redirectUri) {
    this.loginPopup  = function() {
      this.loginPopupUri(authUri, redirectUri);
    }
    this.loginPopupUri  = function(authUri, redirectUri) {
      var win         = window.open(authUri, 'windowname1', 'width=800, height=600');
      var pollOAuth   = window.setInterval(function() {
        try {
          if (win.document.URL.indexOf(redirectUri) != -1) {
            window.clearInterval(pollOAuth);
            win.close();
            window.setTimeout(function() {
              window.location.href = "loadsmspage"
            }, 100)
          }
        } catch(e) {
          console.log(e)
      }
    }, 100);
  }
}

function login() {
  var oauth = new OAuthCode(window.RC_AUTHORIZE_URI, window.RC_APP_REDIRECT_URL);
  oauth.loginPopup()
}

function chooseEnvironment(environemt){
  window.location.href = "login?env=" + environemt
}
