const RingCentral = require('@ringcentral/sdk').SDK
const pgdb = require('./db')
require('dotenv').load()

function RCPlatform(userId) {
  this.extensionId = ""
  var cachePrefix = `user_${userId}`
  console.log(cachePrefix)
  this.rcsdk = new RingCentral({
      cachePrefix: cachePrefix,
      server: RingCentral.server.production,
      clientId: process.env.CLIENT_ID_PROD,
      clientSecret:process.env.CLIENT_SECRET_PROD,
      redirectUri: process.env.RC_APP_REDIRECT_URL,
    })

  this.platform = this.rcsdk.platform()
  this.platform.on(this.platform.events.loginSuccess, this.loginSuccess)
  this.platform.on(this.platform.events.logoutSuccess, this.logoutSuccess)
  //this.platform.on(this.platform.events.refreshSuccess, this.refreshSuccess)
  this.platform.on(this.platform.events.refreshError, this.refreshError)

  var boundFunction = ( async function() {
      console.log("WONDERFUL")
      console.log(this.extensionId);
      //var tokenObj = await this.platform.auth().data()
      //console.log("REFRESHED TOKENS")
      //this.updateUserAccessTokens(JSON.stringify(tokenObj))
      this.updateUserAccessTokens()
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
      //console.log("NEW LOGIN TOKENS")
      //this.updateUserAccessTokens(JSON.stringify(tokenObj))
      this.updateUserAccessTokens()
      return  tokenObj.owner_id
    }catch(e){
      console.log('PLATFORM LOGIN ERROR ' + e.message || 'Server cannot authorize user');
      return null
    }
  },
  autoLogin: async function(data, callback){
    var tokenObj = JSON.parse(data)
    this.extensionId = tokenObj.owner_id
    this.platform.auth().setData(tokenObj)
    if (await this.platform.loggedIn()){
      console.log("Auto login ok")
      callback(null, "Auto login ok")
    }else{
      console.log("Auto-login failed: BOTH TOKEN TOKENS EXPIRED => Relogin required.")
      callback('failed', "Auto login Failed")
    }
  },
  logout: async function(){
    console.log("logout from platform engine")
    await this.platform.logout()
  },
  getPlatform: async function(extId){
    /*
    var tokenObj = await this.platform.auth().data()
    if (extId  ==  tokenObj.owner_id)
      console.log (`requester: ${extId}  ==  owner: ${tokenObj.owner_id}`)
    else{
      console.log (`requester: ${extId}  !=  owner: ${tokenObj.owner_id}`)
      console.log("If this ever happens => SERIOUS PROBLEM. Need to check and fix!")
      return null
    }
    */
    if (extId  ==  this.extensionId)
      console.log (`requester: ${extId}  ==  owner: ${this.extensionId}`)
    else{
      console.log (`requester: ${extId}  !=  owner: ${this.extensionId}`)
      console.log("If this ever happens => SERIOUS PROBLEM. Need to check and fix!")
      return null
    }
    if (await this.platform.loggedIn()){
        return this.platform
    }else{
        console.log("BOTH TOKEN TOKENS EXPIRED")
        console.log("CAN'T REFRESH")
        return null
    }
  },
  getSDKPlatform: function(){
    return this.platform
  },
  getTokens: async function(){
    var tokenObj = await this.platform.auth().data()
    return JSON.stringify(tokenObj)
  },
  updateUserAccessTokens: async function() {
    console.log("updateUserAccessTokens")
    var tokenObj = await this.platform.auth().data()
    var tokenStr = JSON.stringify(tokenObj)
    //console.log(tokenStr)
    //console.log("===== check token end =====")
    var query = "INSERT INTO a2p_sms_users (user_id, account_id, batches, contacts, subscription_id, webhooks, access_tokens, templates)"
    query += " VALUES ($1,$2,$3,$4,$5,$6,$7,$8)"
    var values = [this.extensionId, "", "[]", "[]", "", "", tokenStr, "[]"]
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
//module.exports = new (require('./platform.js'))();
module.exports = RCPlatform;
