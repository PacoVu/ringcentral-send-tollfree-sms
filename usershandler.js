var RC = require('ringcentral')
var fs = require('fs')
var async = require("async");
const RCPlatform = require('./platform.js')
require('dotenv').load()

function User(id, mode) {
  this.id = id;
  this.extensionId = 0;
  this.accountId = 0;
  this.userName = ""
  this.phoneNumbers = []
  this.sendReport = {
      sendInProgress: false,
      successCount: "Sending 0/0",
      failedCount: "",
      invalidNumbers: []
  }
  this.batchReport = {
    Sent_Count: 0,
    Queued_Count: 0,
    Delivered_Count: 0,
    Delivered_Failed_Count: 0,
    Sending_Failed_Count: 0,
    Unknown_Count: 0
  }
  this.batchResult = {
    id:"",
    batchSize: 0,
    processedCount: 0,
    status:"Completed"
  }
  this.batchFullReport = []
  this.smsBatchIds = []
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
  this.StartTimestamp = 0
  return this
}

var engine = User.prototype = {
    setExtensionId: function(id) {
      this.extensionId = id
    },
    setUserName: function (userName){
      this.userName = userName
    },
    getUserId: function(){
      return this.id
    },
    getExtensionId: function(){
      return this.extensionId
    },
    getUserName: function(){
      return this.userName;
    },
    getPlatform: function(){
      return this.rc_platform.getSDKPlatform()
    },
    loadOptionPage: function(req, res){
      res.render('main', {
          userName: this.getUserName()
        })
    },
    loadSendSMSPage: function(req, res){
      res.render('sendsmspage', {
          userName: this.getUserName(),
          phoneNumbers: this.phoneNumbers,
          sendReport: this.sendReport
        })
    },
    loadSendHighVolumeSMSPage: function(req, res){
      res.render('highvolumepage', {
          userName: this.getUserName(),
          phoneNumbers: this.phoneNumbers,
          smsBatchIds: this.smsBatchIds,
          batchResult: this.batchResult
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
            rc_platform.getPlatform(function(err, p){
                if (p != null){
                  p.get('/account/~/extension/~/')
                    .then(function(response) {
                      var jsonObj = response.json();
                      //thisUser.rc_platform.setAccountId(jsonObj.account.id)
                      thisUser.accountId = jsonObj.account.id
                      var fullName = jsonObj.contact.firstName + " " + jsonObj.contact.lastName
                      thisUser.setUserName(fullName)
                      engine.readPhoneNumber(thisUser, callback, res)
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
    readPhoneNumber: function(thisUser, callback, res){
        thisUser.rc_platform.getPlatform(function(err, p){
            if (p != null){
              thisUser.phoneNumbers = []
              var endpoint = '/account/~/extension/~/phone-number'
              p.get(endpoint, {
                "perPage": 1000,
                "usageType": ["MainCompanyNumber", "CompanyNumber", "DirectNumber"]
              })
                .then(function(response) {
                  var jsonObj = response.json();
                  var count = jsonObj.records.length
                  //console.log(JSON.stringify(jsonObj))
                  for (var record of jsonObj.records){
                      if (record.paymentType == "TollFree") {
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
                      }else if (record.paymentType == "Local"){
                        if (record.usageType == "DirectNumber"){
                          if (record.type != "FaxOnly" ){
                            for (var feature of record.features){
                              if (feature == "A2PSmsSender"){
                                var item = {
                                  "format": formatPhoneNumber(record.phoneNumber),
                                  "number": record.phoneNumber,
                                  "type": "10-DLC Number"
                                }
                                thisUser.phoneNumbers.push(item)
                                break;
                              }
                            }
                          }
                        }
                      }
                      if (record.usageType == "MainCompanyNumber" && thisUser.mainCompanyNumber == ""){
                        thisUser.mainCompanyNumber = formatPhoneNumber(record.phoneNumber)
                      }
                    }
                  res.send('login success');
                })
                .catch(function(e) {
                  console.log("Failed")
                  console.error(e.message);
                  res.send('login success');
                });
            }else{
              console.error(e.message);
              res.send('login failed');
            }
        })

    },
    sendSMSMessageSync: function(req, res){
        this.recipientArr = []

        if (req.file != undefined){
          var currentFolder = process.cwd();
          var tempFile = currentFolder + "/" + req.file.path
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
    sendHighVolumeSMSMessage: function(req, res){
      // parse file and read numbers
      //console.log(req.files);
      // parse and detect recipients lists
      var body = req.body
      var requestBody = {
          from: body.from_number,
          text: body.message_0,
          messages: []
      }
      // add recipients from free text field
      if (body.recipients_0.trim() != ""){
        var mainRecipients = body.recipients_0.trim().split("\n")
        for (var recipient of mainRecipients){
          recipient = recipient.trim()
          recipient = (recipient[0] == "+") ? recipient : `+${recipient}`
          var item = {
            to:[recipient]
          }
          requestBody.messages.push(item)
        }
      }
      if (req.files != undefined){
        for (var f of req.files){
          var recipientsFromFile = readRecipientFile(f.filename)
          if (f.fieldname == "attachment_0"){ // main text
            // add recipients read from file
            for (var recipient of recipientsFromFile){
              recipient = recipient.trim()
              recipient = (recipient[0] == "+") ? recipient : `+${recipient}`
              var item = {
                to:[recipient]
              }
              requestBody.messages.push(item)
            }
          }
        }
      }
      var subRecipientsIndexArr = body.group_index.split("_")
      for (var sub of subRecipientsIndexArr){
        var attachment = `attachment_${sub}`
        var recipients = `recipients_${sub}`
        var subMessage = `message_${sub}`
        if (req.files != undefined){
          for (var f of req.files){
            if (attachment == f.fieldname){
              var subRecipients = readRecipientFile(f.filename)
              for (var recipient of subRecipients){
                recipient = recipient.trim()
                recipient = (recipient[0] == "+") ? recipient : `+${recipient}`
                var group = {
                    to: [recipient],
                    text: body[subMessage]
                  }
                requestBody.messages.push(group)
              }
              break
            }
          }
        }
        // check free text field
        if (body[recipients] != undefined){
          var subRecipients = body[recipients].trim().split("\n")
          if (subRecipients.length){
            for (var recipient of subRecipients){
              if (recipient != ""){
                recipient = recipient.trim()
                recipient = (recipient[0] == "+") ? recipient : `+${recipient}`
                var group = {
                    to: [recipient],
                    text: body[subMessage]
                  }
                requestBody.messages.push(group)
              }
            }
          }
        }
      }

      var currentFolder = process.cwd();
      for (var file of req.files){
        var tempFile = currentFolder + "/uploads/" + file.filename
        fs.unlinkSync(tempFile);
      }
      if (body.expiresIn && body.expiresIn > 0){
        requestBody["expiresIn"] = body.expiresIn
      }
      if (body.sendAt && body.sendAt != ""){
        requestBody["sendAt"] = body.sendAt + ":00Z"
      }
      //console.log(JSON.stringify(requestBody))
      var thisUser = this
      var p = this.rc_platform.getPlatform(function(err, p){
        if (p != null){
          p.post("/account/~/a2p-sms/batch", requestBody)
            .then(function (resp) {
              console.log(resp.json())
              var jsonObj = resp.json()
              thisUser.StartTimestamp = Date.now()
              thisUser.smsBatchIds.push(resp.json().id)
              thisUser.batchResult = jsonObj
              console.log("Send SMS DONE!")
              res.send({
                  status:"ok",
                  time: formatSendingTime(0),
                  result: thisUser.batchResult
                })
              console.log("Send SMS DONE!")
            })
            .catch(function (e) {
              console.log('ERR ' + e || 'Server cannot send messages');
              res.send({
                  status:"error",
                  result: e.message
                })
            });
        }else{
          console.log("platform issue")
          res.send({
              status:"error",
              result: e.message
            })
        }
      })
    },
    getBatchReport: function(res, batchId, pageToken){
      this.batchReport.Queued_Count = 0
      this.batchReport.Sent_Count = 0
      this.batchReport.Delivered_Count = 0
      this.batchReport.Delivered_Failed_Count = 0
      this.batchReport.Sending_Failed_Count = 0
      this.batchReport.Unknown_Count = 0
      this.batchFullReport = []
      this._getBatchReport(res, batchId, pageToken)
    },
    _getBatchReport: function(res, batchId, pageToken){
      var thisUser = this
      var endpoint = "/account/~/a2p-sms/messages?batchId=" + batchId
      if (pageToken != "")
        endpoint += "&pageToken=" + pageToken
      //console.log(endpoint)
      var p = this.rc_platform.getPlatform(function(err, p){
        if (p != null){
          p.get(endpoint)
            .then(function (resp) {
              var jsonObj = resp.json()
              console.log(JSON.stringify(jsonObj))
              thisUser.batchFullReport.push(jsonObj.messages)
              for (var message of jsonObj.messages){
                //console.log(message)
                //console.log("========")
                if (message.messageStatus.toLowerCase() == "queued")
                  thisUser.batchReport.Queued_Count++
                else if (message.messageStatus.toLowerCase() == "sent")
                  thisUser.batchReport.Sent_Count++
                else if (message.messageStatus.toLowerCase() == "delivered")
                  thisUser.batchReport.Delivered_Count++
                else if (message.messageStatus.toLowerCase() == "deliveryfailed"){
                  thisUser.batchReport.Delivered_Failed_Count++
                }else if (message.messageStatus.toLowerCase() == "sendingfailed"){
                  thisUser.batchReport.Sending_Failed_Count++
                }else{
                  thisUser.batchReport.Unknown_Count++
                }
              }
              //console.log(jsonObj.paging)
              if (jsonObj.paging.hasOwnProperty("nextPageToken")){
                //console.log("Read next page")
                setTimeout(function(){
                  thisUser._getBatchReport(res, batchId, jsonObj.paging.nextPageToken)
                }, 1200)
              }else{
                res.send({
                    status: "ok",
                    result: thisUser.batchReport
                  })
              }
            })
            .catch(function (e) {
              console.log('ERR ' + e.message || 'Server cannot send messages');
              res.send({
                  status: "failed",
                  result: e.message
                })
            });
        }else{
          console.log("platform issue")
          res.send({
              status: "failed",
              result: "RC platform issue"
            })
        }
      })
    },
    getBatchResult: function(req, res){
        var thisUser = this
        var endpoint = "/account/~/a2p-sms/batch/" + req.query.batchId
/*
        // FOR TESTING OFFLINE
        this.testCount += 50
        var status = "Processing"
        if (this.testCount >= 10000)
          status = "Completed"
        var jsonObj = { id: 'e445d503-1c8f-4a8b-a4a9-76b5f2249c87',
                  from: '+18884684459',
                  batchSize: 10000,
                  processedCount: this.testCount,
                  status: status,
                  createdAt: '2020-03-28T01:37:52.783Z',
                  lastUpdatedAt: '2020-03-28T01:37:54.117Z'
                }
        var createdAt = new Date(jsonObj.createdAt).getTime()
        var lastUpdatedAt = new Date(jsonObj.lastUpdatedAt).getTime() + (this.testCount * 1000)

        var processingTime = (lastUpdatedAt - createdAt) / 1000

        res.send({
            status:"ok",
            time: formatSendingTime(processingTime), //`${hour}:${mins}:${secs}`,
            result: jsonObj
          })
        return // TEST OFFLINE END
*/
        var p = this.rc_platform.getPlatform(function(err, p){
          if (p != null){
            p.get(endpoint)
              .then(function (resp) {
                console.log(resp.json())
                var jsonObj = resp.json()
                var processingTime = (Date.now() - thisUser.StartTimestamp) / 1000
                thisUser.batchResult = jsonObj
                res.send({
                    status:"ok",
                    time: formatSendingTime(processingTime),
                    result: thisUser.batchResult
                  })
              })
              .catch(function (e) {
                console.log('ERR ' + e.message || 'Server cannot send messages');
                res.send({
                    status: "error",
                    result: e.message
                  })
              });
          }else{
            console.log("platform issue")
            res.send({
                status: "failed",
                resule: err
              })
          }
        })
    },
    downloadBatchSMSReport: function(req, res){
      var dir = "reports/"
      if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
      }
      var fullNamePath = dir + this.getExtensionId() + '.json'
      var fileContent = JSON.stringify(this.batchFullReport)

      try{
        fs.writeFileSync('./'+ fullNamePath, fileContent)
        var link = "/downloads?filename=" + fullNamePath
        res.send({"status":"ok","message":link})
      }catch (e){
        console.log("cannot create report file")
        res.send({"status":"failed","message":"Cannot create a report file! Please try gain"})
      }
    },
    downloadSendSMSResult: function(req, res){
      var dir = "reports/"
      if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
      }
      var fullNamePath = dir + this.getExtensionId()
      var fileContent = ""
      if (req.query.format == "JSON"){
        fullNamePath += '.json'
        fileContent = JSON.stringify(this.detailedReport)
      }else if (req.query.format == "CSV"){
        fullNamePath += '.csv'
        fileContent = "id,uri,creationTime,fromNumber,status,smsSendingAttemptsCount,toNumber"
        for (var item of this.detailedReport){
          fileContent += "\n"
          fileContent += item.id + "," + item.uri + "," + item.creationTime + "," + item.from + "," + item.status + "," + item.smsSendingAttemptsCount + "," + item.to
        }
      }else{
        fullNamePath += '_BatchReport.json'
        var fileContent = JSON.stringify(this.batchFullReport)
      }
      try{
        fs.writeFileSync('./'+ fullNamePath, fileContent)
        var link = "/downloads?filename=" + fullNamePath
        res.send({"status":"ok","message":link})
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
      post_message_to_group(req.body, this.mainCompanyNumber, this.accountId)
    }
}
module.exports = User;

function readRecipientFile(fileName){
  var currentFolder = process.cwd();
  var tempFile = currentFolder + "/uploads/" + fileName
  var content = fs.readFileSync(tempFile, 'utf8');
  content = content.trim();
  var recipientsFromFile = content.split("\n")
  if (typeof(recipientsFromFile[0]) != "number"){
    console.log(recipientsFromFile[0])
    recipientsFromFile.shift() // remove the first column which is the col name
  }
  console.log("=============")
  //fs.unlinkSync(tempFile);
  return recipientsFromFile
}
/*
function getBatchReport(batchId, pageToken, callback){
  console.log("getBatchReport")
  var endpoint = "/account/~/a2p-sms/messages?batchId=" + batchId
  if (pageToken != "")
    endpoint += "&pageToken=" + pageToken
  console.log(endpoint)
  platform.get(endpoint)
    .then(function (resp) {
        var jsonObj = resp.json()
        //console.log(JSON.stringify(jsonObj))
        for (var message of jsonObj.messages){
          //console.log(message)
          //console.log("========")
          if (message.messageStatus.toLowerCase() == "queued")
            queuedCount++
          else if (message.messageStatus.toLowerCase() == "sent")
            sentCount++
          else if (message.messageStatus.toLowerCase() == "delivered")
            deliveredCount++
          else if (message.messageStatus.toLowerCase() == "delivery_failed"){
            deliveredFailedCount++
          }else if (message.messageStatus.toLowerCase() == "sending_failed"){
            sendingFailedCount++
          }else{
            unknownCount++
          }
        }
        console.log(jsonObj.paging)
        if (jsonObj.paging.hasOwnProperty("nextPageToken")){
          console.log("Read next page")
          setTimeout(function(){
            getBatchReport(batchId, jsonObj.paging.nextPageToken, callback)
          }, 2000)
        }else{
          console.log("Send 10DCL SMS test completed:")
          if (sentCount > 0)
            console.log("Sent count: " + sentCount)
          if (queuedCount > 0)
            console.log("Queued count: " + queuedCount)
          if (deliveredCount > 0)
            console.log("Delivered count: " + deliveredCount)
          if (deliveredFailedCount > 0)
            console.log("DeliveredFailed count: " + deliveredFailedCount)
          if (sendingFailedCount > 0)
            console.log("SendingFailed count: " + sendingFailedCount)
          console.log("=================")
          callback(null, )
        }
    })
    .catch(function (e) {
        console.log('ERR ' + e.message || 'Server cannot send messages');
    });
}
*/

function formatSendingTime(processingTime){
  var hour = Math.floor(processingTime / 3600)
  hour = (hour < 10) ? "0"+hour : hour
  var mins = Math.floor((processingTime % 3600) / 60)
  mins = (mins < 10) ? "0"+mins : mins
  var secs = Math.floor(((processingTime % 3600) % 60))
  secs = (secs < 10) ? "0"+secs : secs
  return `${hour}:${mins}:${secs}`
}
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

function post_message_to_group(params, mainCompanyNumber, accountId){
  //webhook_url_v1 = "https://hooks.glip.com/webhook/ab875aa6-8460-4be2-91d7-9119484b4ed3"
  //webhook_url_v2 = "https://hooks.glip.com/webhook/v2/ab875aa6-8460-4be2-91d7-9119484b4ed3"
  var https = require('https');
  var message = params.message + "\n\nUser main company number: " + mainCompanyNumber
  message += "\nUser account Id: " + accountId
  message += "\nSalesforce lookup: https://rc.my.salesforce.com/_ui/search/ui/UnifiedSearchResults?str=" + accountId
  message += "\nAI admin lookup: https://admin.ringcentral.com/userinfo/csaccount.asp?user=XPDBID++++++++++" + accountId + "User"
  var body = {
    "icon": "http://www.qcalendar.com/icons/" + params.emotion + ".png",
    "activity": params.user_name,
    "title": "SMS Toll-Free app user feedback - " + params.type,
    "body": message
  }
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
