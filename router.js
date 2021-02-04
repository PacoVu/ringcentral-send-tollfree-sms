const User = require('./usershandler.js')
const ActiveUser = require('./event-engine.js')
const pgdb = require('./db')
const async = require('async')
require('dotenv').load()
var users = []

var activeUsers = []
exports.activeUsers = activeUsers
autoStart()
function autoStart(){
  console.log("autoStart")
  var query = `SELECT * FROM a2p_sms_active_users`
  pgdb.read(query, (err, result) => {
    if (err){
      console.error(err.message);
      createActiveUsersTable()
    }else{
      if (result.rows){
        async.each(result.rows,
          function(item, callback){
            console.log("Extension info: " + item.extension_id + " / " + item.subscription_id)
            var aUser = new ActiveUser(item.extension_id, item.subscription_id)
            aUser.setup((err, result) => {
              if (err == null){
                activeUsers.push(aUser)
                console.log("activeUsers.length: " + activeUsers.length)
                callback(null, result)
              }
            })
          },
          function (err){
            console.log("autoStart completed")
          })
      }
    }
  })
}

function createActiveUsersTable() {
  console.log("createActiveUsersTable")
  var query = 'CREATE TABLE IF NOT EXISTS a2p_sms_active_users (extension_id VARCHAR(15) PRIMARY KEY, subscription_id VARCHAR(64))'
  pgdb.create_table(query, (err, res) => {
      if (err) {
        console.log(err, err.message)
      }else{
        console.log("DONE")
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

var router = module.exports = {
  getEngine: function(){
    return activeUsers
  },
  loadLogin: function(req, res){
    if (req.session.userId == 0 || req.session.extensionId == 0) {
      var id = new Date().getTime()
      req.session.userId = id;
      var user = new User(id)
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
  login: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].login(req, res, function(err, extensionId){
      // result contain extensionId. Use it to check for orphan user and remove it
      if (!err){
        /* remove
        for (var i = 0; i < users.length; i++){
          console.log("REMOVING")
          var extId = users[i].getExtensionId()
          var userId = users[i].getUserId()
          if (extId == extensionId && userId != req.session.userId){
            console.log("REMOVE USER: " )
            users[i] = null
            users.splice(i, 1);
            break
          }
        }
        */
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
              console.log("oldUser.extensionList from new user")
              console.log(oldUser.extensionList)
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
              console.log("oldUser.extensionList from old user")
              console.log(oldUser.extensionList)
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
    users[index].logout(req, res, function(err, result){
      users[index] = null
      users.splice(index, 1);
      thisObj.forceLogin(req, res)
    })
  },
  getVoteResult: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].getVoteResult(res)
  },
  getBatchReport: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].getBatchReport(res, req.query.batchId)
  },
  getBatchResult: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].getBatchResult(req, res)
  },
  getSendSMSResult: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].getSendSMSResult(req, res)
  },
  readMessageList: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].readMessageList(req, res, "")
  },
  downloadBatchReport: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].downloadBatchReport(req, res)
  },
  downloadMessageStore: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].downloadMessageStore(req, res)
  },
  downloadSendSMSResult: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].downloadSendSMSResult(req, res)
  },
  sendSMSMessage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].sendSMSMessageAsync(req, res)
  },
  sendHighVolumeSMSMessage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].sendHighVolumeSMSMessage(req, res)
  },
  sendHighVolumeSMSMessageAdvance: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].sendHighVolumeSMSMessageAdvance(req, res)
  },
  sendHighVolumeSMSMessageVote: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].sendHighVolumeSMSMessageVote(req, res)
  },
  readCampaign: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].getBatchReport(res, req.query.batchId)
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
  loadHVManualPage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].loadHVManualPage(res)
  },
  loadHVTemplatePage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].loadHVTemplatePage(res)
  },
  loadHVVotePage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].loadHVVotePage(res)
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
}
