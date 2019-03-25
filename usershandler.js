var RC = require('ringcentral')
var fs = require('fs')
var async = require("async");
const RCPlatform = require('./platform.js')
require('dotenv').load()

function User(id, mode) {
  this.id = id;
  this.admin = false;
  this.extensionId = 0;
  this.extIndex = 0
  this.token_json = {};
  this.userName = ""
  this.sendReport = {
      "sendInProgress": false,
      "successCount": "Sending 0/0",
      "failedCount" : "",
      "failedNumbers" : []
  }
  this.rc_platform = new RCPlatform(this, mode)
  return this
}

User.prototype = {
    setExtensionId: function(id) {
      this.extensionId = id
    },
    setAdmin: function() {
      this.admin = true
    },
    setUserToken: function (token_json){
      this.token_json = token_json
    },
    setUserName: function (userName){
      this.userName = userName
    },
    getUserId: function(){
      return this.id
    },
    isAdmin: function(){
      return this.admin
    },
    getExtensionId: function(){
      return this.extensionId
    },
    getUserToken: function () {
      return this.token_json;
    },
    getUserName: function(){
      return this.userName;
    },
    getPlatform: function(){
      return this.rc_platform.getPlatform()
    },
    loadSendSMSPage: function(req, res){
      res.render('sendsmspage', {
          userName: this.getUserName(),
          sendReport: this.sendReport
        })
    },
    login: function(req, res, callback){
      var thisReq = req
      if (req.query.code) {
        console.log("CALL LOGIN FROM USER")
        var rc_platform = this.rc_platform
        var thisUser = this
        rc_platform.login(req.query.code, function (err, extensionId){
          if (!err){
            thisUser.setExtensionId(extensionId)
            req.session.extensionId = extensionId;
            callback(null, extensionId)
            var thisRes = res
            var p = thisUser.getPlatform()
            p.get('/account/~/extension/~/')
              .then(function(response) {
                var jsonObj = response.json();
                thisUser.rc_platform.setAccountId(jsonObj.account.id)
                thisRes.send('login success');
                if (jsonObj.permissions.admin.enabled){
                  thisUser.setAdmin(true)
                }
                var fullName = jsonObj.contact.firstName + " " + jsonObj.contact.lastName
                thisUser.setUserName(fullName)
              })
              .catch(function(e) {
                console.log("Failed")
                console.error(e);
                callback("error", e.message)
              });
          }else {
            console.log("USER HANDLER ERROR: " + thisUser.extensionId)
            callback("error", thisUser.extensionId)
          }
        })
      } else {
        res.send('No Auth code');
        callback("error", null)
      }
    },
    sendSMSMessageAsync: function(req, res){
        var recipientArr = []
        if (req.file != undefined){
          var currentFolder = process.cwd();
          var tempFile = currentFolder + "/" + req.file.path
          //console.log(tempFile)
          var fs = require('fs');
          var content = fs.readFileSync(tempFile, 'utf8');
          content = content.trim();
          recipientArr = content.split("\n")
          recipientArr.shift()
          //for (var rec of recipientArr)
          //  console.log("number: " + rec)
          fs.unlinkSync(tempFile);
          //console.log(recipientArr.length)
        }else{
          recipientArr = req.body.recipients.split(";")
        }
        var sendCount = 0
        var totalCount = recipientArr.length
        if (recipientArr.length > 0){
          this.sendReport = {
            "sendInProgress": true,
            "successCount": "Sent 0/" + totalCount,
            "failedCount" : "Failed 0",
            "invalidNumbers": []
          }
        }
        res.render('sendsmspage', {
            userName: this.getUserName(),
            sendReport: this.sendReport
          })
        var fromNumber = req.body.fromNumber
        var message = req.body.message
        if (message.length == 0){
          return this.sendReport['sendInProgress'] = false
        }
        var thisUser = this
          async.each(recipientArr,
            function(recipient, callback){
              recipient = recipient.trim()
              console.log("recipient: " + recipient)
              setTimeout(function(){
                var p = thisUser.rc_platform.getPlatform()
                var params = {
                  from: {'phoneNumber': fromNumber},
                  to: [{'phoneNumber': recipient }],
                  text: message
                }
                p.post('/account/~/extension/~/sms', params)
                  .then(function (response) {
                    sendCount++
                    thisUser.sendReport['successCount'] = "Sending " + sendCount + "/" + totalCount
                    callback(null, response)
                    /*
                    setTimeout(function(){
                      console.log("send successfully to " + recipient)
                      return callback(null, response)
                    }, 10000)
                    */
                  })
                  .catch(function(e){
                    var fail = {
                      "reason" : e.message.replace("[to.phoneNumber]", recipient)
                    }
                    console.log(JSON.stringify(fail))
                    thisUser.sendReport['failedCount'].push(fail)
                    callback(null, "Failed")
                    /*
                    setTimeout(function(){
                      console.log("send failed.")
                      return callback(null, "Failed")
                    }, 10000)
                    */
                  })
              }, 3000)
            },
            function (err){
              console.log("DONE SEND")
              thisUser.sendReport['sendInProgress'] = false
            })
    },
    sendSMSMessageSync: function(req, res){
        var recipientArr = []
        if (req.file != undefined){
          var currentFolder = process.cwd();
          var tempFile = currentFolder + "/" + req.file.path
          var fs = require('fs');
          var content = fs.readFileSync(tempFile, 'utf8');
          content = content.trim();
          recipientArr = content.split("\n")
          recipientArr.shift()
          fs.unlinkSync(tempFile);
        }else{
          recipientArr = req.body.recipients.split(";")
        }
        var sendCount = 0
        var totalCount = recipientArr.length
        if (recipientArr.length > 0){
          this.sendReport = {
            "sendInProgress": true,
            "successCount": "Sent 0/" + totalCount,
            "failedCount" : "Failed 0",
            "invalidNumbers": []
          }
        }
        res.render('sendsmspage', {
            userName: this.getUserName(),
            sendReport: this.sendReport
          })
        var fromNumber = req.body.fromNumber
        var message = req.body.message
        if (message.length == 0){
          return this.sendReport['sendInProgress'] = false
        }
        var thisUser = this
        var sendCount = 0
        var failedCount = 0
        var totalCount = recipientArr.length
        var index = 0
        var interval = setInterval(function() {
            var recipient = recipientArr[index].trim()
            var p = thisUser.rc_platform.getPlatform()
            var params = {
              from: {'phoneNumber': fromNumber},
              to: [{'phoneNumber': recipient }],
              text: message
            }
            p.post('/account/~/extension/~/sms', params)
              .then(function (response) {
                sendCount++
                thisUser.sendReport['successCount'] = "Sent " + sendCount + " out of " + totalCount
                console.log(thisUser.sendReport['successCount'])
                if (index >= totalCount){
                  console.log('DONE SEND MESSAGE!');
                  //thisUser.sendReport['sendInProgress'] = false
                }
              })
              .catch(function(e){
                //console.log(e.message)
                failedCount++
                thisUser.sendReport['failedCount'] = "Failed " + failedCount
                console.log(thisUser.sendReport['failedCount'])
                if (e.message.indexOf("Parameter [to.phoneNumber] value") != -1){
                  var item = {
                    "number": recipient,
                    "reason": "Invalid recipient number."
                  }
                  thisUser.sendReport['invalidNumbers'].push(item)
                }else if (e.message.indexOf("Parameter [from] value") != -1){
                  var item = {
                    "number": fromNumber,
                    "reason": "Invalid sender number."
                  }
                  thisUser.sendReport['invalidNumbers'].push(item)
                  console.log('STOP SENDING BECAUSE OF INVALID FROM NUMBER!');
                  clearInterval(interval);
                  console.log('ALL RECIPIENT!');
                  thisUser.sendReport['sendInProgress'] = false
                  return
                }else{
                  var item = {
                    "number": "N/A",
                    "reason": e.message
                  }
                  thisUser.sendReport['invalidNumbers'].push(item)
                }
                if (index >= totalCount){
                  console.log('DONE SEND MESSAGE!');
                  //thisUser.sendReport['sendInProgress'] = false
                }
              })
            index++
            if (index >= totalCount){
              clearInterval(interval);
              console.log('ALL RECIPIENT!');
              thisUser.sendReport['sendInProgress'] = false
            }
        }, 2000);
        console.log("CONTINUE PROSESSING")
    },
    getSendSMSResult: function(req, res){
      res.send(this.sendReport)
    },
    logout: function(req, res, callback){
      console.log("LOGOUT FUNC")
      var p = this.getPlatform()
      p.logout()
        .then(function (token) {
          console.log("logged out")
          //p.auth().cancelAccessToken()
          //p = null
          callback(null, "ok")
        })
        .catch(function (e) {
          console.log('ERR ' + e.message || 'Server cannot authorize user');
          callback(e, e.message)
        });
    }
}


module.exports = User;
