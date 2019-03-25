var RC = require('ringcentral')
var fs = require('fs')
var async = require("async");
require('dotenv').load()


function RCPlatform(userObj, mode) {
  this.token_json = null
  this.extensionId = ""
  this.accountId = ""
  this.parent = userObj
  var rcsdk = null
  if (mode == "production"){
    rcsdk = new RC({
      server:RC.server.production,
      appKey: process.env.CLIENT_ID_PROD,
      appSecret:process.env.CLIENT_SECRET_PROD
    })
  }else if (mode == "sandbox"){
    rcsdk = new RC({
      server:RC.server.sandbox,
      appKey: process.env.CLIENT_ID_SB,
      appSecret:process.env.CLIENT_SECRET_SB
    })
  }
  this.platform = rcsdk.platform()
  return this
}

RCPlatform.prototype = {
  setAccountId: function(accountId){
    this.accountId = accountId
  },
  login: function(code, callback){
    var thisPlatform = this
    this.platform.login({
      code: code,
      redirectUri: process.env.RC_APP_REDIRECT_URL
    })
    .then(function (token) {
      var json = token.json()
      //console.log("ACCOUNT INFO" + JSON.stringify(json))
      var newToken = {}
      newToken['access_token'] = json.access_token
      newToken['expires_in'] = json.expires_in
      newToken['token_type'] = json.token_type
      newToken['refresh_token'] = json.refresh_token
      newToken['refresh_token_expires_in'] = json.refresh_token_expires_in
      newToken['login_timestamp'] = Date.now() / 1000
      //console.log("ACCESS-TOKEN-EXPIRE-IN: " + json.expires_in)
      //console.log("REFRESH-TOKEN-EXPIRE-IN: " + json.refresh_token_expires_in)
      thisPlatform.token_json = newToken
      thisPlatform.extensionId = json.owner_id
      return callback(null, json.owner_id)
    })
    .catch(function (e) {
      console.log('PLATFORM LOGIN ERROR ' + e.message || 'Server cannot authorize user');
      return callback(e, e.message)
    });
  },
  logout: function(){
    this.platform.logout()
  },
  getPlatform: function(){
    var token = this.token_json
    if (token == null)
      return this.platform
    var timestamp = Date.now() / 1000
    var consumedTime = (timestamp - token.login_timestamp)
    //console.log("CONSUMED: " + consumedTime)
    token.login_timestamp = timestamp
    token.expires_in = token.expires_in - consumedTime
    if (token.expires_in < 0)
      token.expires_in = 0
    token.refresh_token_expires_in = token.refresh_token_expires_in - consumedTime
    if (token.refresh_token_expires_in < 0)
      token.refresh_token_expires_in = 0
    this.token_json = token
    var thisPlatform = this.platform
    var data = this.platform.auth().data();
    data.token_type = token.token_type
    data.expires_in = token.expires_in
    data.access_token = token.access_token
    data.access_token_ttl = 3600
    data.refresh_token_expires_in = token.refresh_token_expires_in
    this.platform.auth().setData(data)

    if (this.platform.auth().accessTokenValid()) { // access token is still valid
      //console.log("ACCESS TOKEN VALID: " + token.expires_in)
      return this.platform
    }else if (this.platform.auth().refreshTokenValid()) {
      // access token expired => check refresh_token
      //console.log("ACCESS TOKEN EXPIRED: " + token.expires_in)
      // refresh token
      this.platform.on(this.platform.events.refreshError, function(e){
        console.log("CAN'T REFRESF: " + e.message)
      });
      this.platform.on(this.platform.events.refreshSuccess, function(e){
        console.log("REFRESH SUCCESS")
        var data = thisPlatform.auth().data();
        token.token_type = data.token_type
        token.expires_in = data.expires_in
        token.access_token = data.access_token
        token.refresh_token_expires_in = data.refresh_token_expires_in
        token.login_timestamp = Date.now() / 1000
        //console.log("NEW TOKEN: " + JSON.stringify(token))
        this.token_json = token
      });
      this.platform.refresh()
      return this.platform
    }else{
      // forceLogin
      console.log("BOTH TOKEN TOKENS EXPIRED")
      return null
    }
  }
}

module.exports = RCPlatform;
