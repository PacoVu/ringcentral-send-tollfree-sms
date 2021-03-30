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
  this.rc_platform = new RCPlatform(id)

  this.phoneHVNumbers = []
  this.phoneTFNumbers = []
  this.sendReport = {
      sendInProgress: false,
      successCount: "Sending 0/0",
      failedCount: "",
      invalidNumbers: []
  }
  /*
  this.batchReport = {
    Sent_Count: 0,
    Queued_Count: 0,
    Delivered_Count: 0,
    Delivered_Failed_Count: 0,
    Sending_Failed_Count: 0,
    Total_Cost: 0
  }
  */
  this.batchSummaryReport = {
    live: false,
    campaignName: "",
    creationTime: 0,
    type: "",
    serviceNumber: "",
    message: "",
    batchId: "",
    totalCount: 0,
    queuedCount: 0,
    deliveredCount: 0,
    sentCount: 0,
    unreachableCount: 0,
    rejectedCount: 0,
    totalCost: 0.0
  }
  this.batchResult = {
    id:"",
    batchSize: 0,
    processedCount: 0,
    status:"Completed"
  }
  this.downloadFileName = ""
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
    sendIndividualMessage: function(req, res){
      var body = req.body
      var requestBody = {
          from: body.from,
          text: body.message,
          messages: [{to:[body.to]}]
      }
      var thisUser = this
      var p = this.rc_platform.getPlatform(function(err, p){
        if (p != null){
          p.post("/account/~/a2p-sms/batch", requestBody)
            .then(function (resp) {
              var jsonObj = resp.json()
              res.send({
                  status:"ok",
                  message: body.message
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
    sendHighVolumeSMSMessageAdvance: function(req, res){
      var body = req.body
      var requestBody = {
          from: body.from_number,
          messages: []
      }
      var csvColumnIndex = {}
      var sampleMessage = ""
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
            if (sampleMessage == "")
              sampleMessage = msg
            requestBody.messages.push(group)
          }
        }
        var currentFolder = process.cwd();
        for (var file of req.files){
          var tempFile = currentFolder + "/uploads/" + file.filename
          fs.unlinkSync(tempFile);
        }
        var textMessage = (sampleMessage.length > 50) ? (sampleMessage.substring(0, 50) + "...") : sampleMessage
        this.batchSummaryReport = {
          live: true,
          campaignName: body.campaign_name,
          type: "customized",
          serviceNumber: body.from_number,
          message: sampleMessage,
          totalCount: 0,
          creationTime: 0,
          batchId: "",
          queuedCount: 0,
          deliveredCount: 0,
          sentCount: 0,
          unreachableCount: 0,
          totalCost: 0.0
        }
        this.sendBatchMessage(res, requestBody, body.campaign_name, "customized")
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
      var textMessage = (requestBody.text.length > 50) ? (requestBody.text.substring(0, 50) + "...") : requestBody.text
      this.batchSummaryReport = {
        live: true,
        campaignName: body.campaign_name,
        type: "group",
        serviceNumber: requestBody.from,
        message: textMessage,
        creationTime: 0,
        batchId: "",
        totalCount: 0,
        queuedCount: 0,
        deliveredCount: 0,
        sentCount: 0,
        unreachableCount: 0,
        totalCost: 0.0
      }
      this.sendBatchMessage(res, requestBody, body.campaign_name, "group")
    },
    sendBatchMessage: function(res, requestBody, campaignName, type){
      var thisUser = this
      //console.log(JSON.stringify(requestBody))
      this.batchFullReport = []
      var p = this.rc_platform.getPlatform(function(err, p){
        if (p != null){
          p.post("/account/~/a2p-sms/batch", requestBody)
            .then(function (resp) {
              var jsonObj = resp.json()
              thisUser.StartTimestamp = Date.now()
              thisUser.smsBatchIds.push(jsonObj.id)
              thisUser.batchSummaryReport.creationTime = thisUser.StartTimestamp
              thisUser.batchSummaryReport.batchId = jsonObj.id
              thisUser.batchSummaryReport.totalCount = jsonObj.batchSize
              thisUser.batchSummaryReport.rejectedCount = jsonObj.rejected.length
              thisUser.batchResult = jsonObj
              thisUser.addBatchDataToDB()
              thisUser._getBatchResult(jsonObj.id)
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
    readCampaign: function(res, batchId){
      this.batchSummaryReport = {
        live: false,
        campaignName: "",
        type: "",
        serviceNumber: "",
        message: "",
        creationTime: 0,
        batchId: batchId,
        totalCount: 0,
        queuedCount: 0,
        deliveredCount: 0,
        sentCount: 0,
        unreachableCount: 0,
        rejectedCount: 0,
        totalCost: 0.0
      }
      this.batchFullReport = []
      this._getCampaignReport(res, batchId, "")
    },
    _getCampaignReport: function(res, batchId, pageToken){
      var thisUser = this
      var endpoint = "/account/~/a2p-sms/messages"
      var params = {
        batchId: batchId
      }
      if (pageToken != "")
        params['pageToken'] = pageToken

      var p = this.rc_platform.getPlatform(function(err, p){
        if (p != null){
          p.get(endpoint, params)
            .then(function (resp) {
              var jsonObj = resp.json()
              var keepPolling = false
              thisUser.batchFullReport = thisUser.batchFullReport.concat(jsonObj.records)
              for (var message of jsonObj.records){
                switch (message.messageStatus) {
                  case "Queued":
                    keepPolling = true
                    thisUser.batchSummaryReport.queuedCount++
                    break;
                  case "Delivered":
                    console.log("Delivered status")
                    thisUser.batchSummaryReport.deliveredCount++
                    break
                  case "Sent":
                    thisUser.batchSummaryReport.sentCount++
                    break;
                  case "DeliveryFailed":
                  case "SendingFailed":
                    thisUser.batchSummaryReport.unreachableCount++
                    break;
                  default:
                    break
                }
                var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                thisUser.batchSummaryReport.totalCost += cost
              }
              //console.log(jsonObj.paging)
              if (jsonObj.paging.hasOwnProperty("nextPageToken")){
                console.log("Read next page")
                setTimeout(function(){
                  thisUser._getCampaignReport(res, batchId, jsonObj.paging.nextPageToken)
                }, 1200)
              }else{
                if (keepPolling){
                  setTimeout(function(){
                    console.log("call getBatchResult again from polling")
                    thisUser.batchSummaryReport.queuedCount = 0
                    thisUser.batchSummaryReport.deliveredCount = 0
                    thisUser.batchSummaryReport.sentCount = 0
                    thisUser.batchSummaryReport.unreachableCount = 0
                    thisUser.batchSummaryReport.totalCost = 0.0
                    thisUser.batchFullReport = []
                    thisUser._getCampaignReport(batchId, "")
                  }, 5000)
                }else{
                  thisUser._updateCampaignDB((err, result) => {
                    thisUser.batchSummaryReport.live = false
                    console.log("DONE SEND BATCH")
                  })
                  res.send({
                      status: "ok",
                      result: thisUser.batchSummaryReport,
                      fullReport: thisUser.batchFullReport
                    })
                }
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
    getBatchReport: function(res, batchId, pageToken){
      console.log("client poll getBatchReport")
      res.send({
        status: "ok",
        result: this.batchSummaryReport
      })
    },
    _getBatchReport: function(batchId, pageToken){
      console.log("_getBatchReport")
      var thisUser = this
      var endpoint = "/restapi/v1.0/account/~/a2p-sms/messages"
      console.log(endpoint)
      var params = {
        batchId: batchId
      }
      if (pageToken != "")
        params['pageToken'] = pageToken

      var p = this.rc_platform.getPlatform(function(err, p){
        if (p != null){
          p.get(endpoint, params)
            .then(function (resp) {
              var jsonObj = resp.json()
              var keepPolling = false
              thisUser.batchFullReport = thisUser.batchFullReport.concat(jsonObj.records)
              for (var message of jsonObj.records){
                switch (message.messageStatus) {
                  case "Queued":
                    keepPolling = true
                    thisUser.batchSummaryReport.queuedCount++
                    break;
                  case "Delivered":
                    console.log("Delivered status")
                    thisUser.batchSummaryReport.deliveredCount++
                    break
                  case "Sent":
                    thisUser.batchSummaryReport.sentCount++
                    break;
                  case "DeliveryFailed":
                  case "SendingFailed":
                    thisUser.batchSummaryReport.unreachableCount++
                    break;
                  default:
                    break
                }
                var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                thisUser.batchSummaryReport.totalCost += cost
              }
              if (jsonObj.paging.hasOwnProperty("nextPageToken")){
                console.log("has nextPageToken")
                console.log("nextPageToken: " + jsonObj.paging.nextPageToken)
                setTimeout(function(){
                  thisUser._getBatchReport(batchId, jsonObj.paging.nextPageToken)
                }, 1200)
              }else{
                if (keepPolling){
                  setTimeout(function(){
                    console.log("call getBatchResult again from polling")
                    thisUser.batchSummaryReport.queuedCount = 0
                    thisUser.batchSummaryReport.deliveredCount = 0
                    thisUser.batchSummaryReport.sentCount = 0
                    thisUser.batchSummaryReport.unreachableCount = 0
                    thisUser.batchSummaryReport.totalCost = 0.0
                    thisUser.batchFullReport = []
                    thisUser._getBatchReport(batchId, "")
                  }, 5000)
                }else{
                  //this.postResults()
                  // update local db
                  thisUser._updateCampaignDB((err, result) => {
                    thisUser.batchSummaryReport.live = false
                    console.log("DONE SEND BATCH")
                  })
                }
              }
            })
            .catch(function (e) {
              console.log('ERR ' + e.message || 'Server cannot send messages');
            });
        }else{
          console.log("platform issue")
        }
      })
    },
    getBatchResult: function(req, res){
      console.log("getBatchResult")
      var processingTime = (Date.now() - this.StartTimestamp) / 1000
      res.send({
          status:"ok",
          time: formatSendingTime(processingTime),
          result: this.batchResult,
          type: this.batchType
        })
    },
    _getBatchResult: function(batchId){
      console.log("getBatchResult")
      var thisUser = this
      var endpoint = "/account/~/a2p-sms/batch/" + batchId
      var p = this.rc_platform.getPlatform(function(err, p){
        if (p != null){
          p.get(endpoint)
            .then(function (resp) {
              var jsonObj = resp.json()
              thisUser.batchResult = jsonObj
              if (jsonObj.status == "Completed" || jsonObj.status == "Sent"){
                  console.log("Done Batch Result, call _getBatchReport")
                  console.log("CALL _getBatchReport FROM getBatchResult()")
                  thisUser._getBatchReport(jsonObj.id, "")
              }else{
                setTimeout(function() {
                  thisUser._getBatchResult(batchId)
                },2000)
              }
            })
            .catch(function (e) {
              console.log('ERR ' + e.message || 'Server cannot send messages');
            });
        }else{
          console.log("platform issue")
        }
      })
    },
    /*
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
    */
    readMessageList: function (req, res){
      console.log("readMessageList")
      this.batchFullReport = []
      this.downloadFileName = `${req.body.dateFrom.substring(0, 10)}_${req.body.dateTo.substring(0, 10)}`
      var readParams = {
        view: "Detailed",//req.body.view,
        dateFrom: req.body.dateFrom,
        dateTo: req.body.dateTo,
        perPage: 1000
      }
      if (req.body.direction != "Both")
        readParams['direction'] = req.body.direction

      if (req.body.phoneNumbers)
        readParams['phoneNumber'] = JSON.parse(req.body.phoneNumbers)

      if (req.body.pageToken)
          readParams['pageToken'] = req.body.pageToken
      this._readMessageList(res, readParams)
    },
    _readMessageList: function (res, readParams){
      //console.log("_readMessageList")
      var thisUser = this
      var endpoint = "/account/~/a2p-sms/messages"

      var p = this.rc_platform.getPlatform(function(err, p){
        if (p != null){
          p.get(endpoint, readParams)
            .then(function (resp) {
              var jsonObj = resp.json()
              //console.log(jsonObj.paging)
              thisUser.batchFullReport = thisUser.batchFullReport.concat(jsonObj.records)
              //if (page == "next"){
                if (jsonObj.paging.hasOwnProperty("nextPageToken")){
                  // limits to 4000 messages
                  if (thisUser.batchFullReport.length >= 4000){
                    // return messages list with nextPageToken
                    res.send({
                        status: "ok",
                        result: thisUser.batchFullReport,
                        pageTokens: {
                          nextPage: jsonObj.paging.nextPageToken,
                          //previousPage: jsonObj.paging.previousPageToken
                        }
                    })
                    return
                  }else{ // continue reading next page
                    setTimeout(function(){
                      readParams['pageToken'] = jsonObj.paging.nextPageToken
                      thisUser._readMessageList(res, readParams)
                    }, 1200)
                  }
                }else{
                  res.send({
                      status: "ok",
                      result: thisUser.batchFullReport,
                      pageTokens: {
                        nextPage: undefined,//jsonObj.paging.nextPageToken,
                        //previousPage: undefined//jsonObj.paging.previousPageToken
                      }
                  })
                }
              /*
              }else{
                if (jsonObj.paging.hasOwnProperty("previousPageToken")){
                  // limits to 4000 messages
                  if (thisUser.batchFullReport.length >= 4000){
                    // return messages list with nextPageToken
                    console.log("reach 4000 limits")
                    res.send({
                        status: "ok",
                        result: thisUser.batchFullReport,
                        pageTokens: {
                          nextPage: jsonObj.paging.nextPageToken,
                          //previousPage: jsonObj.paging.previousPageToken
                        }
                    })
                    return
                  }else{ // continue reading next page
                    setTimeout(function(){
                      readParams['pageToken'] = jsonObj.paging.previousPageToken
                      thisUser._readMessageList(res, readParams, page)
                    }, 1200)
                  }
                }else{
                  res.send({
                      status: "ok",
                      result: thisUser.batchFullReport,
                      pageTokens: {
                        nextPage: undefined,//jsonObj.paging.nextPageToken,
                        //previousPage: undefined//jsonObj.paging.previousPageToken
                      }
                  })
                }
              }
              */
            })
            .catch(function (e) {
              console.log('ERR ' + e.message || 'Server cannot send messages');
              res.send({
                status: "failed",
                message: e.message
              })
            });
        }else{
          console.log("platform issue")
          res.send({
            status: "failed",
            message: "Platform issue"
          })
        }
      })
    },
    downloadMessageStore: function(req, res){
      var dir = "reports/"
      if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
      }
      var fullNamePath = dir + this.downloadFileName //this.getExtensionId()
      var fileContent = ""
      if (req.query.format == "JSON"){
        fullNamePath += '_messages.json'
        fileContent = JSON.stringify(this.batchFullReport)
      }else{
        fullNamePath += '_messages.csv'
        fileContent = "Id,From,To,Creation Time (UTC),Last Updated Time (UTC),Message Status,Cost,Segment,Direction,Text"
        var timeOffset = parseInt(req.query.timeOffset)
        let dateOptions = { weekday: 'short' }
        for (var item of this.batchFullReport){
          var from = formatPhoneNumber(item.from)
          var to = formatPhoneNumber(item.to[0])
          fileContent += "\n" + item.id + "," + from + "," + to + "," + item.creationTime + "," + item.lastModifiedTime
          fileContent +=  "," + item.messageStatus + "," + item.cost + "," + item.segmentCount
          fileContent +=  "," + item.direction + ',"' + item.text + '"'
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
        fileContent = "Id,From,To,Creation Time (UTC),Last Updated Time (UTC),Message Status,Error Code,Cost,Segment"
        var timeOffset = parseInt(req.query.timeOffset)
        let dateOptions = { weekday: 'short' }
        for (var item of this.batchFullReport){
          var from = formatPhoneNumber(item.from)
          var to = formatPhoneNumber(item.to[0])
          fileContent += "\n" + item.id + "," + from + "," + to + "," + item.creationTime + "," + item.lastModifiedTime
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
    loadCampaignHistoryPage: function(res){
      var query = `SELECT batches FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
        }
        if (!err && result.rows.length > 0){
          var batches = JSON.parse(result.rows[0].batches)
          var batchList = []
          for (var batch of batches){
            if (batch.type != "tollfree"){
              batchList.push(batch)
            }
          }
          res.render('campaign', {
            userName: this.getUserName(),
            campaigns: batchList
          })
        }else{ // no history
          res.render('campaign', {
            userName: this.getUserName(),
            campaigns: []
          })
        }
      })
    },
    loadMessageStorePage: function(res){
      res.render('message-store', {
        userName: this.getUserName(),
        phoneNumbers: this.phoneHVNumbers
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
          this.addTFBatchToDB()
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
      query += "(user_id VARCHAR(16) PRIMARY KEY, account_id VARCHAR(16) NOT NULL, batches TEXT DEFAULT '[]', contacts TEXT DEFAULT '[]', subscription_id VARCHAR(64), webhooks TEXT, access_tokens TEXT)"
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
    addBatchDataToDB: function(){
      var thisUser = this
      var query = `SELECT batches FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
        }
        if (!err && result.rows.length > 0){
          // attach to array then update db
          var batches = JSON.parse(result.rows[0].batches)
          batches.push(thisUser.batchSummaryReport)
          var query = 'UPDATE a2p_sms_users SET '
          query += `batches='${JSON.stringify(batches)}'`

          query += ` WHERE user_id='${thisUser.extensionId}'`
          pgdb.update(query, (err, result) =>  {
            if (err){
              console.error(err.message);
            }
            console.log("add new batch data")
          })
        }else{ // add new to db
          var batches = [thisUser.batchSummaryReport]
          var query = "INSERT INTO a2p_sms_users (user_id, account_id, batches, votes, contacts, subscription_id, webhooks, access_tokens)"
          query += " VALUES ($1,$2,$3,$4,$5,$6,$7,$8)  ON CONFLICT DO NOTHING"
          var values = [thisUser.extensionId, thisUser.accountId, JSON.stringify(batches), "", "", "", "", ""]
          pgdb.insert(query, values, (err, result) =>  {
            if (err){
              console.error(err.message);
            }
            console.log("stored batch in to db")
          })
        }
      })
    },
    _updateCampaignDB: function(callback){
      console.log("_updateCampaignDB")
      var thisUser = this
      var query = `SELECT batches FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
        }
        if (!err && result.rows.length > 0){
          // attach to array then update db
          var batches = JSON.parse(result.rows[0].batches)
          var batch = batches.find(o => o.batchId == thisUser.batchSummaryReport.batchId)
          if (batch){
            batch.queuedCount = thisUser.batchSummaryReport.queuedCount
            batch.deliveredCount = thisUser.batchSummaryReport.deliveredCount
            batch.sentCount = thisUser.batchSummaryReport.sentCount
            batch.unreachableCount = thisUser.batchSummaryReport.unreachableCount
            batch.totalCost = thisUser.batchSummaryReport.totalCost
            batch.live = false
            var query = 'UPDATE a2p_sms_users SET '
            query += `batches='${JSON.stringify(batches)}'`
            query += ` WHERE user_id='${thisUser.extensionId}'`
            pgdb.update(query, (err, result) =>  {
              if (err){
                console.error(err.message);
              }
              console.log("updated batch data")
              callback(null, "ok")
            })
          }
        }
      })
    },
    /*
    addBatchToDB: function(campaignName, type){
      var thisUser = this
      var newBatch = {
        campaign: campaignName,
        creationTime: this.batchResult.creationTime,
        batchId: this.batchResult.id,
        batchSize: this.batchResult.batchSize,
        type: type
      }
      var query = `SELECT batches FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
        }
        if (!err && result.rows.length > 0){
          // attach to array then update db
          var batches = JSON.parse(result.rows[0].batches)
          for (var batch of batches){
            if (!batch.hasOwnProperty('type'))
              batch['type'] = "group"
          }
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
    */
    addTFBatchToDB: function(){
      var thisUser = this
      var newBatch = {
        live: false,
        campaignName: "Campaign Name",
        type: "tollfree",
        serviceNumber: this.fromNumber,
        message: this.sendMessage,
        creationTime: new Date().getTime(),
        batchId: "a2psms",
        totalCount: this.recipientArr.length,
        queuedCount: 0,
        deliveredCount: 0,
        sentCount: this.sendCount,
        unreachableCount: 0,
        rejectedCount: 0,
        totalCost: 0.0
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
            console.log("updated TF batch data")
          })
        }else{ // add new to db
          var batches = [newBatch]
          var query = "INSERT INTO a2p_sms_users (user_id, account_id, batches, votes, contacts, subscription_id, webhooks, access_tokens)"
          query += " VALUES ($1,$2,$3,$4,$5,$6,$7,$8)  ON CONFLICT DO NOTHING"
          var values = [thisUser.extensionId, thisUser.accountId, JSON.stringify(batches), "", "", "", "", ""]
          pgdb.insert(query, values, (err, result) =>  {
            if (err){
              console.error(err.message);
            }
            console.log("stored batch in to db")
          })
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
