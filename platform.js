var RC = require('ringcentral')

function RCPlatform() {
  this.extensionId = ""
  this.accountId = ""
  var rcsdk = new RC({
      server:RC.server.production,
      appKey: process.env.CLIENT_ID_PROD,
      appSecret:process.env.CLIENT_SECRET_PROD
  })
  this.platform = rcsdk.platform()
  return this
}

RCPlatform.prototype = {
  setAccountId: function(accountId){
    this.accountId = accountId
  },
  login: function(code, callback){
    var thisPlatform = this
    this.platform.on(this.platform.events.loginSuccess, this.loginSuccess)
    this.platform.on(this.platform.events.logoutSuccess, this.logoutSuccess)
    this.platform.on(this.platform.events.beforeRefresh, this.beforeRefresh)
    this.platform.on(this.platform.events.refreshSuccess, this.refreshSuccess)
    this.platform.on(this.platform.events.refreshError, this.refreshError)

    this.platform.login({
      code: code,
      redirectUri: process.env.RC_APP_REDIRECT_URL
    })
    .then(function (token) {
      var json = token.json()
      return callback(null, json.owner_id)
    })
    .catch(function (e) {
      console.log('PLATFORM LOGIN ERROR ' + e.message);
      return callback(e, e.message)
    });
  },
  logout: function(){
    this.platform.logout()
  },
  getSDKPlatform: function(){
      return this.platform
  },
  getPlatform: function(callback){
    if (this.platform.loggedIn()){
        callback(null, this.platform)
    }else{
        console.log("BOTH TOKEN TOKENS EXPIRED")
        console.log("CAN'T REFRESH: " + e.message)
        callback("Login", null)
    }
  },
  // for testing
  loginSuccess: function(e){
    console.log("Login success")
  },
  logoutSuccess: function(e){
    console.log("logout Success")
  },
  beforeRefresh: function(e){
    console.log("before Refresh")
  },
  refreshSuccess: function(e){
    console.log("refresh Success")
  },
  refreshError: function(e){
    console.log("refresh Error")
    console.log("Error " + e.message)
  }
}

module.exports = RCPlatform;
