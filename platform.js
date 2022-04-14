const RingCentral = require('@ringcentral/sdk').SDK
const pgdb = require('./db')

function RCPlatform(userId) {
  this.extensionId = ""
  var cachePrefix = `user_${userId}`

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
  this.platform.on(this.platform.events.refreshError, this.refreshError)

  var boundFunction = ( async function() {
      console.log(`WONDERFUL ext id ${this.extensionId}`)
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
      tokenObj = await this.platform.auth().data()
      this.updateUserAccessTokens(JSON.stringify(tokenObj))
      return  tokenObj.owner_id
    }catch(e){
      console.log('PLATFORM LOGIN ERROR ' + e.message || 'Server cannot authorize user');
      return null
    }
  },
  autoLogin: async function(data, callback){
    var tokenObj = JSON.parse(data)
    this.extensionId = tokenObj.owner_id
    await this.platform.auth().setData(tokenObj)
    if (await this.platform.loggedIn()){
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
    if (extId  !=  this.extensionId){
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
  updateUserAccessTokens: function(tokenStr) {
    console.log("updateUserAccessTokens")
    var query = "INSERT INTO a2p_sms_users (user_id, account_id, batches, contacts, subscription_id, webhooks, access_tokens, templates, reputation_score)"
    query += " VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)"
    var values = [this.extensionId, "", "[]", "[]", "", "", tokenStr, "[]", "[]"]
    query += ` ON CONFLICT (user_id) DO UPDATE SET access_tokens='${tokenStr}'`
    //console.log(query)
    pgdb.insert(query, values, (err, result) =>  {
      if (err){
        console.error(err.message);
      }else{
        console.log("updateUserAccessTokens DONE");
      }
    })
  },
  loginSuccess: function(e){
    console.log("Login success")
  },
  logoutSuccess: function(e){
    console.log("logout Success")
  },
  refreshError: function(e){
    console.log("refresh Error")
    console.log("Error " + e.message)
  }
}

module.exports = RCPlatform;
