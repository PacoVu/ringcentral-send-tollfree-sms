//const User = require('./usershandler.js')

const pgdb = require('./db')
const async = require('async')
require('dotenv').load()
var users = []

var activeUsers = []
//exports.activeUsers = activeUsers
createUserTable()

function createUsersAdditionalDataTable() {
  var query = "CREATE TABLE IF NOT EXISTS a2p_sms_users_tempdata (user_id VARCHAR(15) PRIMARY KEY, active_survey TEXT DEFAULT '[]', rejected_numbers TEXT DEFAULT '[]')"
  pgdb.create_table(query, (err, res) => {
    if (err) {
      console.log(err.message)
    }else{
      console.log("createUsersAdditionalDataTable DONE")
    }
    autoStart()
  })
}

function createUserTable() {
  var query = 'CREATE TABLE IF NOT EXISTS a2p_sms_users '
  query += "(user_id VARCHAR(16) PRIMARY KEY, account_id VARCHAR(16) NOT NULL, batches TEXT DEFAULT '[]', contacts TEXT DEFAULT '[]', subscription_id VARCHAR(64), webhooks TEXT, access_tokens TEXT, templates TEXT DEFAULT '[]', reputation_score INT DEFAULT 1000)"
  pgdb.create_table(query, (err, res) => {
    if (err) {
      console.log(err.message)
    }else{
      console.log("createUserTable DONE")
    }
    createUsersAdditionalDataTable()
  })
}

function autoStart(){
  console.log("New autoStart")
  var RCPlatform = require('./platform.js');
  var ActiveUser = require('./event-engine.js');

  var query = `SELECT user_id, active_survey FROM a2p_sms_users_tempdata`
  pgdb.read(query, (err, result) => {
    if (err){
      console.error(err.message);
    }else{
      if (result.rows){
        async.forEachLimit(result.rows, 1, function(user, setupNextUser){
            async.waterfall([
              function setupNextUser(done) {
                // create platform
                if (user.active_survey != '[]'){
                  query = `SELECT user_id, subscription_id, access_tokens FROM a2p_sms_users WHERE user_id='${user.user_id}'`
                  pgdb.read(query, (err, result) => {
                    if (!err && result.rows.length > 0){
                      var accessTokens = result.rows[0].access_tokens
                      var userId = result.rows[0].user_id
                      var subscriptionId =  result.rows[0].subscription_id
                      //console.log("SAVED TOKENS")
                      //console.log(accessTokens)
                      //console.log("========")
                      var platform = new RCPlatform(userId)
                      platform.autoLogin(accessTokens, (err, res) => {
                        var aUser = new ActiveUser(userId, subscriptionId)
                        if (!err){
                          console.log("Auto login succeeded")
                          aUser.autoSetup(platform, (err, result) => {
                            console.log("setup: " + result)
                            if (err == null && result > 0){
                              activeUsers.push(aUser)
                              console.log("activeUsers.length: " + activeUsers.length)
                            }
                            done()
                          })
                        }else{
                          console.log("Auto login failed")
                          aUser.autoSetup(null, (err, result) => {
                            if (err == null && result > 0){
                              activeUsers.push(aUser)
                              console.log("activeUsers.length: " + activeUsers.length)
                            }
                            done()
                          })
                        }
                      })
                    }else{
                      console.error(err.message);
                      done()
                    }
                  })
                }else{
                  done()
                }
              }
            ], function (error, success) {
              if (error) {
                console.log('Some error!');
              }
              setupNextUser()
            });
          }, function(err){
            console.log("autoStart completed")
          });
      }
    }
  })
}

function autoStart_old(){
  console.log("autoStart")
  var RCPlatform = require('./platform.js');
  var ActiveUser = require('./event-engine.js');

  var query = `SELECT user_id, subscription_id, access_tokens FROM a2p_sms_users`
  pgdb.read(query, (err, result) => {
    if (err){
      console.error(err.message);
    }else{
      if (result.rows){
        async.forEachLimit(result.rows, 1, function(user, setupNextUser){
            async.waterfall([
              function setupNextUser(done) {
                // create platform
                if (user.access_tokens.length > 0){
                  console.log("SAVED TOKENS")
                  console.log(user.access_tokens)
                  console.log("========")
                  var platform = new RCPlatform(user.user_id)
                  //var platform = new (require('./platform.js'))(user.user_id);
                  platform.autoLogin(user.access_tokens, (err, res) => {
                    var aUser = new ActiveUser(user.user_id, user.subscription_id)
                    if (!err){
                      console.log("Auto login succeeded")
                      aUser.autoSetup(platform, (err, result) => {
                        console.log("setup: " + result)
                        if (err == null && result > 0){
                          activeUsers.push(aUser)
                          console.log("activeUsers.length: " + activeUsers.length)
                        }
                        done()
                      })
                    }else{
                      console.log("Auto login failed")
                      aUser.autoSetup(null, (err, result) => {
                        if (err == null && result > 0){
                          activeUsers.push(aUser)
                          console.log("activeUsers.length: " + activeUsers.length)
                        }
                        done()
                      })
                    }
                  })
                }else{
                  done()
                }
              }
            ], function (error, success) {
              if (error) {
                console.log('Some error!');
              }
              setupNextUser()
            });
          }, function(err){
            console.log("autoStart completed")
          });
      }
    }
  })
}

function getUserIndex(id){
  for (var i=0; i<users.length; i++){
    var user = users[i]
    if (user != null){
      if (id == user.getUserId()){
        return i
      }
    }
  }
  return -1
}

function getUserIndexByExtensionId(extId){
  for (var i=0; i<users.length; i++){
    var user = users[i]
    if (extId == user.getExtensionId()){
      return i
    }
  }
  return -1
}

function makeId() {
  var text = "";
  var possible = "-~ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 1; i < 65; i++){
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

var router = module.exports = {
  getActiveUsers: function(){
    return activeUsers
  },
  loadLogin: function(req, res){
    if (req.session.userId == 0 || req.session.extensionId == 0) {
      var id = makeId() //new Date().getTime()
      req.session.userId = id;
      //var user = new User(id)
      var user = new (require('./usershandler.js'))(id);
      users.push(user)
      var p = user.getPlatform()
      if (p != null){
        res.render('login', {
          authorize_uri: p.loginUrl({
            brandId: process.env.RINGCENTRAL_BRAND_ID,
            redirectUri: process.env.RC_APP_REDIRECT_URL
          }),
          redirect_uri: process.env.RC_APP_REDIRECT_URL,
          token_json: ''
        });
      }
    }else{
      console.log("Must be a reload page")
      var index = getUserIndex(req.session.userId)
      if (index >= 0)
        users[index].loadOptionPage(req, res)
      else{
        this.forceLogin(req, res)
      }
    }
  },
  forceLogin: function(req, res){
    console.log("FORCE LOGIN")
    req.session.destroy();
    res.render('index')
  },
  /*
  login: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].login(req, res, function(err, extensionId){
      // result contain extensionId. Use it to check for orphan user and remove it
      if (!err){
        console.log("USERLENGTH: " + users.length)
        var shouldReplace = false
        var oldUser = null
        var newUser = null
        var oldUserIndex = -1
        var newUserIndex = -1
        for (var i = 0; i < users.length; i++){
          console.log("REPLACING")
          var extId = users[i].getExtensionId()
          var userId = users[i].getUserId()
          if (extId == extensionId && userId == req.session.userId){ // new user
            newUser = users[i]
            newUserIndex = i
            if (oldUser != null){
              req.session.userId = oldUser.getUserId()
              users[newUserIndex] = null
              users.splice(newUserIndex, 1);
              break
            }
          }
          if (extId == extensionId && userId != req.session.userId){ // old user
            oldUser = users[i]
            oldUserIndex = i
            if (newUser != null){
              req.session.userId = userId
              users[newUserIndex] = null
              users.splice(newUserIndex, 1);
              break
            }
          }
        }
      }
    })
  },
  */
  login: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].login(req, res, function(err, extensionId){
      // result contain extensionId. Use it to check for orphan user and remove it
      if (!err){
        console.log("USERLENGTH: " + users.length)
        for (var i = 0; i < users.length; i++){
          console.log("DETECTING OLD USER INSTANCE")
          if (i != index){
            var extId = users[i].getExtensionId()
            var userId = users[i].getUserId()
            if (extId == extensionId && userId != req.session.userId){ // old user
              console.log("Removed old user instance!")
              users[i] = null
              users.splice(i, 1);
              break
            }
          }
        }
      }
    })
  },
  logout: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0){
      return this.forceLogin(req, res)
    }
    var thisObj = this
    users[index].logout((err, result) =>{
      if (result == 0){
        console.log("removing user")
        users[index] = null
        users.splice(index, 1)
      }else {
        console.log("keeping this user")
      }
      thisObj.forceLogin(req, res)
    })
  },
  pollNewMessages: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].pollNewMessages(res)
  },
  pollAnalyticsResult: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].pollAnalyticsResult(res)
  },
  getContacts: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].getContacts(res)
  },
  readCampaignSummary: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].readCampaignSummary(res, req.query.batchId, req.query.ts)
  },
  readCampaignDetails: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].readCampaignDetails(res, req.query.batchId, req.query.pageToken)
  },
  getBatchResult: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].getBatchResult(req, res)
  },
  getStandardSMSResult: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].getStandardSMSResult(req, res)
  },
  readMessageList: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].readMessageList(req, res, "")
  },
  readOptedOutNumber: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].readOptedOutNumber(req, res, "")
  },
  readCampaignsLogFromDB: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].readCampaignsLogFromDB(res)
  },
  readVoteReports: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].readVoteReports(res)
  },
  deleteSurveyResult: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].deleteSurveyResult(req, res)
  },
  downloadSurveyResult: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].downloadSurveyResult(req, res)
  },
  downloadBatchReport: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].downloadBatchReport(req, res)
  },
  downloadInvalidNumbers: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].downloadInvalidNumbers(req, res)
  },
  deleteCampaignResult: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].deleteCampaignResult(req, res)
  },
  /*
  downloadVoteReport: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].downloadVoteReport(req, res)
  },
  */
  getMessagingAnalytics: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].getMessagingAnalytics(req, res)
  },
  downloadAnalytics: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].downloadAnalytics(req, res)
  },
  downloadHVMessageStore: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].downloadHVMessageStore(req, res)
  },
  downloadStandardSMSReport: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].downloadStandardSMSReport(req, res)
  },
  sendSMSMessage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].sendSMSMessageAsync(req, res)
  },
  sendBroadcastMessage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].sendBroadcastMessage(req, res)
  },
  sendIndividualMessage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].sendIndividualMessage(req, res)
  },
  sendHighVolumeMessage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].sendHighVolumeMessage(req, res)
  },
  uploadContacts: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].uploadContacts(req, res)
  },
  deleteContacts: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].deleteContacts(req, res)
  },
  setWebhookAddress: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].setWebhookAddress(req, res)
  },
  saveTemplate: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].saveTemplate(req, res)
  },
  deleteTemplate: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].deleteTemplate(req, res)
  },
  deleteSignature: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].deleteSignature(req, res)
  },
  deleteWebhookAddress: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].deleteWebhookAddress(res)
  },
  readWebhookAddress: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].readWebhookAddress(res)
  },
  readTemplates: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].readTemplates(res)
  },
  postFeedbackToGlip: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].postFeedbackToGlip(req)
    res.send({"status":"ok","message":"Thank you for sending your feedback!"})
  },
  loadOptionPage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].loadOptionPage(req, res)
  },
  loadStandardSMSPage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].loadStandardSMSPage(res)
  },
  /*
  loadHVManualPage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].loadHVManualPage(res)
  },
  loadConvSMSPage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].loadConvSMSPage(res)
  },
  */
  loadSettingsPage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].loadSettingsPage(res)
  },
  loadHVSMSPage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].loadHVSMSPage(res)
  },
  loadCampaignHistoryPage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].loadCampaignHistoryPage(res)
  },
  loadMessageStorePage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].loadMessageStorePage(res)
  },
  loadAnalyticsPage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].loadAnalyticsPage(res)
  },
  setDelayInterVal: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].setDelayInterVal(req, res)
  },
  pauseMessageSending: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].pauseMessageSending(req, res)
  },
  resumeMessageSending: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].resumeMessageSending(req, res)
  },
  cancelMessageSending: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].cancelMessageSending(req, res)
  },
  processBatchEventNotication: function(eventObj){
    var index = getUserIndexByExtensionId(eventObj.ownerId)
    if (index < 0)
      return console.log("not found this user")
    users[index].processBatchEventNotication(eventObj)
  }
}
