const RingCentral = require('@ringcentral/sdk').SDK
const pgdb = require('./db')
require('dotenv').load()

function RCPlatform() {
  this.extensionId = ""
  var clientId = process.env.CLIENT_ID_PROD
  var clientSecret = process.env.CLIENT_SECRET_PROD
  var serverURL = RingCentral.server.production
  this.rcsdk = new RingCentral({
      server: serverURL,
      clientId: clientId,
      clientSecret:clientSecret,
      redirectUri: process.env.RC_APP_REDIRECT_URL
      })
  this.platform = this.rcsdk.platform()
  this.platform.on(this.platform.events.loginSuccess, this.loginSuccess)
  this.platform.on(this.platform.events.logoutSuccess, this.logoutSuccess)
  //this.platform.on(this.platform.events.beforeRefresh, this.beforeRefresh)
  //this.platform.on(this.platform.events.refreshSuccess, this.refreshSuccess)
  this.platform.on(this.platform.events.refreshError, this.refreshError)
  ///*
  var boundFunction = ( async function() {
      console.log("WONDERFUL")
      console.log(this.extensionId);
      var tokenObj = await this.platform.auth().data()
      this.updateUserAccessTokens(JSON.stringify(tokenObj))
  }).bind(this);
  this.platform.on(this.platform.events.refreshSuccess, boundFunction);

  return this
}

RCPlatform.prototype = {
  login: async function(code){
    try{
      var resp = await this.rcsdk.login({
        code: code,
        redirectUri: process.env.RC_APP_REDIRECT_URL
      })
      var tokenObj = await resp.json()
      this.extensionId = tokenObj.owner_id
      this.updateUserAccessTokens(JSON.stringify(tokenObj))
      return  tokenObj.owner_id
    }catch(e){
      console.log('PLATFORM LOGIN ERROR ' + e.message || 'Server cannot authorize user');
      return null
    }
  },
  logout: async function(){
    console.log("logout from platform engine")
    await this.platform.logout()
  },
  getPlatform: async function(extId){
    var tokenObj = await this.platform.auth().data()
    if (extId != tokenObj.owner_id){
      console.log(tokenObj.owner_id)
      console.log(extId)
      console.log("If this ever happens => SERIOUS PROBLEM. Need to check and fix!")
      return null
    }
    if (this.platform.loggedIn()){
        return this.platform
    }else{
        console.log("BOTH TOKEN TOKENS EXPIRED")
        console.log("CAN'T REFRESH: " + e.message)
        return null
    }
  },
  getSDKPlatform: function(){
    return this.platform
  },
  autoLogin: async function(data, callback){
    var jsonObj = JSON.parse(data)
    await this.platform.auth().setData(jsonObj)
    if (await this.platform.loggedIn()){
      console.log("Auto login succeeds")
      callback(null, "Auto login succeeded")
    }else{
      console.log("BOTH TOKEN TOKENS EXPIRED")
      console.log("CAN'T REFRESH: " + e.message)
      callback(e.message, "Auto login Failed")
    }
  },
  getTokens: async function(){
    var tokenObj = await this.platform.auth().data()
    return JSON.stringify(tokenObj)
  },
  updateUserAccessTokens: function(tokenStr) {
    console.log("updateUserAccessTokens")
    var query = "INSERT INTO a2p_sms_users (user_id, account_id, batches, contacts, subscription_id, webhooks, access_tokens)"
    query += " VALUES ($1,$2,$3,$4,$5,$6,$7)"
    var values = [this.extensionId, "", "[]", "[]", "", "", tokenStr]
    query += " ON CONFLICT (user_id) DO UPDATE SET access_tokens='" + tokenStr + "'"
    //console.log(query)
    pgdb.insert(query, values, (err, result) =>  {
      if (err){
        console.error(err.message);
        console.log("QUERY: " + query)
      }else{
        console.log("updateUserAccessTokens DONE");
      }
    })
  },
  // for testing
  loginSuccess: function(e){
    console.log("Login success")
    //console.log(e)
    //this.updateUserAccessTokens()
  },
  logoutSuccess: function(e){
    console.log("logout Success")
  },
  beforeRefresh: function(e){
    console.log("before Refresh")
  },
  refreshSuccess: function(e){
    console.log("refresh Success")
    //this.updateUserAccessTokens()
  },
  refreshError: function(e){
    console.log("refresh Error")
    console.log("Error " + e.message)
  }
}

module.exports = RCPlatform;
