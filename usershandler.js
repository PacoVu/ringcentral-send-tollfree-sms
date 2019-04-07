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
  this.phoneNumbers = []
  this.sendReport = {
      "sendInProgress": false,
      "successCount": "Sending 0/0",
      "failedCount" : "",
      "invalidNumbers" : []
  }
  this.detailedReport = []
  this.recipientArr = []
  this.fromNumber = ""
  this.sendMessage = ""
  this.sendCount = 0
  this.failedCount = 0
  this.index = 0
  this.delayInterval = 5000
  this.intervalTimer = null
  this.rc_platform = new RCPlatform(this, mode)
  return this
}

var engine = User.prototype = {
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
      return this.rc_platform.getSDKPlatform()
    },
    loadSendSMSPage: function(req, res){
      res.render('sendsmspage', {
          userName: this.getUserName(),
          phoneNumbers: this.phoneNumbers,
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
            console.log("Read extension")
            rc_platform.getPlatform(function(err, p){
                if (p != null){
                  p.get('/account/~/extension/~/')
                    .then(function(response) {
                      //console.log(response)
                      var jsonObj = response.json();
                      //console.log(JSON.stringify(jsonObj))
                      thisUser.rc_platform.setAccountId(jsonObj.account.id)
                      //thisRes.send('login success');
                      if (jsonObj.permissions.admin.enabled){
                        thisUser.setAdmin(true)
                      }
                      var fullName = jsonObj.contact.firstName + " " + jsonObj.contact.lastName
                      thisUser.setUserName(fullName)
                      engine.readPhoneNumber(thisUser, callback, thisRes)
                    })
                    .catch(function(e) {
                      console.log("Failed")
                      console.error(e);
                      callback("error", e.message)
                    });
                }else{
                  console.log("CANNOT LOGIN")
                  callback("error", thisUser.extensionId)
                }
            })
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
    login_old: function(req, res, callback){
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
            console.log("Read extension")
            var p = thisUser.getPlatform()
            p.get('/account/~/extension/~/')
              .then(function(response) {
                //console.log(response)
                var jsonObj = response.json();
                //console.log(JSON.stringify(jsonObj))
                thisUser.rc_platform.setAccountId(jsonObj.account.id)
                //thisRes.send('login success');
                if (jsonObj.permissions.admin.enabled){
                  thisUser.setAdmin(true)
                }
                var fullName = jsonObj.contact.firstName + " " + jsonObj.contact.lastName
                thisUser.setUserName(fullName)
                engine.readPhoneNumber(thisUser, callback, thisRes)
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
    readPhoneNumber: function(thisUser, callback, thisRes){
        thisUser.rc_platform.getPlatform(function(err, p){
            if (p != null){
              thisUser.phoneNumbers = []
              var endpoint = '/account/~/extension/~/phone-number'
              p.get(endpoint, {
                "perPage": 1000,
                "usageType": ["MainCompanyNumber", "CompanyNumber", "DirectNumber"]
              })
                .then(function(response) {
                  //console.log(response)
                  var jsonObj =response.json();
                  var count = jsonObj.records.length
                  for (var record of jsonObj.records){
                      console.log("recordid: " + JSON.stringify(record))
                      if (record.paymentType == "TollFree") {
                      //if (record.usageType == "DirectNumber"){
                        if (record.type == "VoiceFax"){
                          for (var feature of record.features){
                            if (feature == "SmsSender"){
                              var item = {
                                "number": record.phoneNumber,
                                "type": "TollFree Number"
                              }
                              thisUser.phoneNumbers.push(item)
                              break;
                            }
                          }
                        }
                      }
                      else if (record.usageType == "DirectNumber" /*&& record.extension.id == thisUser.getExtensionId()*/){
                        if (record.type != "FaxOnly"){
                          var item = {
                            "number": record.phoneNumber,
                            "type": "Direct Number"
                          }
                          thisUser.phoneNumbers.push(item)
                        }
                      }
                    }
                  thisRes.send('login success');
                })
                .catch(function(e) {
                  console.log("Failed")
                  console.error(e.message);
                  thisRes.send('login success');
                });
            }else{
              console.error(e.message);
              thisRes.send('login failed');
            }
        })

    },
    readPhoneNumber_old: function(thisUser, callback, thisRes){
        var p = thisUser.getPlatform()
        thisUser.phoneNumbers = []
        var endpoint = '/account/~/extension/~/phone-number'
        p.get(endpoint, {
          "perPage": 1000,
          "usageType": ["MainCompanyNumber", "CompanyNumber", "DirectNumber"]
        })
          .then(function(response) {
            //console.log(response)
            var jsonObj =response.json();
            var count = jsonObj.records.length
            for (var record of jsonObj.records){
                console.log("recordid: " + JSON.stringify(record))
                if (record.paymentType == "TollFree") {
                //if (record.usageType == "DirectNumber"){
                  if (record.type == "VoiceFax"){
                    for (var feature of record.features){
                      if (feature == "SmsSender"){
                        var item = {
                          "number": record.phoneNumber,
                          "type": "TollFree Number"
                        }
                        thisUser.phoneNumbers.push(item)
                        break;
                      }
                    }
                  }
                }
                else if (record.usageType == "DirectNumber" /*&& record.extension.id == thisUser.getExtensionId()*/){
                  if (record.type != "FaxOnly"){
                    var item = {
                      "number": record.phoneNumber,
                      "type": "Direct Number"
                    }
                    thisUser.phoneNumbers.push(item)
                  }
                }
                /*
                else if (record.usageType == "CompanyNumber"){
                  if (record.type == "VoiceFax"){
                    var item = {
                      "number": record.phoneNumber,
                      "type": "Company Number"
                    }
                    thisUser.phoneNumbers.push(item)
                  }
                }
                */
              }
            thisRes.send('login success');
          })
          .catch(function(e) {
            console.log("Failed")
            console.error(e.message);
            thisRes.send('login success');
          });
    },
    sendSMSMessageSync: function(req, res){
        this.recipientArr = []
        if (req.file != undefined){
          var currentFolder = process.cwd();
          var tempFile = currentFolder + "/" + req.file.path
          var fs = require('fs');
          var content = fs.readFileSync(tempFile, 'utf8');
          content = content.trim();
          this.recipientArr = content.split("\n")
          this.recipientArr.shift()
          fs.unlinkSync(tempFile);
        }else{
          this.recipientArr = req.body.recipients.split(";")
        }
        this.fromNumber = req.body.fromNumber
        this.sendMessage = req.body.message
        this.sendCount = 0
        this.failedCount = 0
        this.index = 0
        this.detailedReport = []
        //var totalCount = recipientArr.length
        if (this.recipientArr.length > 0){
          this.sendReport = {
            "sendInProgress": true,
            "successCount": "Sent 0/" + this.recipientArr.length,
            "failedCount" : "Failed 0",
            "invalidNumbers": []
          }
        }
        res.render('sendsmspage', {
            userName: this.getUserName(),
            phoneNumbers: this.phoneNumbers,
            sendReport: this.sendReport
          })
        console.log("CONTINUE PROSESSING")
        //console.log(JSON.stringify(this.recipientArr))
        engine.sendMessages(this)
    },
    sendMessages: function(thisUser){
      var currentIndex = thisUser.index
      var totalCount = thisUser.recipientArr.length
      thisUser.intervalTimer = setInterval(function() {
          if (currentIndex == thisUser.index){
            // this will prevent sending a new message while the previous message was not sent
            currentIndex++
            if (thisUser.index >= totalCount){
              clearInterval(thisUser.intervalTimer);
              thisUser.intervalTimer = null
              console.log('ALL RECIPIENT!');
              thisUser.sendReport['sendInProgress'] = false
              return
            }
            console.log("index: " + thisUser.index)
            console.log("recipient: " + thisUser.recipientArr[thisUser.index])
            var recipient = thisUser.recipientArr[thisUser.index].trim()
            thisUser.rc_platform.getPlatform(function(err, p){
                if (p != null){
                  var params = {
                    from: {'phoneNumber': thisUser.fromNumber},
                    to: [{'phoneNumber': recipient }],
                    text: thisUser.sendMessage
                  }
                  p.post('/account/~/extension/~/sms', params)
                    .then(function (response) {
                      var jsonObj = response.json()
                      var item = {
                        "id": jsonObj.id,
                        "uri": jsonObj.uri,
                        "creationTime": jsonObj.creationTime,
                        "from": jsonObj.from,
                        "status": jsonObj.messageStatus,
                        "smsDeliveryTime": jsonObj.smsDeliveryTime,
                        "smsSendingAttemptsCount": jsonObj.smsSendingAttemptsCount,
                        "to": jsonObj.to
                      }
                      thisUser.detailedReport.push(item)
                      thisUser.sendCount++
                      thisUser.index++
                      thisUser.sendReport['successCount'] = "Sent " + thisUser.sendCount + " out of " + totalCount
                      console.log(thisUser.sendReport['successCount'])
                      if (thisUser.index >= totalCount){
                        console.log('DONE SEND MESSAGE!');
                        //thisUser.sendReport['sendInProgress'] = false
                      }
                    })
                    .catch(function(e){
                      thisUser.index++
                      thisUser.failedCount++
                      thisUser.sendReport['failedCount'] = "Failed " + thisUser.failedCount
                      var reason = ""
                      if (e.message.indexOf("Parameter [to.phoneNumber] value") != -1){
                        reason = "Invalid recipient number."
                        var item = {
                          "number": recipient,
                          "reason": reason
                        }
                        //thisUser.sendReport['invalidNumbers'].push(item)
                      }else if (e.message.indexOf("Parameter [from] value") != -1){
                        reason = "Invalid sender number."
                        var item = {
                          "number": thisUser.fromNumber,
                          "reason": "Invalid sender number."
                        }
                        //thisUser.sendReport['invalidNumbers'].push(item)
                        console.log('STOP SENDING BECAUSE OF INVALID FROM NUMBER!');
                        clearInterval(thisUser.intervalTimer);
                        thisUser.intervalTimer = null
                        console.log('ALL RECIPIENT!');
                        thisUser.sendReport['sendInProgress'] = false
                        return
                      }else{
                        reason = e.message
                        var item = {
                          "number": "N/A",
                          "reason": reason
                        }
                        //thisUser.sendReport['invalidNumbers'].push(item)
                      }
                      var item = {
                        "id": 0,
                        "uri": "",
                        "creationTime": new Date().toISOString(),
                        "from": thisUser.fromNumber,
                        "status": reason,
                        "smsDeliveryTime": "",
                        "smsSendingAttemptsCount": 0,
                        "to": recipient
                      }
                      thisUser.detailedReport.push(item)
                      if (thisUser.index >= totalCount){
                        console.log('DONE SEND MESSAGE!');
                        //thisUser.sendReport['sendInProgress'] = false
                      }
                    })
                  //thisUser.index++
                  /*
                  if (thisUser.index >= totalCount){
                    clearInterval(interval);
                    console.log('ALL RECIPIENT!');
                    thisUser.sendReport['sendInProgress'] = false
                  }
                  */
                }
            })
          }
          else{
            console.log("not sending while there is pending")
          }
      }, thisUser.delayInterval);
    },
    setDelayInterVal: function(req, res){
      this.intervalTimer = req.query.interval
      res.send({"status":"ok", "message":"set interval"})
    },
    pauseMessageSending: function(req, res){
      if (this.intervalTimer != null){
        console.log("pauseMessageSending")
        clearInterval(this.intervalTimer);
        //this.intervalTimer = null
      }
      res.send({"status":"ok", "message":"pause timer"})
    },
    resumeMessageSending: function(req, res){
      if (this.intervalTimer != null){
        console.log("resumeMessageSending")
        engine.sendMessages(this)
      }
      res.send({"status":"ok", "message":"pause timer"})
    },
    cancelMessageSending: function(req, res){
      if (this.intervalTimer != null){
        console.log("cancelMessageSending")
        clearInterval(this.intervalTimer);
        this.intervalTimer = null
      }
      res.send({"status":"ok", "message":"cancel timer"})
    },
    sendSMSMessageSync_old: function(req, res){
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
            phoneNumbers: this.phoneNumbers,
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
        var index = 0
        this.detailedReport = []
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
                //console.log(response)
                var jsonObj = response.json()
                var item = {
                  "id": jsonObj.id,
                  "uri": jsonObj.uri,
                  "creationTime": jsonObj.creationTime,
                  "from": jsonObj.from,
                  "status": jsonObj.messageStatus,
                  "smsDeliveryTime": jsonObj.smsDeliveryTime,
                  "smsSendingAttemptsCount": jsonObj.smsSendingAttemptsCount,
                  "to": jsonObj.to
                }
                thisUser.detailedReport.push(item)
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
                var reason = ""
                if (e.message.indexOf("Parameter [to.phoneNumber] value") != -1){
                  reason = "Invalid recipient number."
                  var item = {
                    "number": recipient,
                    "reason": reason
                  }
                  //thisUser.sendReport['invalidNumbers'].push(item)
                }else if (e.message.indexOf("Parameter [from] value") != -1){
                  reason = "Invalid sender number."
                  var item = {
                    "number": fromNumber,
                    "reason": "Invalid sender number."
                  }
                  //thisUser.sendReport['invalidNumbers'].push(item)
                  console.log('STOP SENDING BECAUSE OF INVALID FROM NUMBER!');
                  clearInterval(interval);
                  console.log('ALL RECIPIENT!');
                  thisUser.sendReport['sendInProgress'] = false
                  return
                }else{
                  reason = e.message
                  var item = {
                    "number": "N/A",
                    "reason": reason
                  }
                  //thisUser.sendReport['invalidNumbers'].push(item)
                }
                var item = {
                  "id": 0,
                  "uri": "",
                  "creationTime": new Date().toISOString(),
                  "from": fromNumber,
                  "status": reason,
                  "smsDeliveryTime": "",
                  "smsSendingAttemptsCount": 0,
                  "to": recipient
                }
                thisUser.detailedReport.push(item)
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
        }, 999);
        console.log("CONTINUE PROSESSING")
    },
    getSendSMSResult: function(req, res){
      res.send(this.sendReport)
    },
    downloadSendSMSResult: function(req, res){
      var fs = require('fs')
      var dir = "reports/"
      if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
      }
      var fullNamePath = dir + this.getExtensionId() + '.json'
      console.log(fullNamePath)
      var content = JSON.stringify(this.detailedReport)
      try{
        fs.writeFileSync('./'+ fullNamePath, content)
        var link = "/downloads?filename=" + fullNamePath
        res.send({"status":"ok","message":link})
        //res.send(link)
      }catch (e){
        console.log("cannot create report file")
        res.send({"status":"failed","message":"Cannot create a report file! Please try gain"})
      }
    },
    logout: function(req, res, callback){
      console.log("LOGOUT FUNC")
      var p = this.rc_platform.getPlatform(function(err, p){
        if (p != null){
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
        }else{
          callback(null, "ok")
        }
      })
    },
    logout_old: function(req, res, callback){
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
