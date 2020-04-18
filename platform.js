var RC = require('ringcentral')
var fs = require('fs')
var async = require("async");
require('dotenv').load()


function RCPlatform(userObj, mode) {
  this.token_json = null
  this.extensionId = ""
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
  }
}

module.exports = RCPlatform;
