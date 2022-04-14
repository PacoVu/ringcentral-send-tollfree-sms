//const User = require('./usershandler.js')

const pgdb = require('./db')
const async = require('async')
require('dotenv').load()
var users = []
var activeUsers = []
createUserTable()

function createUsersAdditionalDataTable() {
  var query = "CREATE TABLE IF NOT EXISTS a2p_sms_users_tempdata (user_id VARCHAR(15) PRIMARY KEY, rejected_numbers TEXT DEFAULT '[]', scheduled_campaigns TEXT DEFAULT '[]')"
  pgdb.create_table(query, (err, res) => {
    if (err) {
      console.log(err.message)
    }else{
      console.log("createUsersAdditionalDataTable DONE")
    }
    autoStart()
    createMonitorTable()
  })
}

function createUserTable() {
  var query = 'CREATE TABLE IF NOT EXISTS a2p_sms_users '
  query += "(user_id VARCHAR(16) PRIMARY KEY, account_id VARCHAR(16) NOT NULL, batches TEXT DEFAULT '[]', contacts TEXT DEFAULT '[]', subscription_id VARCHAR(64), webhooks TEXT, access_tokens TEXT, templates TEXT DEFAULT '[]', reputation_score VARCHAR(1024) DEFAULT '[]')"
  pgdb.create_table(query, (err, res) => {
    if (err) {
      console.log(err.message)
    }else{
      console.log("createUserTable DONE")
    }
    createUsersAdditionalDataTable()
  })
}

function createMonitorTable() {
  /*
  activities = {
    standard_sms: { count: total_message: 0 }
    campaign_broadcast: { count: 0, total_message: 0 },
    campaign_personalized: { count: 0, total_message: 0 },
    conversations: { count: 0, total_message: 0, download_count: 0 },
    campaigns_logs: { access_count: 0, delete_count: 0, download_count: 0 },
    analytics: { access_count: 0, download_count: 0 },
    settings: { webhook: 0, contacts: 0, opt_out: 0 },
    helps: 0
  }
  */
  var query = 'CREATE TABLE IF NOT EXISTS a2p_sms_users_monitor '
  query += "(user_id VARCHAR(16) PRIMARY KEY, full_name VARCHAR(128) NOT NULL, email VARCHAR(256) NOT NULL, activities TEXT DEFAULT '', last_seen BIGINT DEFAULT 0)"
  pgdb.create_table(query, (err, res) => {
    if (err) {
      console.log(err.message)
    }else{
      console.log("createMonitorTable DONE")
    }
  })
}

function autoStart(){
  console.log("New autoStart")
  var RCPlatform = require('./platform.js');
  var ActiveUser = require('./event-engine.js');

  var query = `SELECT user_id, scheduled_campaigns FROM a2p_sms_users_tempdata`
  pgdb.read(query, (err, result) => {
    if (err){
      console.error(err.message);
    }else{
      if (result.rows){
        async.forEachLimit(result.rows, 1, function(user, setupNextUser){
            async.waterfall([
              function setupNextUser(done) {
                // create platform
                if (user.scheduled_campaigns != '[]'){
                  query = `SELECT user_id, subscription_id, access_tokens FROM a2p_sms_users WHERE user_id='${user.user_id}'`
                  pgdb.read(query, (err, result) => {
                    if (!err && result.rows.length > 0){
                      var accessTokens = result.rows[0].access_tokens
                      var userId = result.rows[0].user_id
                      var subscriptionId =  result.rows[0].subscription_id
                      console.log("SAVED SUBS ID")
                      console.log(subscriptionId)
                      //console.log("========")
                      var platform = new RCPlatform(userId)
                      platform.autoLogin(accessTokens, (err, res) => {
                        var aUser = new ActiveUser(userId, subscriptionId, "autoStart")
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
  removeActiveUser: function(extensionId){
    console.log("removeActiveUser " + extensionId)
    var index = activeUsers.findIndex(o => o.extensionId.toString() === extensionId)
    if (index >= 0){
      console.log("activeUsers length before: " + activeUsers.length)
      activeUsers[index] = null
      activeUsers.splice(index, 1)
      console.log("activeUsers length after: " + activeUsers.length)
    }
  },
  removeMe: function(extensionId, remove){
    var index = getUserIndexByExtensionId(extensionId)
    if (index >= 0){
      if (remove == 1){
        users[index] = null
        users.splice(index, 1);
        console.log("Number of online users: " + users.length)
        console.log("Number of active users: " + activeUsers.length)
      }else{
        console.log("There are pending batches => Keep waiting")
      }
    }
  },
  loadLogin: async function(req, res){
    if (req.session.userId == 0 || req.session.extensionId == 0) {
      var id = makeId()
      req.session.userId = id;
      console.log(id)
      var user = new (require('./usershandler.js'))(id);
      // close to try new code
      console.log("ADD NEW USER")
      users.push(user)
      var p = user.getPlatform()
      if (p != null){
        res.render('login', {
          authorize_uri: p.loginUrl({
            brandId: process.env.RINGCENTRAL_BRAND_ID,
            redirectUri: process.env.RC_APP_REDIRECT_URL,
            state: id
          }),
          redirect_uri: process.env.RC_APP_REDIRECT_URL,
          token_json: ''
        });
      }
    }else{
      console.log("Must be a reload page")
      var index = getUserIndex(req.session.userId)
      if (index >= 0){
        var check = await users[index].loadOptionPage(res)
        if (!check){
          users.splice(index, 1)
          this.forceLogin(req, res)
        }
      }else{
        this.forceLogin(req, res)
      }
    }
  },
  forceLogin: function(req, res){
    console.log("FORCE LOGIN")
    if (req.session){
      req.session.destroy();
    }
    res.render('index')
  },
  login: function(req, res){
    /*
    if (req.query.state != req.session.userId)
      return this.forceLogin(req, res)

    var user = new (require('./usershandler.js'))(req.query.state);
    users.push(user)
    */
    console.log("Auth code arrives")
    var index = getUserIndex(req.query.state)
    if (index < 0)
      return this.forceLogin(req, res)
    console.log("User id", users[index].userId)
    var thisUser = this
    //users[index].login(req, res, function(err, extensionId){
    users[index].login(req, res, function(err, extensionId){
      // result contain extensionId. Use it to check for orphan user and remove it
      if (!err){
        console.log("USERLENGTH: " + users.length)
        /*
        var shouldReplace = false
        var oldUser = null
        var newUser = null
        var oldUserIndex = -1
        var newUserIndex = -1

        for (var i = 0; i < users.length; i++){
          console.log("REPLACING")
          var extId = users[i].getExtensionId()
          var userId = users[i].getUserId()
          if (extId == extensionId && userId == req.session.userId){ // new user obj
            newUser = users[i]
            newUserIndex = i
            if (oldUser != null){
              console.log("oldUser exists")
              req.session.userId = oldUser.getUserId()
              users[newUserIndex] = null
              users.splice(newUserIndex, 1);
              break
            }
          }
          if (extId == extensionId && userId != req.session.userId){ // old user obj
            oldUser = users[i]
            oldUserIndex = i
            if (newUser != null){
              console.log("newUser exists")
              req.session.userId = userId
              users[newUserIndex] = null
              users.splice(newUserIndex, 1);
              break
            }
          }
        }
        */
        var duplicatedUser = users.filter(u => u.extensionId == extensionId)
        //console.log(duplicatedUser)
        if (duplicatedUser && duplicatedUser.length > 1){
          console.log("Has duplicated users")
          for (var dupUser of duplicatedUser){
            if (dupUser.userId != req.query.state){
              var remUserIndex = users.findIndex(u => u.userId == dupUser.userId)
              if (remUserIndex >= 0){
                console.log("remove dupUser")
                users.splice(remUserIndex, 1)
              }
            }
          }
        }
        //console.log("USERS", users)
      }else{
        // login failed => remove this user and force relogin
        console.log("login failed => remove this user and force relogin")
        users.splice(index, 1)
        thisUser.forceLogin(req, res)
      }
    })
  },
  logout: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0){
      return this.forceLogin(req, res)
    }
    var thisObj = this
    users[index].logout(function(err, result) {
      if (result == 1){
        console.log("Number of online users before null: " + users.length)
        users[index] = null
        console.log("Number of online users after null: " + users.length)
        users.splice(index, 1);
        thisObj.forceLogin(req, res)
        console.log("Number of online users: " + users.length)
        console.log("Number of active users: " + activeUsers.length)
      }else{
        console.log("There are pending batches => Logout but don't delete the user object!")
        console.log("Number of online users: " + users.length)
        console.log("Number of active users: " + activeUsers.length)
        thisObj.forceLogin(req, res)
      }
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
    users[index].readCampaignSummary(res, req.query)
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
  cancelScheduledCampaign: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].cancelScheduledCampaign(req, res)
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
  loadOptionPage: async function(req, res){
    var index = getUserIndex(req.session.userId)
    console.log("index", index)
    console.log("session user id", req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    var check = await users[index].loadOptionPage(res)
    console.log("loadOptionPage", check)
    if (!check){
      users.splice(index, 1)
      this.forceLogin(req, res)
    }
  },
  loadStandardSMSPage: async function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    var check = await users[index].loadStandardSMSPage(res)
    if (!check){
      users.splice(index, 1)
      this.forceLogin(req, res)
    }
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
  loadHelpPage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].loadHelpPage(res)
  },
  loadSettingsPage: async function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    var check = await users[index].loadSettingsPage(res)
    if (!check){
      users.splice(index, 1)
      this.forceLogin(req, res)
    }
  },
  loadHVSMSPage: async function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    var check = await users[index].loadHVSMSPage(res)
    if (!check){
      users.splice(index, 1)
      this.forceLogin(req, res)
    }
  },
  loadCampaignHistoryPage: async function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    console.log("loadCampaignHistoryPage")
    var check = await users[index].loadCampaignHistoryPage(res)
    if (!check){
      console.log("loadCampaignHistoryPage failed")
      users.splice(index, 1)
      this.forceLogin(req, res)
    }
  },
  loadAnalyticsPage: async function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    var check = await users[index].loadAnalyticsPage(res)
    if (!check){
      users.splice(index, 1)
      this.forceLogin(req, res)
    }
  },
  loadShareNumberPage: async function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    var check = await users[index].loadShareNumberPage(res)
    if (!check){
      users.splice(index, 1)
      this.forceLogin(req, res)
    }
  },
  loadMonitorPage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0){
      console.log("Session expired?")
      return this.forceLogin(req, res)
    }
    // only predefined app admins are allowed to monitor users
    if (users[index].monitor){
        var au = []
        for (var user of users){
          var item = {
            id: user.extensionId,
            email: user.userEmail,
            name: user.userName,
            activities: user.userActivities
          }
          au.push(item)
        }
        readUserActivities((err, usersActivities) => {
          readAllUsers((err, allUsers) => {
            res.render('monitor', {
              userName: users[index].getUserName(),
              activeUsers: JSON.stringify(au),
              usersActivities: JSON.stringify(usersActivities),
              allUsers: JSON.stringify(allUsers)
            })
          })
        })
    }else{
      users[index].loadHelpPage(res)
    }
  },
  pollActiveUsers: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)

    if (users[index].monitor){
        var au = []
        for (var user of users){
          var item = {
            id: user.extensionId,
            accountId: user.accountId,
            email: user.userEmail,
            name: user.userName,
            activities: user.userActivities
          }
          au.push(item)
        }
        res.send({
          status: 'ok',
          activeUsers: JSON.stringify(au)
        })
    }else{
      users[index].loadHelpPage(res)
    }
  },
  setReputation: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    //users[index].setReputation(req, res)
    //setReputation: function(req, res){
    console.log("setReputation")
    // check online user and set reputation score in mem
    index = getUserIndexByExtensionId(req.body.user_id)
    if (index >= 0){
      users[index].numberReputation = JSON.parse(req.body.numberReputation)
      /*
      for (var number of users[index].numberReputation){
        number.score = parseInt(req.body.score)
      }
      */
    }
    var query = `UPDATE a2p_sms_users SET reputation_score='${req.body.numberReputation}' WHERE user_id='${req.body.user_id}'`
    //console.log(query)
    pgdb.update(query, (err, result) => {
      if (err){
        console.error(err.message);
      }
      res.send({status:"ok", result: "Completed!"})
    })
  },
  getMessageSnapshots: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)

    var query = `SELECT batches FROM a2p_sms_users WHERE user_id='${req.body.user_id}'`
    console.log(query)
    pgdb.read(query, (err, result) => {
      if (err){
        console.error(err.message);
        return callback(err, [])
      }
      if (!err && result.rows.length > 0){
        var campaignStats = []
        //console.log(result.rows)
        var campaigns = JSON.parse(result.rows[0].batches)
        console.log(campaigns.length)
        for (var campaign of campaigns){
          var stat = {
            count: campaign.totalCount,
            message: campaign.message
          }
          campaignStats.push(stat)
        }
        res.send({
          status: 'ok',
          result: campaignStats
        })
      }else{ // no activities
        res.send({
          status: 'failed',
          result: []
        })
      }
    })
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
    if (index < 0){
      var aUsers = this.getActiveUsers()
      if (aUsers.length){
        var eventEngine = aUsers.find(o => o.extensionId === eventObj.ownerId)
        if (eventEngine){
          eventEngine.processBatchEventNotication(eventObj)
        }else{
          console.log("Not my notification!!!")
          //console.log(eventObj)
        }
        return
      }else{
        return console.log("not found this user")
      }
    }
    users[index].processBatchEventNotication(eventObj)
  },
  sendInviteToSupportTeam: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].sendInviteToSupportTeam(req, res)
  }
}

function readUserActivities(callback){
  var query = `SELECT * FROM a2p_sms_users_monitor`
  //var query = `SELECT * FROM a2p_sms_users`
  pgdb.read(query, (err, result) => {
    if (err){
      console.error(err.message);
      return callback(err, [])
    }
    if (!err && result.rows.length > 0){
      //console.log(result.rows)
      callback(null, result.rows)
    }else{ // no activities
      callback(null, [])
    }
  })
}

function readAllUsers(callback){
  //var query = `SELECT * FROM a2p_sms_users_monitor`
  var query = `SELECT * FROM a2p_sms_users`
  pgdb.read(query, (err, result) => {
    if (err){
      console.error(err.message);
      return callback(err, [])
    }
    if (!err && result.rows.length > 0){
      console.log("readUsersStats parsing data")
      var usersStat = []
      for (var item of result.rows){
        var reputationScore = JSON.parse(item.reputation_score)
        var user = {
          userId: item.user_id,
          accountId: item.account_id,
          lastSeen: "",
          totalSentMessage: 0,
          totalCost: 0.0,
          reputationScore: reputationScore,
        }
        var batches = JSON.parse(item.batches)
        var lastSeen = 0
        for (var batch of batches){
          user.totalCost += (batch.totalCost) ? batch.totalCost : 0.0
          user.totalSentMessage += batch.totalCount
          var creationTime = new Date(batch.creationTime).getTime()
          if (creationTime > lastSeen)
            lastSeen = creationTime
        }
        user.lastSeen = lastSeen //new Date(lastSeen).toISOString()
        usersStat.push(user)
      }
      usersStat.sort(sortByLastSeen)
      callback(null, usersStat)
    }else{ // no activities
      callback(null, [])
    }
  })
}

function sortByLastSeen(a,b) {
  return b.lastSeen - a.lastSeen;
}
