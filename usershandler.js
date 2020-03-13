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
  this.mainCompanyNumber = ""
  this.detailedReport = []
  this.recipientArr = []
  this.fromNumber = ""
  this.sendMessage = ""
  this.sendCount = 0
  this.failedCount = 0
  this.index = 0
  this.delayInterval = 1510
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
                        if (record.type == "VoiceFax" || record.type == "VoiceOnly"){
                          for (var feature of record.features){
                            if (feature == "SmsSender"){
                              var item = {
                                "format": formatPhoneNumber(record.phoneNumber),
                                "number": record.phoneNumber,
                                "type": "Toll-Free Number"
                              }
                              thisUser.phoneNumbers.push(item)
                              break;
                            }
                          }
                        }
                      }
                      if (record.usageType == "MainCompanyNumber"){
                        thisUser.mainCompanyNumber = formatPhoneNumber(record.phoneNumber)
                      }
                      /*
                      else if (record.usageType == "DirectNumber"){
                        if (record.type != "FaxOnly"){
                          var item = {
                            "format": formatPhoneNumber(record.phoneNumber),
                            "number": record.phoneNumber,
                            "type": "Direct Number"
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
            }else{
              console.error(e.message);
              thisRes.send('login failed');
            }
        })

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
        }

        var tempArr = req.body.recipients.split("\r\n")
        for (var number of tempArr){
          number = number.trim()
          if (number != "")
            this.recipientArr.unshift(number)
        }

        this.fromNumber = req.body.fromNumber
        this.sendMessage = req.body.message
        this.sendCount = 0
        this.failedCount = 0
        this.index = 0
        this.detailedReport = []

        this.sendReport = {
          sendInProgress: true,
          successCount: "Sent 0/" + this.recipientArr.length,
          failedCount : "Failed 0",
          invalidNumbers: []
        }
        res.render('sendsmspage', {
            userName: this.getUserName(),
            phoneNumbers: this.phoneNumbers,
            sendReport: this.sendReport
          })
        if (this.recipientArr.length > 0){
          console.log("CONTINUE PROSESSING")
          engine.sendMessages(this)
        }
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
              thisUser.sendReport['sentInfo'] = "Completed."
              thisUser.sendReport['sendInProgress'] = false
              return
            }
            //console.log("index: " + thisUser.index)
            //console.log("recipient: " + thisUser.recipientArr[thisUser.index])
            var recipient = thisUser.recipientArr[thisUser.index].trim()
            var unsentCount = totalCount - thisUser.index

            var timeLeft = formatEstimatedTimeLeft(unsentCount * (thisUser.delayInterval/1000))
            /*
            var remainMinutesToSend = (unsentCount * (thisUser.delayInterval/1000)) / 60
            var timeLeft = "00 hour, "
            if (remainMinutesToSend >= 60){
              timeLeft = Math.floor((remainMinutesToSend / 60)) + " hours and "
              remainMinutesToSend %= 60
              timeLeft += Math.ceil(remainMinutesToSend).toString() + " minutes."
            }else if (remainMinutesToSend < 1){
              var round = Number(remainMinutesToSend).toFixed(2);
              timeLeft = (round * 60) + " seconds."
            }else{
              timeLeft = Math.ceil(remainMinutesToSend).toString() + " minutes."
            }
            */
            thisUser.rc_platform.getPlatform(function(err, p){
                if (p != null){
                  var params = {
                    from: {'phoneNumber': thisUser.fromNumber},
                    to: [{'phoneNumber': recipient }],
                    text: thisUser.sendMessage
                  }
                  p.post('/account/~/extension/~/sms', params)
                    .then(function (response) {
                      var jsonObj = response.response().headers
                      /*
                      console.log("limitLimit " + jsonObj['_headers']['x-rate-limit-limit'][0])
                      console.log("limitRemaining " + jsonObj['_headers']['x-rate-limit-remaining'][0])
                      console.log("limitWindow" + jsonObj['_headers']['x-rate-limit-window'][0])
                      var limitLimit = parseInt(jsonObj['_headers']['x-rate-limit-limit'][0])
                      var limitRemaining = parseInt(jsonObj['_headers']['x-rate-limit-remaining'][0])
                      var limitWindow = parseInt(jsonObj['_headers']['x-rate-limit-window'][0])
                      if (limitRemaining == 0){
                        console.log("out of limit")
                          thisUser.delayInterval = 60000
                      }else
                          thisUser.delayInterval = ((limitWindow/limitLimit) * 1000) + 100
                      console.log(thisUser.delayInterval)
                      */
                      var jsonObj = response.json()
                      var item = {
                        "id": jsonObj.id,
                        "uri": jsonObj.uri,
                        "creationTime": jsonObj.creationTime,
                        "from": thisUser.fromNumber,
                        "status": jsonObj.messageStatus,
                        "smsDeliveryTime": jsonObj.smsDeliveryTime,
                        "smsSendingAttemptsCount": jsonObj.smsSendingAttemptsCount,
                        "to": recipient
                      }
                      thisUser.detailedReport.push(item)
                      thisUser.sendCount++
                      thisUser.index++
                      thisUser.sendReport['sentInfo'] = "Estimated time to finish " + timeLeft
                      thisUser.sendReport['successCount'] = "Sent " + thisUser.sendCount + " out of " + totalCount
                      //console.log(thisUser.sendReport['successCount'])
                      if (thisUser.index >= totalCount){
                        console.log('DONE SEND MESSAGE!');
                        //thisUser.sendReport['sendInProgress'] = false
                      }
                    })
                    .catch(function(e){
                      thisUser.index++
                      thisUser.failedCount++
                      thisUser.sendReport['failedCount'] = "Failed " + thisUser.failedCount
                      thisUser.sendReport['sentInfo'] = "Estimated time to finish " + timeLeft
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
                      }else if (e.message.indexOf("Account limits exceeded. Cannot send the message.") != -1){
                        if (thisUser.intervalTimer != null){
                          console.log("Force to pause sending due to exceeding limits!")
                          clearInterval(thisUser.intervalTimer);
                        }
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
                      }
                    })
                }
            })
          }
          else{
            console.log("not sending while previous message status is pending")
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
        res.send({"status":"ok", "message":"pause sending"})
      }else
        res.send({"status":"failed", "message":"cannot pause sending"})
    },
    resumeMessageSending: function(req, res){
      if (this.intervalTimer != null){
        console.log("resumeMessageSending")
        engine.sendMessages(this)
        res.send({"status":"ok", "message":"resume sending"})
      }else
        res.send({"status":"failed", "message":"cannot resume sending"})
    },
    cancelMessageSending: function(req, res){
      if (this.intervalTimer != null){
        console.log("cancelMessageSending")
        clearInterval(this.intervalTimer);
        this.intervalTimer = null
      }
      res.send({"status":"ok", "message":"cancel timer"})
    },
    getSendSMSResult: function(req, res){
      if (this.recipientArr.length == 0){
        this.sendReport = {
          sendInProgress: false,
          sentInfo: "Nothing to send!",
          successCount: "Sent 0/0",
          failedCount : "Failed 0",
          invalidNumbers: []
        }
      }
      res.send(this.sendReport)
    },
    downloadSendSMSResult: function(req, res){
      var fs = require('fs')
      var dir = "reports/"
      if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
      }
      var fullNamePath = dir + this.getExtensionId()
      var fileContent = ""
      if (req.query.format == "JSON"){
        fullNamePath += '.json'
        fileContent = JSON.stringify(this.detailedReport)
      }else{
        fullNamePath += '.csv'
        fileContent = "id,uri,creationTime,fromNumber,status,smsSendingAttemptsCount,toNumber"
        for (var item of this.detailedReport){
          fileContent += "\n"
          fileContent += item.id + "," + item.uri + "," + item.creationTime + "," + item.from + "," + item.status + "," + item.smsSendingAttemptsCount + "," + item.to
        }
      }
      try{
        fs.writeFileSync('./'+ fullNamePath, fileContent)
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
    postFeedbackToGlip: function(req){
      post_message_to_group(req.body, this.mainCompanyNumber)
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

function formatEstimatedTimeLeft(timeInSeconds){
  var duration = ""
  if (timeInSeconds > 3600){
    var h = Math.floor(timeInSeconds / 3600)
    timeInSeconds = timeInSeconds % 3600
    var m = Math.floor(timeInSeconds / 60)
    m = (m>9) ? m : ("0" + m)
    timeInSeconds = Math.floor(timeInSeconds % 60)
    var s = (timeInSeconds>9) ? timeInSeconds : ("0" + timeInSeconds)
    return h + ":" + m + ":" + s
  }else if (timeInSeconds > 60){
    var m = Math.floor(timeInSeconds / 60)
    timeInSeconds = Math.floor(timeInSeconds %= 60)
    var s = (timeInSeconds>9) ? timeInSeconds : ("0" + timeInSeconds)
    return m + ":" + s
  }else{
    var s = (timeInSeconds>9) ? timeInSeconds : ("0" + timeInSeconds)
    return "0:" + s
  }
}

function formatPhoneNumber(phoneNumberString) {
  var cleaned = ('' + phoneNumberString).replace(/\D/g, '')
  var match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
  if (match) {
    var intlCode = (match[1] ? '+1 ' : '')
    return [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
  }
  return phoneNumberString
}

function post_message_to_group(params, mainCompanyNumber){
  webhook_url_v1 = "https://hooks.glip.com/webhook/ab875aa6-8460-4be2-91d7-9119484b4ed3"
  webhook_url_v2 = "https://hooks.glip.com/webhook/v2/ab875aa6-8460-4be2-91d7-9119484b4ed3"
  var https = require('https');
  var body = {
    "icon": "http://www.qcalendar.com/icons/" + params.emotion + ".png",
    "activity": params.user_name,
    "title": "SMS Toll-Free app user feedback - " + params.type,
    "body": params.message + "\n\nUser main company number: " + mainCompanyNumber
  }
/*
"attachments": [
{
  "type": "Card",
  "color": "#00ff2a",
  "pretext": "Attachment pretext appears before the attachment block",
  "author_name": "Author Name",
  "author_link": "https://example.com/author_link",
  "author_icon": "https://example.com/author_icon.png",
  "title": "Attachment Title",
  "title_link": "https://example.com/title_link",
  "fields": [
    {
      "title": "Field 1",
      "value": "A short field",
      "short": true
    },
    {
      "title": "Field 2",
      "value": "[A linked short field](https://example.com)",
      "short": true
    },
    {
      "title": "Field 3",
      "value": "A long, full-width field with *formatting* and [a link](https://example.com)"
    }
  ],
  "text": "Attachment text",
  "image_url": "https://example.com/congrats.gif",
  "footer": "Attachment footer and timestamp",
  "footer_icon": "https://example.com/footer_icon.png",
  "ts": 1503723350
}
]
*/
  var post_options = {
      host: "hooks.glip.com",
      path: "/webhook/ab875aa6-8460-4be2-91d7-9119484b4ed3",
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      }
  }
  var post_req = https.request(post_options, function(res) {
      var response = ""
      res.on('data', function (chunk) {
          response += chunk
      });
      res.on("end", function(){
        console.log(response)
      });
  });
  //console.log(data)
  post_req.write(JSON.stringify(body));
  post_req.end();
}
