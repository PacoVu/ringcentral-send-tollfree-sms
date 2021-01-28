var RC = require('ringcentral')
var fs = require('fs')
var async = require("async");
const RCPlatform = require('./platform.js')
const pgdb = require('./db')
require('dotenv').load()

const MASK = "#!#"

function User(id) {
  this.id = id;
  this.extensionId = 0;
  this.accountId = 0;
  this.userName = ""
  this.userEmail = ""
  this.rc_platform = new RCPlatform()

  this.phoneHVNumbers = []
  this.phoneTFNumbers = []
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
    Total_Cost: 0
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

  // Classic SMS
  this.detailedReport = []
  this.recipientArr = []
  this.fromNumber = ""
  this.sendMessage = ""
  this.sendCount = 0
  this.failedCount = 0
  this.index = 0
  this.delayInterval = 1510
  this.intervalTimer = null
  this.StartTimestamp = 0
  return this
}

var engine = User.prototype = {
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
      this.readA2PSMSPhoneNumber(req, res)
    },
    loadStandardSMSPage: function(res){
      var enableHVSMS = (this.phoneHVNumbers.length) ? false : true
      res.render('standard-sms', {
        userName: this.getUserName(),
        phoneNumbers: this.phoneTFNumbers,
        sendReport: this.sendReport,
        enableHighVolumeSMS: enableHVSMS
      })
    },
    loadHVManualPage: function(res){
      res.render('manual-input', {
        userName: this.getUserName(),
        phoneNumbers: this.phoneHVNumbers,
        smsBatchIds: this.smsBatchIds,
        batchResult: this.batchResult
      })
    },
    loadHVTemplatePage: function(res){
      res.render('file-input', {
        userName: this.getUserName(),
        phoneNumbers: this.phoneHVNumbers,
        smsBatchIds: this.smsBatchIds,
        batchResult: this.batchResult
      })
    },
    login: function(req, res, callback){
      var thisReq = req
      if (req.query.code) {
        var rc_platform = this.rc_platform
        var thisUser = this
        rc_platform.login(req.query.code, function (err, extensionId){
          if (!err){
            thisUser.extensionId = extensionId
            req.session.extensionId = extensionId;
            callback(null, extensionId)
            res.send('login success');
            thisUser.createTable(function(err, result){
              console.log("a2p_user created")
            })
            rc_platform.getPlatform(function(err, p){
              if (p != null){
                p.get('/account/~/extension/~/')
                  .then(function(response) {
                    var jsonObj = response.json();
                    thisUser.accountId = jsonObj.account.id
                    var fullName = jsonObj.contact.firstName + " " + jsonObj.contact.lastName
                    if (jsonObj.contact.hasOwnProperty("email"))
                      thisUser.userEmail = jsonObj.contact.email
                    thisUser.setUserName(fullName)
                  })
                  .catch(function(e) {
                    console.log("Failed")
                    console.error(e.message);
                  });
              }else{
                console.log("CANNOT LOGIN")
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
    readA2PSMSPhoneNumber: function(req, res){
      var thisUser = this
        this.rc_platform.getPlatform(function(err, p){
          if (err){
            req.session.destroy();
            res.render('index')
          }else {
              thisUser.phoneHVNumbers = []
              thisUser.phoneTFNumbers = []
              var endpoint = '/account/~/extension/~/phone-number'
              p.get(endpoint, {
                "perPage": 1000,
                "usageType": ["MainCompanyNumber", "CompanyNumber", "DirectNumber"]
              })
              .then(function(response) {
                  var jsonObj = response.json();
                  var count = jsonObj.records.length
                  for (var record of jsonObj.records){
                    for (var feature of record.features){
                      if (feature == "A2PSmsSender"){
                        var item = {
                                  "format": formatPhoneNumber(record.phoneNumber),
                                  "number": record.phoneNumber,
                                  "type": "10-DLC"
                        }
                        if (record.paymentType == "TollFree")
                          item.type = "Toll-Free"
                        thisUser.phoneHVNumbers.push(item)
                        break;
                      }else if (feature == "SmsSender"){
                        if (record.paymentType == "TollFree") {
                          if (record.type == "VoiceFax" || record.type == "VoiceOnly"){
                            var item = {
                                  "format": formatPhoneNumber(record.phoneNumber),
                                  "number": record.phoneNumber,
                                  "type": "Toll-Free Number"
                            }
                            thisUser.phoneTFNumbers.push(item)
                            break;
                          }
                        }
                      }
                    }
                    if (record.usageType == "MainCompanyNumber" && thisUser.mainCompanyNumber == ""){
                        thisUser.mainCompanyNumber = formatPhoneNumber(record.phoneNumber)
                    }
                  }
                  // decide what page to load
                  if (thisUser.phoneHVNumbers.length && thisUser.phoneTFNumbers.length){
                    // launch option page
                    res.render('main', {
                      userName: thisUser.getUserName(),
                      lowVolume: true,
                      highVolume: true
                    })
                  }else if (thisUser.phoneHVNumbers.length){
                    // launch high volume page
                    res.render('manual-input', {
                      userName: thisUser.getUserName(),
                      phoneNumbers: thisUser.phoneHVNumbers,
                      smsBatchIds: thisUser.smsBatchIds,
                      batchResult: thisUser.batchResult
                    })
                  }else if (thisUser.phoneTFNumbers.length){
                    res.render('main', {
                      userName: thisUser.getUserName(),
                      lowVolume: true,
                      highVolume: false
                    })
                  }else{
                    // launch info page
                    res.render('main', {
                      userName: thisUser.getUserName(),
                      lowVolume: false,
                      highVolume: false
                    })
                  }
              })
              .catch(function(e) {
                console.log("Failed")
                console.error(e.message);
                res.send('login success');
              });
          }
        })
    },
    sendHighVolumeSMSMessageAdvance: function(req, res){
      var body = req.body
      var requestBody = {
          from: body.from_number,
          messages: []
      }
      var csvColumnIndex = {}
      if (req.files != undefined){
        for (var f of req.files){
          var currentFolder = process.cwd();
          var tempFile = currentFolder + "/uploads/" + f.filename
          var content = fs.readFileSync(tempFile, 'utf8');
          var recipientsFromFile = content.trim().split("\r\n")
          var header = recipientsFromFile[0]
          var columns = header.trim().split(",")
          for (var i=0; i<columns.length; i++){
            csvColumnIndex[columns[i]] = i
          }
          var message = body.message
          var toNumberColumnName = body.to_number_column
          recipientsFromFile.shift() // remove the first row which is the header
          for (var row of recipientsFromFile){
            row = detectAndHandleCommas(row)
            var columns = row.trim().split(",")
            var msg = resembleMessage(message, columns, csvColumnIndex)
            var group = {
                to: [columns[csvColumnIndex[toNumberColumnName]]],
                text: msg
            }
            requestBody.messages.push(group)
          }
          //console.log(JSON.stringify(requestBody))
        }
        var currentFolder = process.cwd();
        for (var file of req.files){
          var tempFile = currentFolder + "/uploads/" + file.filename
          fs.unlinkSync(tempFile);
        }
        this.sendBatchMessage(res, requestBody, body.campaign_name)
      }
    },
    sendHighVolumeSMSMessage: function(req, res){
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
      /*
      if (body.hasOwnProperty('expiresIn') && body.expiresIn > 0){
        requestBody["expiresIn"] = parseInt(body.expiresIn)
      }
      if (body.hasOwnProperty('sendAt') && body.scheduledAt != ""){
        requestBody["sendAt"] = body.scheduledAt + ":00Z"
      }
      */
      //console.log(body.scheduledAt)
      //console.log(JSON.stringify(requestBody))
      this.sendBatchMessage(res, requestBody, body.campaign_name)
    },
    sendBatchMessage: function(res, requestBody, campaignName){
      var thisUser = this
      //console.log(JSON.stringify(requestBody))
      var p = this.rc_platform.getPlatform(function(err, p){
        if (p != null){
          p.post("/account/~/a2p-sms/batch", requestBody)
            .then(function (resp) {
              var jsonObj = resp.json()
              thisUser.StartTimestamp = Date.now()
              thisUser.smsBatchIds.push(resp.json().id)
              thisUser.batchResult = jsonObj
              thisUser.addBatchToDB(campaignName, jsonObj)
              res.send({
                  status:"ok",
                  time: formatSendingTime(0),
                  result: thisUser.batchResult
              })
            })
            .catch(function (e) {
              console.log('ERR ' + e.message);
              res.send({
                  status:"error",
                  message: e.message
              })
            });
        }else{
          res.send({
            status: "failed",
            message: "You have been logged out. Please login again."
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
      this.batchReport.Total_Cost = 0
      this.batchFullReport = []
      this._getBatchReport(res, batchId, pageToken)
    },
    _getBatchReport: function(res, batchId, pageToken){
      var thisUser = this
      var endpoint = "/account/~/a2p-sms/messages?batchId=" + batchId
      if (pageToken != "")
        endpoint += "&pageToken=" + pageToken
      var p = this.rc_platform.getPlatform(function(err, p){
        if (p != null){
          p.get(endpoint)
            .then(function (resp) {
              var jsonObj = resp.json()
              thisUser.batchFullReport = thisUser.batchFullReport.concat(jsonObj.records)
              for (var message of jsonObj.records){ // used to be .messages
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
                }
                var cost = (message.hasOwnProperty('cost')) ? message.cost : 0
                thisUser.batchReport.Total_Cost += cost
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
                    result: thisUser.batchReport,
                    fullReport: thisUser.batchFullReport
                  })
              }
            })
            .catch(function (e) {
              console.log('ERR ' + e.message || 'Server cannot send messages');
              res.send({
                  status: "error",
                  message: e.message
                })
            });
        }else{
          console.log("platform issue")
          res.send({
              status: "failed",
              message: "You have been logged out. Please login again."
            })
        }
      })
    },
    getBatchResult: function(req, res){
        var thisUser = this
        var endpoint = "/account/~/a2p-sms/batch/" + req.query.batchId
        var p = this.rc_platform.getPlatform(function(err, p){
          if (p != null){
            p.get(endpoint)
              .then(function (resp) {
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
                    message: e.message
                  })
              });
          }else{
            console.log("platform issue")
            res.send({
                status: "failed",
                message: "You have been logged out. Please login again."
              })
          }
        })
    },
    downloadBatchReport: function(req, res){
      var dir = "reports/"
      if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
      }
      var fullNamePath = dir + this.getExtensionId()
      var fileContent = ""
      if (req.query.format == "JSON"){
        fullNamePath += '.json'
        fileContent = JSON.stringify(this.batchFullReport)
      }else{
        fullNamePath += '.csv'
        fileContent = "Id,From,To,Creation Time,Last Updated Time,Message Status,Error Code,Cost,Segment"
        var timeOffset = parseInt(req.query.timeOffset)
        let dateOptions = { weekday: 'short' }
        for (var item of this.batchFullReport){
          var from = formatPhoneNumber(item.from)
          var to = formatPhoneNumber(item.to[0])
          //var date = new Date(item.createdAt)
          var date = new Date(item.creationTime)
          var timestamp = date.getTime() - timeOffset
          var createdDate = new Date (timestamp)
          var createdDateStr = createdDate.toLocaleDateString("en-US", dateOptions)
          createdDateStr += " " + createdDate.toLocaleDateString("en-US")
          createdDateStr += " " + createdDate.toLocaleTimeString("en-US", {timeZone: 'UTC'})
          //date = new Date(item.lastUpdatedAt)
          date = new Date(item.lastModifiedTime)
          var timestamp = date.getTime() - timeOffset
          var updatedDate = new Date (timestamp)
          var updatedDateStr = createdDate.toLocaleDateString("en-US", dateOptions)
          updatedDateStr += " " + createdDate.toLocaleDateString("en-US")
          updatedDateStr += " " + updatedDate.toLocaleTimeString("en-US", {timeZone: 'UTC'})
          fileContent += "\n" + item.id + "," + from + "," + to + "," + createdDateStr + "," + updatedDateStr
          var errorCode = ""
          if (item.hasOwnProperty('errorCode')){
            errorCode = item.errorCode
          }
          fileContent +=  "," + item.messageStatus + "," + errorCode + "," + item.cost + "," + item.segmentCount
        }
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
      var p = this.rc_platform.getPlatform(function(err, p){
        if (p != null){
          p.logout()
            .then(function (token) {
              console.log("logged out")
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
    readCampaign: function(req, res){
      this._getBatchReport(res, req.query.batchId, "")
    },
    loadCampaignHistoryPage: function(res){
      var query = `SELECT batches FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
        }
        if (!err && result.rows.length > 0){
          var batches = JSON.parse(result.rows[0].batches)
          res.render('campaign', {
            userName: this.getUserName(),
            campaigns: batches
          })
        }else{ // no history
          res.render('campaign', {
            userName: this.getUserName(),
            campaigns: []
          })
        }
      })
    },
    // Classic SMS
    sendSMSMessageAsync: function(req, res){
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
        var enableHVSMS = (this.phoneHVNumbers.length) ? false : true
        res.render('standard-sms', {
            userName: this.getUserName(),
            phoneNumbers: this.phoneTFNumbers,
            sendReport: this.sendReport,
            enableHighVolumeSMS: enableHVSMS
        })
        if (this.recipientArr.length > 0){
          console.log("CONTINUE PROSESSING")
          this.sendMessages()
        }
    },
    sendMessages: function(){
      var thisUser = this
      var currentIndex = this.index
      var totalCount = this.recipientArr.length

      this.intervalTimer = setInterval(function() {
          if (currentIndex == thisUser.index){
            // this will prevent sending a new message while the previous message was not sent
            currentIndex++
            if (thisUser.index >= totalCount){
              clearInterval(thisUser.intervalTimer);
              thisUser.intervalTimer = null
              thisUser.sendReport['sentInfo'] = "Completed."
              thisUser.sendReport['sendInProgress'] = false
              return
            }
            var recipient = thisUser.recipientArr[thisUser.index].trim()
            var unsentCount = totalCount - thisUser.index

            var timeLeft = formatEstimatedTimeLeft(unsentCount * (thisUser.delayInterval/1000))
            thisUser.rc_platform.getPlatform(function(err, p){
                if (p != null){
                  var params = {
                    from: {'phoneNumber': thisUser.fromNumber},
                    to: [{'phoneNumber': recipient }],
                    text: thisUser.sendMessage
                  }
                  //console.log(JSON.stringify(params))
                  p.post('/account/~/extension/~/sms', params)
                    .then(function (response) {
                      //var jsonObj = response.response().headers
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
        this.sendMessages()
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
    postFeedbackToGlip: function(req){
      post_message_to_group(req.body, this.mainCompanyNumber, this.accountId, this.userEmail)
    },
    createTable: function (callback) {
      console.log("CREATE TABLE")
      var query = 'CREATE TABLE IF NOT EXISTS a2p_sms_users '
      query += '(user_id VARCHAR(16) PRIMARY KEY, account_id VARCHAR(16) NOT NULL, batches TEXT, stats TEXT)'
      pgdb.create_table(query, (err, res) => {
        if (err) {
          console.log(err, res)
          callback(err, err.message)
        }else{
          console.log("DONE")
          callback(null, "Ok")
        }
      })
    },
    addBatchToDB: function(campaignName, batchInfo){
      var thisUser = this
      var newBatch = {
        campaign: campaignName,
        creationTime: batchInfo.creationTime,
        batchId: batchInfo.id,
        batchSize: batchInfo.batchSize
      }
      var query = `SELECT batches FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
        }
        if (!err && result.rows.length > 0){
          // attach to array then update db
          var batches = JSON.parse(result.rows[0].batches)
          batches.push(newBatch)
          var query = 'UPDATE a2p_sms_users SET '
          query += "batches='" + JSON.stringify(batches) + "' WHERE user_id='" + thisUser.extensionId + "'"
          pgdb.update(query, (err, result) =>  {
            if (err){
              console.error(err.message);
            }
            console.log("updated batch data")
          })
        }else{ // add new to db
          var batches = [newBatch]
          var values = [thisUser.extensionId, thisUser.accountId, JSON.stringify(batches)]
          var query = "INSERT INTO a2p_sms_users VALUES ($1, $2, $3) ON CONFLICT DO NOTHING"
          pgdb.insert(query, values, (err, result) =>  {
            if (err){
              console.error(err.message);
            }
            console.log("stored batch in to db")
          })
        }
      })
    },
    // not used
    readUsersStats: function(req, res){
      var query = `SELECT * FROM a2p_sms_users`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
        }
        if (!err && result.rows.length > 0){
          var userStats = []
          for (var item of result.rows){
            var user = {
              userId: item.user_id,
              accountId: item.account_id,
              stats: []
            }
            var batches = JSON.parse(item.batches)
            for (var batch of batches){
              var stat ={
                batchSize: batch.batchSize,
                sentDate: batch.creationTime
              }
              user.stats.push(stat)
            }
            userStats.push(user)
          }
          res.send({status:"ok", data: userStats})
        }
      })
    }
}
module.exports = User;

function detectAndHandleCommas(row){
  var startPos = 0
  var endPos = 0
  while (startPos >= 0){
    startPos = row.indexOf('"', endPos)
    if (startPos > 0){
      endPos = row.indexOf('"', startPos+1)
      if (endPos >= 0){
        var colText = row.substring(startPos, endPos+1)
        var count = colText.split(",").length - 1
        var maskedText = colText.replace(/,/g, MASK);
        endPos = endPos + (2 * count)
        row = row.replace(colText, maskedText)
      }
      endPos = endPos+2
      if (endPos >= row.length)
        startPos = -1
    }
  }
  return row
}

function resembleMessage(message, columns, csvColumnIndex){
  var msg = message
  let re = new RegExp('/\{([^}]+)\}/g');
  var arr = msg.match(/{([^}]*)}/g)
  if (arr){
    for (var pattern of arr){
      for (var key of Object.keys(csvColumnIndex)){
        var k = `{${key}}`
        if (k == pattern){
          var text = columns[csvColumnIndex[key]].replace(/"/g, '')
          text = text.replace(/#!#/g, ',')
          msg = msg.replace(pattern, text)
        }
      }
    }
  }
  return msg
}

function readRecipientFile(fileName){
  var currentFolder = process.cwd();
  var tempFile = currentFolder + "/uploads/" + fileName
  var content = fs.readFileSync(tempFile, 'utf8');
  content = content.trim();
  var recipientsFromFile = content.split("\n")
  if (typeof(recipientsFromFile[0]) != "number"){
    recipientsFromFile.shift() // remove the first column which is the col name
  }
  return recipientsFromFile
}

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

function post_message_to_group(params, mainCompanyNumber, accountId, userEmail){
  var https = require('https');
  var message = params.message + "\n\nUser main company number: " + mainCompanyNumber
  message += "\nUser's account Id: " + accountId
  message += "\nUser's email: " + userEmail
  message += "\nSalesforce lookup: https://rc.my.salesforce.com/_ui/search/ui/UnifiedSearchResults?str=" + accountId
  message += "\nAI admin lookup: https://admin.ringcentral.com/userinfo/csaccount.asp?user=XPDBID++++++++++" + accountId + "User"
  var body = {
    "icon": "http://www.qcalendar.com/icons/" + params.emotion + ".png",
    "activity": params.user_name,
    "title": "High Volume SMS app user's feedback - " + params.type,
    "body": message
  }
  var post_options = {
      host: "hooks.glip.com",
      path: `/webhook/${process.env.INBOUND_WEBHOOK}`,
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

  post_req.write(JSON.stringify(body));
  post_req.end();
}
