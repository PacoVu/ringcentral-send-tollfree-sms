var fs = require('fs')
var async = require("async");
const RCPlatform = require('./platform.js')
const pgdb = require('./db')
var router = require('./router');
const ActiveUser = require('./event-engine.js')
require('dotenv').load()

const MASK = "#!#"

function User(id) {
  this.id = id;
  this.extensionId = 0;
  this.accountId = 0;
  this.userEmail = "" // for feedback only
  this.userName = ""
  this.subscriptionId = ""
  this.eventEngine = undefined
  this.rc_platform = new RCPlatform()
  //this.sendVote = false
  this.phoneHVNumbers = []
  this.phoneTFNumbers = []

  // High Volume SMS Report
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
    totalCost: 0
  }

  /*
  this.batchSummaryReport = {
    Sent_Count: 0,
    Queued_Count: 0,
    Delivered_Count: 0,
    Delivered_Failed_Count: 0,
    Sending_Failed_Count: 0,
    Total_Cost: 0
  }
  */
  // High Volume SMS Result
  this.batchResult = {
    id:"",
    batchSize: 0,
    processedCount: 0,
    status:"Completed",
  }

  this.batchType = ""

  this.batchFullReport = []
  this.smsBatchIds = []
  this.mainCompanyNumber = ""
  this.downloadFileName = ""

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
  this.sendReport = {
      sendInProgress: false,
      successCount: "Sending 0/0",
      failedCount: "",
      invalidNumbers: []
  }
  return this
}

var engine = User.prototype = {
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
    /*
    loadHVManualPage: function(res){
      res.render('manual-input', {
        userName: this.getUserName(),
        phoneNumbers: this.phoneHVNumbers,
        smsBatchIds: this.smsBatchIds,
        batchResult: this.batchResult
      })
    },
    */
    loadSettingsPage: function(res, pageToken){
      res.render('settings', {
        userName: this.getUserName()
      })
    },
    loadConvSMSPage: function(res, pageToken){
      res.render('conversation-sms', {
        userName: this.getUserName(),
        phoneNumbers: this.phoneHVNumbers
      })
    },
    loadHVSMSPage: function(res){
      var thisUser = this
      console.log("handle after logged in!")
      //this.postResults()
      /*
      this.eventEngine = router.activeUsers.find(o => o.extensionId.toString() === this.extensionId.toString())
      if (this.eventEngine){
        this.subscriptionId = this.eventEngine.subscriptionId
        if (this.eventEngine.subscriptionId == ""){
          this.subscribeForNotification((err, subscriptionId) => {
            if (!err){
              thisUser.eventEngine.subscriptionId = subscriptionId
            }
            console.log("new subscriptionId: " + subscriptionId)
          })
        }else{
          this.renewNotification((err, subscriptionId) => {
            if (!err){
              console.log("SUB ID: " + subscriptionId)
              thisUser.eventEngine.subscriptionId = subscriptionId
              thisUser.subscriptionId = subscriptionId
            }
          })
        }

      }else{ // should subscribe for notification and create eventEngine by default
        this.subscribeForNotification((err, subscriptionId) => {
          thisUser.eventEngine = new ActiveUser(thisUser.extensionId, subscriptionId, "https://rclabs-hvsms-app-users.herokuapp.com/voteresult")
          // must push to router's activeUser list in order to receive routed subscription
          router.activeUsers.push(thisUser.eventEngine)
          thisUser.eventEngine.setPlatform(thisUser.rc_platform)
        })
      }
      */
      if (this.batchResult.id == ""){
        // read lastest batch
        var query = `SELECT batches FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
        pgdb.read(query, (err, result) => {
          if (err){
            console.error(err.message);
          }

          if (!err && result.rows.length > 0){
            var batches = JSON.parse(result.rows[0].batches)
            batchResult = batches[batches.length-1]

            thisUser.batchResult.status = "Completed"
            thisUser.batchResult.id = batchResult.batchId
            thisUser.batchResult.batchSize = batchResult.batchSize
            thisUser.batchType = batchResult.type
          }
          res.render('highvolume-sms', {
            userName: thisUser.getUserName(),
            phoneNumbers: thisUser.phoneHVNumbers,
            //smsBatchIds: this.smsBatchIds,
            batchResult: thisUser.batchResult,
            batchType: thisUser.batchType
          })
        })
      }else{
        res.render('highvolume-sms', {
          userName: this.getUserName(),
          phoneNumbers: this.phoneHVNumbers,
          //smsBatchIds: this.smsBatchIds,
          batchResult: this.batchResult,
          batchType: this.batchType
        })
      }
    },
    //login: function(req, res, callback){
    login: async function(req, res, callback){
      if (req.query.code) {
        var rc_platform = this.rc_platform
        var thisUser = this
        var extensionId = await this.rc_platform.login(req.query.code)
        if (extensionId){
          this.extensionId = extensionId
          req.session.extensionId = extensionId;

          //this.updateActiveUserTokensTable()

          //thisUser.deleteAllRegisteredWebHookSubscriptions()
          var p = this.rc_platform.getPlatform()
          if (p){
            try {
              var resp = await p.get("/restapi/v1.0/account/~/extension/~/")
              var jsonObj = await resp.json()
              this.accountId = jsonObj.account.id
              var fullName = jsonObj.contact.firstName + " " + jsonObj.contact.lastName
              if (jsonObj.contact.hasOwnProperty("email"))
                this.userEmail = jsonObj.contact.email
              this.userName = fullName

            } catch (e) {
              console.log("Failed")
              console.error(e.message);
            }
            await this._readA2PSMSPhoneNumber(p)
            //console.log(this.phoneHVNumbers)
            //console.log(this.phoneTFNumbers)
            callback(null, extensionId)
            res.send('login success');
            this.eventEngine = router.activeUsers.find(o => o.extensionId.toString() === this.extensionId.toString())
            if (this.eventEngine){
              this.subscriptionId = this.eventEngine.subscriptionId
              if (this.eventEngine.subscriptionId == ""){
                this.subscribeForNotification((err, subscriptionId) => {
                  if (!err){
                    thisUser.eventEngine.subscriptionId = subscriptionId
                  }
                  console.log("new subscriptionId: " + subscriptionId)
                })
              }else{
                this.renewNotification((err, subscriptionId) => {
                  if (!err){
                    console.log("SUB ID: " + subscriptionId)
                    thisUser.eventEngine.subscriptionId = subscriptionId
                    thisUser.subscriptionId = subscriptionId
                  }
                })
              }
            }else{ // should subscribe for notification and create eventEngine by default
              this.subscribeForNotification((err, subscriptionId) => {
                thisUser.eventEngine = new ActiveUser(thisUser.extensionId, subscriptionId, "https://rclabs-hvsms-app-users.herokuapp.com/voteresult")
                // must push to router's activeUser list in order to receive routed subscription
                router.activeUsers.push(thisUser.eventEngine)
                thisUser.eventEngine.setPlatform(thisUser.rc_platform)
              })
            }
          }else{
            console.log('login failed: no platform object')
            callback(null, extensionId)
            res.send('login success');
          }
        }else {
          res.send('login failed');
          callback("error", this.extensionId)
        }
      } else {
        res.send('No Auth code');
        callback("error", null)
      }
    },
    postResults: function (){
      if (this.eventEngine.connectorUrl == "" || this.eventEngine.userKey == "")
        return
      var https = require('https');
      //console.log(this.batchFullReport)

      var url = this.eventEngine.connectorUrl.replace("https://", "")
      var arr = url.split("/")
      var domain = arr[0]
      var path = `/${arr[1]}`
      console.log(domain)
      console.log(path)
      var post_options = {
          host: domain,
          path: path,
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            'a2p-user-key': this.eventEngine.userKey
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

      post_req.write(JSON.stringify(this.batchFullReport));
      //post_req.write(JSON.stringify(testBatch));
      post_req.end();
    },
    /*
    readA2PSMSPhoneNumber: async function(req, res){

      var p = this.rc_platform.getPlatform()
      if (p){
        this.phoneHVNumbers = []
        this.phoneTFNumbers = []
        try {
          var resp = await p.get("/restapi/v1.0/account/~/extension/~/phone-number", {
            "perPage": 1000,
            "usageType": ["MainCompanyNumber", "CompanyNumber", "DirectNumber"]
          })
          var jsonObj = await resp.json()
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
                this.phoneHVNumbers.push(item)
                break;
              }else if (feature == "SmsSender"){
                if (record.paymentType == "TollFree") {
                  if (record.type == "VoiceFax" || record.type == "VoiceOnly"){
                    var item = {
                          "format": formatPhoneNumber(record.phoneNumber),
                          "number": record.phoneNumber,
                          "type": "Toll-Free Number"
                    }
                    this.phoneTFNumbers.push(item)
                    break;
                  }
                }
              }
            }
            if (record.usageType == "MainCompanyNumber" && this.mainCompanyNumber == ""){
                this.mainCompanyNumber = formatPhoneNumber(record.phoneNumber)
            }
          }
          // decide what page to load
          if (this.phoneHVNumbers.length && this.phoneTFNumbers.length){
            // launch option page
            res.render('main', {
              userName: this.userName,
              lowVolume: true,
              highVolume: true
            })
          }else if (this.phoneHVNumbers.length){
            // launch high volume page
            res.render('highvolume-sms', {
              userName: this.userName,
              phoneNumbers: this.phoneHVNumbers,
              smsBatchIds: this.smsBatchIds,
              batchResult: this.batchResult
            })
          }else if (this.phoneTFNumbers.length){
            res.render('main', {
              userName: this.userName,
              lowVolume: true,
              highVolume: false
            })
          }else{
            // launch info page
            res.render('main', {
              userName: this.userName,
              lowVolume: false,
              highVolume: false
            })
          }
        } catch (e) {
          console.log("Cannot read phone numbers!!!")
          console.error(e.message);
          req.session.destroy();
          res.render('index')
        }
      }else{
        req.session.destroy();
        res.render('index')
      }
    },
    */
    readA2PSMSPhoneNumber: async function(req, res){
      // decide what page to load
      if (this.phoneHVNumbers.length && this.phoneTFNumbers.length){
        // launch option page
        res.render('main', {
          userName: this.userName,
          lowVolume: true,
          highVolume: true
        })
      }else if (this.phoneHVNumbers.length){
        // launch high volume page
        res.render('highvolume-sms', {
          userName: this.userName,
          phoneNumbers: this.phoneHVNumbers,
          smsBatchIds: this.smsBatchIds,
          batchResult: this.batchResult
        })
      }else if (this.phoneTFNumbers.length){
        res.render('main', {
          userName: this.userName,
          lowVolume: true,
          highVolume: false
        })
      }else{
        // launch info page
        res.render('main', {
          userName: this.userName,
          lowVolume: false,
          highVolume: false
        })
      }
    },
    _readA2PSMSPhoneNumber: async function(p){
      console.log("_readA2PSMSPhoneNumber")
      this.phoneHVNumbers = []
      this.phoneTFNumbers = []
      try {
        var resp = await p.get("/restapi/v1.0/account/~/extension/~/phone-number", {
          "perPage": 1000,
          "usageType": ["MainCompanyNumber", "CompanyNumber", "DirectNumber"]
        })
        var jsonObj = await resp.json()
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
              this.phoneHVNumbers.push(item)
              break;
            }else if (feature == "SmsSender"){
              if (record.paymentType == "TollFree") {
                if (record.type == "VoiceFax" || record.type == "VoiceOnly"){
                  var item = {
                    "format": formatPhoneNumber(record.phoneNumber),
                    "number": record.phoneNumber,
                    "type": "Toll-Free Number"
                  }
                  this.phoneTFNumbers.push(item)
                  break;
                }
              }
            }
          }
          if (record.usageType == "MainCompanyNumber" && this.mainCompanyNumber == ""){
            this.mainCompanyNumber = formatPhoneNumber(record.phoneNumber)
          }
        }
        console.log(this.phoneTFNumbers)
      } catch (e) {
        console.log("Cannot read phone numbers!!!")
        console.error(e.message);
      }
    },
    setWebhookAddress: function (req, res){
      var userKey = makeId()
      var query = 'UPDATE a2p_sms_users SET '
      var data = {
        url: req.body.address,
        headerName: req.body.header_name,
        headerValue: req.body.header_value
      }
      this.eventEngine.webhooks = data
      query += `webhooks='${JSON.stringify(data)}' WHERE user_id='${this.extensionId}'`
      console.log(query)
      pgdb.update(query, (err, result) =>  {
        if (err){
          console.error(err.message);
        }
        res.send({
          status: "ok",
          message: userKey
        })
      })
    },
    deleteWebhookAddress: function (res){
      var query = 'UPDATE a2p_sms_users SET '
      query += `webhooks='' WHERE user_id='${this.extensionId}'`
      console.log(query)
      pgdb.update(query, (err, result) =>  {
        if (err){
          console.error(err.message);
        }
        res.send({
          status: "ok",
          message: ""
        })
      })
    },
    readWebhookAddress: function (res){
      var data = {
        url: "",
        headerName: "",
        headerValue: ""
      }
      if (this.eventEngine.webhooks){
        data = this.eventEngine.webhooks
      }
      res.send({
        status: "ok",
        message: data
      })
      /*
      var query = `SELECT webhooks FROM a2p_sms_active_users WHERE user_id='${this.extensionId}'`
      console.log(query)
      pgdb.read(query, (err, result) =>  {
        var data = {
          url: "",
          header_name: "",
          header_value: ""
        }
        if (err){
          console.error(err.message);
        }
        if (!err && result.rows.length > 0){
          if (result.rows[0].webhooks){
          data = JSON.parse(result.rows[0].webhooks)
          }
        }
        res.send({
          status: "ok",
          message: data
        })
      })
      */
    },
    uploadContacts: function (req, res){
      var body = req.body
      if (req.files != undefined){
        var contactList = []
        for (var f of req.files){
          var currentFolder = process.cwd();
          var tempFile = currentFolder + "/uploads/" + f.filename
          var content = fs.readFileSync(tempFile, 'utf8');
          var contactsFromFile = content.trim().split("\r\n")
          var header = contactsFromFile[0]
          var columns = header.trim().split(",")
          var csvColumnIndex = {}
          for (var i=0; i<columns.length; i++){
            csvColumnIndex[columns[i]] = i
          }

          contactsFromFile.shift() // remove the first row which is the header

          for (var row of contactsFromFile){
            var columns = row.trim().split(",")
            var contactNumber = columns[csvColumnIndex[body.number_column]]
            contactNumber = (contactNumber[0] != "+") ? `+${contactNumber}` : contactNumber
            var contactFirstName = columns[csvColumnIndex[body.fname_column]]
            var contactLastName = columns[csvColumnIndex[body.lname_column]]
            var contact = {
              phoneNumber: contactNumber,
              fname: contactFirstName,
              lname: contactLastName
            }
            contactList.push(contact)
          }
        }
        var currentFolder = process.cwd();
        for (var file of req.files){
          var tempFile = currentFolder + "/uploads/" + file.filename
          fs.unlinkSync(tempFile);
        }
        // read contacts from db
        this.updateContactsDataInDB(contactList, (err, result) => {
          if (!err)
            res.send({
              status: "ok",
              message: "Updated."
            })
          else
          res.send({
            status: "failed",
            message: "Cannot update contacts"
          })
        })
      }
    },
    readContactsFromDataInDB: function(callback){
      var query = `SELECT contacts FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
        }
        if (!err && result.rows.length > 0){
          //var contacts = JSON.parse(result.rows[0].contacts)
          callback(null, result.rows[0].contacts)
        }else{ // no history
          callback(null, '[]')
        }
      })
    },
    updateContactsDataInDB: function(contactList, callback){
      var query = 'UPDATE a2p_sms_users SET '
      query += "contacts='" + JSON.stringify(contactList) + "' WHERE user_id='" + this.extensionId + "'"
      pgdb.update(query, (err, result) =>  {
        if (err){
          console.error(err.message);
          callback(err, "updated contacts failed")
        }
        callback(null, "updated contacts done")
      })
    },
    sendIndividualMessage: async function(req, res){
      var body = req.body
      var requestBody = {
          from: body.from,
          text: body.message,
          messages: [{to:[body.to]}]
      }
      var p = this.rc_platform.getPlatform()
      if (p){
        try {
          var resp = await p.post("/restapi/v1.0/account/~/a2p-sms/batch", requestBody)
          var jsonObj = await resp.json()
          res.send({
              status:"ok",
              message: body.message
          })
        } catch (e) {
          console.log('ERR ' + e.message);
          res.send({
              status:"error",
              message: e.message
          })
        }
      }else{
        res.send({
          status: "failed",
          message: "You have been logged out. Please login again."
        })
      }
    },
    sendHighVolumeMessage: function (req, res){
      // batchFullReport could take lots of memory
      // reset it to release memory
      this.batchFullReport = []
      var body = req.body
      if (body.expect_response){
        this._sendVoteMessage(req, res)
      }else{
        this._sendTailoredMessage(req, res)
      }
    },
    _sendVoteMessage: function (req, res){
      console.log("_sendVoteMessage")
      var body = req.body
      var expire = parseInt(body.expire) * 3600000
      var startTime = new Date().getTime()
      var allowCorrection = (body.allowed_correction == undefined) ? false : true
      var voteInfo = {
        campaignName: body.campaign_name,
        serviceNumber: body.from_number,
        startDateTime: startTime,
        endDateTime: startTime + expire,
        status: "Active",
        batchId: "",
        message: "",
        voteResults: {},
        autoReplyMessages: {},
        autoReply: false,
        allowCorrection: allowCorrection,
        voteCommands: [],
        voteCounts:{
          Cost: 0,
          Total: 0,
          Delivered: 0,
          Unreachable: 0,
          Replied: 0
        },
        voterList: []
      }
      //var commands = []
      if (body.command_1 != null && body.command_1 != ""){
        //commands.push(body.command_1)
        voteInfo.voteCommands.push(body.command_1)
        voteInfo.voteResults[body.command_1] = 0
      }
      if (body.command_2 != null && body.command_2 != ""){
        //commands.push(body.command_2)
        voteInfo.voteCommands.push(body.command_2)
        voteInfo.voteResults[body.command_2] = 0
      }
      if (body.command_3 != null && body.command_3 != ""){
        //commands.push(body.command_3)
        voteInfo.voteCommands.push(body.command_3)
        voteInfo.voteResults[body.command_3] = 0
      }

      // auto reply
      if (body.reply_1_message != null && body.reply_1_message != ""){
          voteInfo.autoReplyMessages[body.command_1] = body.reply_1_message
          voteInfo.autoReply = true
      }
      if (body.reply_2_message  != null && body.reply_2_message != ""){
          voteInfo.autoReplyMessages[body.command_2] = body.reply_2_message
          voteInfo.autoReply = true
      }
      if (body.reply_3_message != null && body.reply_3_message != ""){
          voteInfo.autoReplyMessages[body.command_3] = body.reply_3_message
          voteInfo.autoReply = true
      }

      var requestBody = {
          from: body.from_number,
          messages: []
      }
      var totalRecipients = 0
      var sampleMessage = ""
      if (body.enable_manual_input == "manual"){
        var recipients = body.recipients.trim()
        if (recipients != ""){
          var recipientArr = recipients.split("\n")
          var message = body.message
          voteInfo.voteCounts.Total = recipientArr.length
          requestBody['text'] = message
          totalRecipients = recipientArr.length
          for (var recipient of recipientArr){
            recipient = recipient.trim()
            recipient = (recipient[0] == "+") ? recipient : `+${recipient}`
            var item = {
              to:[recipient]
            }
            requestBody.messages.push(item)
          }
          var voter = {
              id: "",
              phoneNumber: recipient,
              isReplied: false,
              repliedMessage: "",
              repliedTime: 0,
              sentMessage: message,
              isSent: false
            }
          voteInfo.voterList.push(voter)
          //console.log(JSON.stringify(requestBody))
        }
      }else{
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
            totalRecipients = recipientsFromFile.length
            voteInfo.voteCounts.Total = recipientsFromFile.length

            var arr = message.match(/{([^}]*)}/g)
            if (!arr){ // no template => set common text message
              requestBody['text'] = message
            }
            var msg = message
            for (var row of recipientsFromFile){
              row = detectAndHandleCommas(row)
              var columns = row.trim().split(",")
              var toNumber = columns[csvColumnIndex[toNumberColumnName]]
              toNumber = (toNumber[0] != "+") ? `+${toNumber}` : toNumber
              if (arr){
                msg = resembleMessage(message, columns, csvColumnIndex)
                if (sampleMessage == "")
                  sampleMessage = msg
                var group = {
                    to: [toNumber],
                    text: msg
                }
                requestBody.messages.push(group)
              }else{ // no template => text is common to all recipients
                var item = {
                    to: [toNumber]
                }
                requestBody.messages.push(item)
              }

              var voter = {
                id: "",
                phoneNumber: toNumber,
                isReplied: false,
                repliedMessage: "",
                repliedTime: 0,
                sentMessage: msg,
                isSent: false
              }
              voteInfo.voterList.push(voter)
            }
            console.log(JSON.stringify(requestBody))
          }

          var currentFolder = process.cwd();
          for (var file of req.files){
            var tempFile = currentFolder + "/uploads/" + file.filename
            fs.unlinkSync(tempFile);
          }
          //this.updateActiveUserTokensTable()
          //this.eventEngine.setPlatform(this.rc_platform)
          //this.sendBatchMessage(res, requestBody, body.campaign_name, "vote", voteInfo)
        }
      }
      if (sampleMessage == "")
        sampleMessage = body.message
      voteInfo.message = sampleMessage
      this.batchSummaryReport = {
        live: true,
        campaignName: body.campaign_name,
        creationTime: new Date().getTime(),
        type: "vote",
        serviceNumber: body.from_number,
        message: sampleMessage,
        totalCount: totalRecipients,
        batchId: "",
        queuedCount: 0,
        deliveredCount: 0,
        sentCount: 0,
        unreachableCount: 0,
        totalCost: 0
      }

      console.log(this.batchSummaryReport)
      console.log("=====voteInfo=====")
      console.log(voteInfo)
      console.log(requestBody)
/*      
      res.send({
        status: "Failed",
        message: "Testing"
      })
      return
*/
      this.eventEngine.setPlatform(this.rc_platform)
      this.sendBatchMessage(res, requestBody, "vote", voteInfo)
    },
    _sendTailoredMessage: function(req, res){
      console.log("_sendTailoredMessage")
      var body = req.body
      var requestBody = {
          from: body.from_number,
          messages: []
      }
      var sendMode = "customized"
      //console.log(body.enable_manual_input)
      var sampleMessage = ""
      var totalRecipients = 0
      if (body.enable_manual_input == "manual"){
        var recipients = body.recipients.trim()
        if (recipients != ""){
          var recipientArr = recipients.split("\n")
          var message = body.message
          requestBody['text'] = message
          totalRecipients = recipientArr.length
          for (var recipient of recipientArr){
            recipient = recipient.trim()
            recipient = (recipient[0] == "+") ? recipient : `+${recipient}`
            var item = {
              to:[recipient]
            }
            requestBody.messages.push(item)
          }
          sendMode = "group"
          //console.log(JSON.stringify(requestBody))
        }
      }else{
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
            totalRecipients = recipientsFromFile.length
            var arr = message.match(/{([^}]*)}/g)
            if (!arr){ // no template => set common text message
              requestBody['text'] = message
              sendMode = "group"
            }

            for (var row of recipientsFromFile){
              row = detectAndHandleCommas(row)
              var columns = row.trim().split(",")
              var toNumber = columns[csvColumnIndex[toNumberColumnName]]
              toNumber = (toNumber[0] != "+") ? `+${toNumber}` : toNumber
              if (arr){
                var msg = resembleMessage(message, columns, csvColumnIndex)
                if (sampleMessage == "")
                  sampleMessage = msg
                var group = {
                    to: [toNumber],
                    text: msg
                }
                requestBody.messages.push(group)
              }else{ // no template => text is common to all recipients
                var item = {
                    to: [toNumber]
                }
                requestBody.messages.push(item)
              }
            }
            //console.log(JSON.stringify(requestBody))
          }
          var currentFolder = process.cwd();
          for (var file of req.files){
            var tempFile = currentFolder + "/uploads/" + file.filename
            fs.unlinkSync(tempFile);
          }
          //this.sendVote = false
          //this.sendBatchMessage(res, requestBody, body.campaign_name, sendMode, null)
        }
      }
      if (sampleMessage == "")
        sampleMessage = body.message
      this.batchSummaryReport = {
        live: true,
        campaignName: body.campaign_name,
        creationTime: new Date().getTime(),
        type: sendMode,
        serviceNumber: body.from_number,
        message: sampleMessage,
        totalCount: totalRecipients,
        batchId: "",
        queuedCount: 0,
        deliveredCount: 0,
        sentCount: 0,
        unreachableCount: 0,
        totalCost: 0
      }

      console.log(JSON.stringify(requestBody))
      console.log(this.batchSummaryReport)
/*
      console.log(requestBody)
      res.send({
        status: "Failed",
        message: "Testing"
      })
      return
*/
      this.sendBatchMessage(res, requestBody, sendMode, null)
    },
    sendBatchMessage: async function(res, requestBody, type, voteInfo){
      var thisUser = this
      //console.log(JSON.stringify(requestBody))
      var p = this.rc_platform.getPlatform()
      if (p){
        try {
          var resp = await p.post("/restapi/v1.0/account/~/a2p-sms/batch", requestBody)
          var jsonObj = await resp.json()
          this.StartTimestamp = Date.now()
          this.smsBatchIds.push(jsonObj.id)
          this.batchResult = jsonObj
          console.log(jsonObj)
          this.batchType = type

          this.batchFullReport = []
          this.batchSummaryReport.batchId = jsonObj.id
          if (type == "vote"){
            voteInfo.batchId = jsonObj.id
            // compare time
            console.log(new Date(voteInfo.startDateTime).toISOString())
            console.log("compare time ")
            console.log(jsonObj.creationTime)

            this.eventEngine.setVoteInfo(voteInfo, requestBody.from)

          }
          //this.addBatchDataToDB(campaignName, requestBody.from)
          this.addBatchDataToDB()
          this._getBatchResult(jsonObj.id)
          res.send({
              status:"ok",
              time: formatSendingTime(0),
              result: this.batchResult
          })
        } catch (e) {
          console.log('ERR ' + e.message);
          res.send({
              status:"error",
              message: e.message
          })
        }
      }else{
        res.send({
          status: "failed",
          message: "You have been logged out. Please login again."
        })
      }
    },
    getBatchResult: async function(req, res){
      console.log("getBatchResult")
      var processingTime = (Date.now() - this.StartTimestamp) / 1000
      res.send({
          status:"ok",
          time: formatSendingTime(processingTime),
          result: this.batchResult,
          type: this.batchType
        })
    },
    _getBatchResult: async function(batchId){
      console.log("getBatchResult")
      var endpoint = "/restapi/v1.0/account/~/a2p-sms/batch/" + batchId
      var p = this.rc_platform.getPlatform()
      if (p){
        try {
          var resp = await p.get(endpoint)
          var jsonObj = await resp.json()
          this.batchResult = jsonObj
          //console.log(jsonObj)
          // implement for vote
          if (jsonObj.status == "Completed" || jsonObj.status == "Sent"){
            /* no need
            this.batchSummaryReport.queuedCount = 0
            this.batchSummaryReport.deliveredCount = 0
            this.batchSummaryReport.sentCount = 0
            this.batchSummaryReport.unreachableCount = 0
            this.batchSummaryReport.totalCost = 0
            this.batchFullReport = []
            */
            if (this.batchType == "vote"){
              console.log("Done Batch Result, call _getVoteReport")
              this._getVoteReport(jsonObj.id, "")
            }else{
              console.log("Done Batch Result, call _getBatchReport")
              console.log("CALL _getBatchReport FROM getBatchResult()")
              this._getBatchReport(jsonObj.id, "")
            }
          }else{
            var thisUser = this
            setTimeout(function() {
              thisUser._getBatchResult(batchId)
            },2000)
          }
        } catch (e) {
          console.log('ERR ' + e.message);
        }
      }else{
        console.log('ERR ');
      }
    },
    /*
    readCampaignSummary: function(res, batchId){
      console.log("readCampaignSummary")
      var voteReport = this.eventEngine.getCampaignByBatchId(batchId)
      //console.log(batchId)
      //console.log(voteReport)
      if (batchId == this.batchSummaryReport.batchId){
        res.send({
            status: "ok",
            batchReport: this.batchSummaryReport,
            voteReport: voteReport
          })
      }else{
        var query = `SELECT batches FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
        pgdb.read(query, (err, result) => {
          if (err){
            console.error(err.message);
          }
          if (!err && result.rows.length > 0){
            var batches = JSON.parse(result.rows[0].batches)
            //batches.sort(sortBatchCreatedDate)
            var batch = batches.find(o => o.batchId == batchId)
            res.send({
              status: "ok",
              batchReport: batch,
              voteReport: voteReport
            })
          }else{ // no history
            res.send({
              status: "notfound",
              batchReport: {},
              voteReport: voteReport
            })
          }
        })
      }
    },
    */
    // read just vote info
    readCampaignSummary: function(res, batchId){
      console.log("readCampaignSummary - vote Report")
      var voteReport = this.eventEngine.getCampaignByBatchId(batchId)
      //console.log(batchId)
      //console.log(voteReport)
      res.send({
            status: "ok",
            voteReport: voteReport
      })
    },
    _getBatchReport: async function(batchId, pageToken){
      console.log("_getBatchReport")
      var endpoint = "/restapi/v1.0/account/~/a2p-sms/messages"
      console.log(endpoint)
      var params = {
        batchId: batchId
      }
      if (pageToken != "")
        params['pageToken'] = pageToken

      var p = this.rc_platform.getPlatform()
      if (p){
        try {
          var resp = await p.get(endpoint, params)
          var jsonObj = await resp.json()
          console.log("READ BATCH")
          console.log(JSON.stringify(jsonObj))
          console.log("READ RETURN")
          this.batchFullReport = this.batchFullReport.concat(jsonObj.records)

          var keepPolling = false
          for (var message of jsonObj.records){
            switch (message.messageStatus) {
              case "Queued":
                keepPolling = true
                this.batchSummaryReport.queuedCount++
                break;
              case "Delivered":
                console.log("Delivered status")
                this.batchSummaryReport.deliveredCount++
                break
              case "Sent":
                this.batchSummaryReport.sentCount++
                break;
              case "DeliveryFailed":
              case "SendingFailed":
                this.batchSummaryReport.unreachableCount++
                break;
              default:
                break
            }
            var cost = (message.hasOwnProperty('cost')) ? message.cost : 0
            this.batchSummaryReport.totalCost += cost
          }
          if (jsonObj.paging.hasOwnProperty("nextPageToken")){
            console.log("has nextPageToken")
            setTimeout(function(){
              this._getBatchReport(batchId, jsonObj.paging.nextPageToken)
            }, 1200)
          }else{
            var thisUser = this
            if (keepPolling){
              setTimeout(function(){
                console.log("call getBatchResult again from polling")
                thisUser.batchSummaryReport.queuedCount = 0
                thisUser.batchSummaryReport.deliveredCount = 0
                thisUser.batchSummaryReport.sentCount = 0
                thisUser.batchSummaryReport.unreachableCount = 0
                thisUser.batchSummaryReport.totalCost = 0
                thisUser.batchFullReport = []
                thisUser._getBatchReport(batchId, "")
              }, 5000)
            }else{
              //this.postResults()
              // update local db
              this._updateCampaignDB((err, result) => {
                thisUser.batchSummaryReport.live = false
                console.log("DONE SEND BATCH")
              })
            }
          }
        } catch (e) {
          console.log('ERR ' + e.message);
        }
      }else{
        console.log("platform issue")
      }
    },
    readCampaignDetails: function(res, batchId){
      console.log("readCampaignDetails")
      /*
      this.batchSummaryReport.queuedCount = 0
      this.batchSummaryReport.deliveredCount = 0
      this.batchSummaryReport.unreachableCount = 0
      this.batchSummaryReport.totalCost = 0
      */
      this.batchFullReport = []
      var batchReport = {
        live: false,
        totalCount: 0,
        queuedCount: 0,
        deliveredCount: 0,
        sentCount: 0,
        sendingFailedCount: 0,
        deliveryFailedCount: 0,
        totalCost: 0
      }
      this._readCampaignDetailsFromServer(res, batchId, batchReport, "")
    },
    _readCampaignDetailsFromServer: async function(res, batchId, batchReport, pageToken){
      console.log("_readCampaignDetailsFromServer")
      var thisUser = this
      var endpoint = "/restapi/v1.0/account/~/a2p-sms/messages"
      var params = {
        batchId: batchId
      }
      if (pageToken != "")
        //endpoint += "&pageToken=" + pageToken
        params['pageToken'] = pageToken
      //console.log(endpoint)
      var p = this.rc_platform.getPlatform()
      if (p){
        try {
          var resp = await p.get(endpoint, params)
          var jsonObj = await resp.json()
          this.batchFullReport = this.batchFullReport.concat(jsonObj.records)
          var keepPolling = false
          for (var message of jsonObj.records){
            switch (message.messageStatus) {
              case "Queued":
                batchReport.live = true
                batchReport.queuedCount++
                break;
              case "Delivered":
                batchReport.deliveredCount++
                break;
              case "Sent":
                batchReport.sentCount++
                break;
              case "DeliveryFailed":
                batchReport.deliveryFailedCount++
                break;
              case "SendingFailed":
                batchReport.sendingFailedCount++
                break;
              default:
                break
            }
            var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
            batchReport.totalCost += cost
          }
          //console.log(jsonObj.paging)
          if (jsonObj.paging.hasOwnProperty("nextPageToken")){
            console.log("Read next page")
            setTimeout(function(){
              thisUser._readCampaignDetailsFromServer(res, batchId, batchReport, jsonObj.paging.nextPageToken)
            }, 1200)
          }else{
            res.send({
                status: "ok",
                summaryReport: batchReport,
                fullReport: this.batchFullReport
              })
            // reset class batchFullReport to release memory? User may want to download the report
            // this.batchFullReport = []
          }
        } catch (e) {
          console.log('ERR ' + e.message);
          res.send({
            status: "error",
            message: e.message
          })
        }
      }else{
        res.send({
          status: "failed",
          message: "You have been logged out. Please login again."
        })
      }
    },
    /*
    getBatchReport: function(res, batchId){
      console.log("getBatchReport")
      this.batchSummaryReport.queuedCount = 0
      this.batchSummaryReport.deliveredCount = 0
      this.batchSummaryReport.unreachableCount = 0
      this.batchSummaryReport.totalCost = 0
      this.batchFullReport = []

      this._getBatchReport_old(res, batchId, "")
    },
    */
    /*
    _getBatchReport_old: async function(res, batchId, pageToken){
      var thisUser = this
      var endpoint = "/restapi/v1.0/account/~/a2p-sms/messages?batchId=" + batchId
      var params = {}
      if (pageToken != "")
        //endpoint += "&pageToken=" + pageToken
        params['pageToken'] = pageToken
      //console.log(endpoint)
      var p = this.rc_platform.getPlatform()
      if (p){
        try {
          var resp = await p.get(endpoint, params)
          var jsonObj = await resp.json()
          this.batchFullReport = this.batchFullReport.concat(jsonObj.records)
          var keepPolling = false
          for (var message of jsonObj.records){
            switch (message.messageStatus) {
              case "Queued":
                keepPolling = true
                this.batchSummaryReport.queuedCount++
                break;
              case "Delivered":
                this.batchSummaryReport.deliveredCount++
                break;
              case "Sent":
                this.batchSummaryReport.sentCount++
                break;
              case "DeliveryFailed":
              case "SendingFailed":
                this.batchSummaryReport.unreachableCount++
                break;
              default:
                break
            }
            var cost = (message.hasOwnProperty('cost')) ? message.cost : 0
            this.batchSummaryReport.totalCost += cost
          }
          //console.log(jsonObj.paging)
          if (jsonObj.paging.hasOwnProperty("nextPageToken")){
            //console.log("Read next page")
            setTimeout(function(){
              this._getBatchReport_old(res, batchId, jsonObj.paging.nextPageToken)
            }, 1200)
          }else{
            res.send({
                status: "ok",
                summaryReport: this.batchSummaryReport,
                fullReport: this.batchFullReport,
                batchType: this.batchType
              })
          }
        } catch (e) {
          console.log('ERR ' + e.message);
          res.send({
            status: "error",
            message: e.message
          })
        }
      }else{
        res.send({
          status: "failed",
          message: "You have been logged out. Please login again."
        })
      }
    },
    */
    getVoteResult: function (res){
      //console.log("getVoteResult")
      if (this.eventEngine){
        console.log(this.eventEngine.voteCampaignArr)
        res.send({
            status: "ok",
            voteCampaignArr: this.eventEngine.voteCampaignArr
          })
      }else{
        res.send({
            status: "ok",
            voteCampaignArr: []
          })
      }
    },
    _getVoteReport: async function (batchId, pageToken){
      console.log("_getVoteReport")
      var endpoint = "/restapi/v1.0/account/~/a2p-sms/messages"
      console.log(endpoint)
      var params = {
        batchId: batchId
      }
      if (pageToken != "")
        params['pageToken'] = pageToken

      var campaign = this.eventEngine.getCampaignByBatchId(batchId)
      console.log("Set vote campaign info")
      console.log(campaign)
      var p = this.rc_platform.getPlatform()
      if (p){
        try {
          var resp = await p.get(endpoint, params)
          var jsonObj = await resp.json()
          var keepPolling = false
          for (var message of jsonObj.records){
            switch (message.messageStatus) {
              case "Queued":
                keepPolling = true
                this.batchSummaryReport.queuedCount++
                break;
              case "Delivered":
              case "Sent":
                console.log("Delivered/Sent status")

                var voter = campaign.voterList.find(o => o.phoneNumber == message.to[0])
                if (voter && voter.isSent == false){
                  campaign.voteCounts.Delivered++
                  this.batchSummaryReport.deliveredCount++
                  voter.id = message.id
                  voter.isSent = true
                }
                break;
              case "DeliveryFailed":
              case "SendingFailed":
                this.batchSummaryReport.unreachableCount++
                campaign.voteCounts.Unreachable++
                break;
              default:
                break
            }
            var cost = (message.hasOwnProperty('cost')) ? message.cost : 0
            this.batchSummaryReport.totalCost += cost
            campaign.voteCounts.Cost += cost
            /*
            if (message.messageStatus == "Queued"){
              keepPolling = true
            }else if (message.messageStatus == "Delivered" || message.messageStatus == "Sent"){
              var voter = campaign.voterList.find(o => o.phoneNumber == message.to[0])
              if (voter && voter.isSent == false){
                campaign.voteCounts.Delivered++
                voter.id = message.id
                voter.isSent = true
              }
            }else if (message.messageStatus == "DeliveryFailed"){
              campaign.voteCounts.Unreachable++
            }else if (message.messageStatus == "SendingFailed"){
              campaign.voteCounts.Unreachable++
            }
            var cost = (message.hasOwnProperty('cost')) ? message.cost : 0
            campaign.voteCounts.Cost += cost
            */
          }
          var thisUser = this
          if (jsonObj.paging.hasOwnProperty("nextPageToken")){
            setTimeout(function(){
              thisUser._getVoteReport(batchId, jsonObj.paging.nextPageToken)
            }, 1200)
          }else{
            if (keepPolling){
              setTimeout(function(){
                // reset voteCounts
                campaign.voteCounts.Cost = 0
                campaign.voteCounts.Delivered = 0
                campaign.voteCounts.Unreachable = 0
                thisUser._getVoteReport(batchId, "")
              }, 5000)
            }else{
              //thisUser.eventEngine.setVoteStatusChanges(batchId, thisUser.currentVoteCounts)
              /*
              console.log(campaign)
              this.eventEngine.setCampainByBatchId(batchId, campaign)
              this.eventEngine.updateVoteDataInDB((err, res) => {
                console.log("DONE VOTE")
              })
              //
              */
              var thisUser = this
              if (keepPolling){
                setTimeout(function(){
                  console.log("call getBatchResult again from polling")
                  campaign.voteCounts.Cost = 0
                  campaign.voteCounts.Delivered = 0
                  campaign.voteCounts.Unreachable = 0

                  thisUser.batchSummaryReport.queuedCount = 0
                  thisUser.batchSummaryReport.deliveredCount = 0
                  thisUser.batchSummaryReport.sentCount = 0
                  thisUser.batchSummaryReport.unreachableCount = 0
                  thisUser.batchSummaryReport.totalCost = 0
                  thisUser.batchFullReport = []
                  thisUser._getBatchReport(batchId, "")
                }, 5000)
              }else{
                //this.postResults()
                // update local db
                this.eventEngine.setCampainByBatchId(batchId, campaign)
                this.eventEngine.updateVoteDataInDB((err, res) => {
                  console.log("DONE VOTE")
                })
                this._updateCampaignDB((err, result) => {
                  thisUser.batchSummaryReport.live = false
                  console.log("DONE SEND BATCH")
                })
              }
            }
          }
        } catch (e) {
          console.log('ERR ' + e.message);
        }
      }else{
        console.log("platform issue")
      }
    },
    /*
    getBatchResult: async function(req, res){
      console.log("getBatchResult")
      var endpoint = "/restapi/v1.0/account/~/a2p-sms/batch/" + req.query.batchId
      var p = this.rc_platform.getPlatform()
      if (p){
        try {
          var resp = await p.get(endpoint)
          var jsonObj = await resp.json()
          var processingTime = (Date.now() - this.StartTimestamp) / 1000
          this.batchResult = jsonObj
          console.log(jsonObj)
          // implement for vote
          if (this.batchType == "vote"){
            if (jsonObj.status == "Completed" || jsonObj.status == "Sent"){
              console.log("Done Batch Result, call _getVoteResult")
              //thisUser.currentVoteCounts.Cost = 0
              //thisUser.currentVoteCounts.Delivered = 0
              //thisUser.currentVoteCounts.Unreachable = 0
              //thisUser.currentVoteCounts.Voters = []
              this._getVoteResult(req.query.batchId, "")
            }
          }
          //
          res.send({
              status:"ok",
              time: formatSendingTime(processingTime),
              result: this.batchResult,
              type: this.batchType
            })
        } catch (e) {
          console.log('ERR ' + e.message);
          res.send({
              status: "error",
              message: e.message
            })
        }
      }else{
        res.send({
          status: "failed",
          message: "You have been logged out. Please login again."
        })
      }
    },
    */
    /*
    getBatchResult: async function(req, res){
      console.log("getBatchResult")
      var endpoint = "/restapi/v1.0/account/~/a2p-sms/batch/" + req.query.batchId
      var p = this.rc_platform.getPlatform()
      if (p){
        try {
          var resp = await p.get(endpoint)
          var jsonObj = await resp.json()
          var processingTime = (Date.now() - this.StartTimestamp) / 1000
          this.batchResult = jsonObj
          //console.log(jsonObj)
          // implement for vote
          if (jsonObj.status == "Completed" || jsonObj.status == "Sent"){
            if (this.batchType == "vote"){
              console.log("Done Batch Result, call _getVoteResult")
              this._getVoteResult(req.query.batchId, "")
            }else{
              console.log("Done Batch Result, call _getBatchReport")
              this.batchSummaryReport.queuedCount = 0
              this.batchSummaryReport.deliveredCount = 0
              this.batchSummaryReport.sentCount = 0
              this.batchSummaryReport.unreachableCount = 0
              this.batchSummaryReport.totalCost = 0
              this.batchFullReport = []
              console.log("CALL _getBatchReport FROM getBatchResult()")
              this._getBatchReport(req.query.batchId, "")
            }
          }
          //
          res.send({
              status:"ok",
              time: formatSendingTime(processingTime),
              result: this.batchResult,
              type: this.batchType
            })
        } catch (e) {
          console.log('ERR ' + e.message);
          res.send({
              status: "error",
              message: e.message
            })
        }
      }else{
        res.send({
          status: "failed",
          message: "You have been logged out. Please login again."
        })
      }
    },
    */
    pollNewMessages: function(res){
      if (this.eventEngine){
        res.send({
          status: "ok",
          newMessages: this.eventEngine.incomingMessageArr
        })
        this.eventEngine.incomingMessageArr = []
      }else{
        res.send({
          status: "ok",
          newMessages: []
        })
      }
    },
    readMessageList: function (req, res){
      console.log("readMessageList")
      this.batchFullReport = []
      // reset incoming messages via webhook
      this.eventEngine.incomingMessageArr = []
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
    _readMessageList: async function (res, readParams){
      //console.log("_readMessageList")
      var thisUser = this
      var endpoint = "/restapi/v1.0/account/~/a2p-sms/messages"

      var p = this.rc_platform.getPlatform()
      if (p){
        try {
          var resp = await p.get(endpoint, readParams)
          var jsonObj = await resp.json()
          this.batchFullReport = this.batchFullReport.concat(jsonObj.records)
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
            // reset: ?? don't reset, user may want to download it
            //thisUser.batchFullReport = []
          }
        } catch (e) {
          console.log('ERR ' + e.message);
          res.send({
              status: "error",
              message: e.message
            })
        }
      }else{
        res.send({
          status: "failed",
          message: "You have been logged out. Please login again."
        })
      }
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
    /*
    readMessageList: async function (req, res, pageToken){
      console.log("readMessageList")
      console.log("pageToken " + pageToken)
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

      var endpoint = "/restapi/v1.0/account/~/a2p-sms/messages"

      if (pageToken == "")
        this.batchFullReport = []
      else
        readParams['pageToken'] = pageToken
      var clientPhoneNumbers = []
      var p = this.rc_platform.getPlatform()
      if (p){
        try {
          var resp = await p.get(endpoint, readParams)
          var jsonObj = await resp.json()
          this.batchFullReport = this.batchFullReport.concat(jsonObj.records)
          var thisUser = this
          if (jsonObj.paging.hasOwnProperty("nextPageToken")){
            setTimeout(function(){
              thisUser.readMessageList(req, res, jsonObj.paging.nextPageToken)
            }, 1200)
          }else{
            res.send({
                status: "ok",
                result: this.batchFullReport
              })
          }
        } catch (e) {
          console.log('ERR ' + e.message);
          res.send({
              status: "error",
              message: e.message
            })
        }
      }else{
        res.send({
          status: "failed",
          message: "You have been logged out. Please login again."
        })
      }
    },
    downloadMessageStore: function(req, res){
      var dir = "reports/"
      if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
      }
      var fullNamePath = dir + this.getExtensionId()
      var fileContent = ""
      if (req.query.format == "JSON"){
        fullNamePath += '_messages.json'
        fileContent = JSON.stringify(this.batchFullReport)
      }else{
        fullNamePath += '_messages.csv'
        fileContent = "Id,From,To,Creation Time,Last Updated Time,Message Status,Cost,Segment,Direction,Text"
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
    */
    deleteCampainResult: function(req, res){
      if (this.eventEngine){
        this.eventEngine.deleteCampaignByBatchId(req.query.batchId, (err, result) => {
          if (err)
            res.send({"status":"failed","message":"Cannot deleted"})
          else
            res.send({"status":"ok","message":"deleted"})
        })
      }
    },
    downloadSurveyCampainResult: function(req, res){
      var dir = "reports/"
      if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
      }
      var extId = this.getExtensionId()
      var fullNamePath = dir + req.query.batchId
      var fileContent = ""

      if (this.eventEngine){
        var campaign = this.eventEngine.getCampaignByBatchId(req.query.batchId)
        if (campaign){
          var timeOffset = parseInt(req.query.timeOffset)
          fileContent = "Campaign,From,To,Creation Time,Status,Sent Message,Response Option,Response Message,Response Time,Replied,Delivered"

          let dateOptions = { weekday: 'short' }
          for (var voter of campaign.voterList){
            fileContent += `\n${campaign.campaignName}`
            fileContent += `,${req.query.serviceNumber}`
            fileContent += `,${voter.phoneNumber}`
            var date = new Date(campaign.startDateTime - timeOffset)
            var dateStr = date.toISOString()
            fileContent += `,${dateStr}`
            fileContent += `,${campaign.status}`
            fileContent += `,"${voter.sentMessage}"`
            var commands = campaign.voteCommands.join("|")
            fileContent += `,${commands}`
            fileContent += `,"${voter.repliedMessage}"`
            date = new Date(voter.repliedTime - timeOffset)
            dateStr = date.toISOString()
            fileContent += `,"${dateStr}"`
            fileContent += `,${voter.isReplied}`
            fileContent += `,${voter.isSent}`
          }
          fullNamePath += `-${campaign.campaignName.replace(" ", "-")}-campaign-result.csv`
          try{
            fs.writeFileSync('./'+ fullNamePath, fileContent)
            var link = "/downloads?filename=" + fullNamePath
            res.send({"status":"ok","message":link})
          }catch (e){
            console.log("cannot create report file")
            res.send({"status":"failed","message":"Cannot create a report file! Please try gain"})
          }
        }else{
          res.send({"status":"failed","message":"This servey has been deleted."})
        }
      }else{
        res.send({"status":"failed","message":"Cannot create a campaign result file! Please try gain"})
      }
    },
    downloadBatchReport: function(req, res){
      var dir = "reports/"
      if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
      }
      var fullNamePath = dir + req.query.batchId
      var fileContent = ""
      if (req.query.format == "JSON"){
        fullNamePath += '.json'
        fileContent = JSON.stringify(this.batchFullReport)
      }else{
        fullNamePath += '.csv'
        fileContent = "Id,From,To,Creation Time,Last Updated Time,Message Status,Cost,Segment"
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
          fileContent +=  "," + item.messageStatus + "," + item.cost + "," + item.segmentCount
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
    _readBatchData: function(){

    },
    downloadVoteReport: function(req, res){
      var dir = "reports/"
      if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
      }
      var extId = this.getExtensionId()
      var fullNamePath = dir + extId
      var fileContent = ""
      fullNamePath += '_vote-result.csv'
      var query = `SELECT votes FROM a2p_sms_users WHERE user_id='${extId}'`
      pgdb.read(query, (err, result) => {
          if (err){
            console.error(err.message);
          }
          var timeOffset = parseInt(req.query.timeOffset)
          fileContent = "Campaign,From,To,Creation Time,Status,Sent Message,Response Option,Response Message,Response Time,Replied,Delivered"
          if (!err && result.rows.length > 0){
            let dateOptions = { weekday: 'short' }
            var allCampaigns = JSON.parse(result.rows[0].votes)
            for (var voteCampaign of allCampaigns){
              for (var campaign of voteCampaign.campaigns){
                for (var voter of campaign.voterList){
                  fileContent += `\n${campaign.campaignName}`
                  fileContent += `,${voteCampaign.serviceNumber}`
                  fileContent += `,${voter.phoneNumber}`
                  var date = new Date(campaign.startDateTime - timeOffset)
                  var dateStr = date.toISOString()
                  fileContent += `,${dateStr}`
                  fileContent += `,${campaign.status}`
                  fileContent += `,"${voter.sentMessage}"`
                  var commands = campaign.voteCommands.join("|")
                  fileContent += `,${commands}`
                  fileContent += `,"${voter.repliedMessage}"`
                  date = new Date(voter.repliedTime - timeOffset)
                  dateStr = date.toISOString()
                  fileContent += `,"${dateStr}"`
                  fileContent += `,${voter.isReplied}`
                  fileContent += `,${voter.isSent}`
                }
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
          }
        })
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
    logout: async function(req, res, callback){
      console.log("LOGOUT FUNC")
      if (this.eventEngine && this.eventEngine.voteCampaignArr.length > 0){
        var canLogout = true
        for (var voteCampaign of this.eventEngine.voteCampaignArr){
          for (var campaign of voteCampaign.campaigns){
            if (campaign.status == "Active"){
              canLogout = false
              console.log("Don't logout => keep tokens valid for sending reply msg")
              break
            }
          }
        }
        if (canLogout){
          await this.rc_platform.getPlatform().logout()
        }
        callback(null, "logged out")
      }else{
        await this.rc_platform.getPlatform().logout()
        callback(null, "logged out")
      }
      /*
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
      */
    },
    loadCampaignHistoryPage: function(res){

      var query = `SELECT batches FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
        }
        if (!err && result.rows.length > 0){
          var batches = JSON.parse(result.rows[0].batches)
          batches.sort(sortBatchCreatedDate)
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
      /*
      res.render('campaign', {
        userName: this.getUserName(),
        phoneNumbers: this.phoneHVNumbers,
      })
      */
    },
    readCampaignsLogFromDB: function(res){
      var thisUser = this
      var query = `SELECT batches FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
        }
        if (!err && result.rows.length > 0){
          var batches = JSON.parse(result.rows[0].batches)
          batches.sort(sortBatchCreatedDate)
          thisUser.batchSummaryReport = batches[0]
          //var voteReport = thisUser.eventEngine.getCampaignByBatchId(thisUser.batchSummaryReport.batchId)
          res.send({
            status: "ok",
            campaigns: batches,
            recentBatch: thisUser.batchSummaryReport,
            voteReports: thisUser.eventEngine.voteCampaignArr
          })
        }else{ // no history
          res.send({
            status: "ok",
            campaigns: [],
            recentBatch: thisUser.batchSummaryReport,
            voteReports: thisUser.eventEngine.voteCampaignArr
          })
        }
      })
    },
    loadMessageStorePage: function(res){
      this.readContactsFromDataInDB((err, contacts) => {
        res.render('message-store', {
          userName: this.getUserName(),
          phoneNumbers: this.phoneHVNumbers,
          contactList: contacts
        })
      })
    },
    // Notifications
    subscribeForNotification: async function(callback){
      var p = this.rc_platform.getPlatform()
      if (p){
        var eventFilters = []
        for (var item of this.phoneHVNumbers){
          //var filter = `/restapi/v1.0/account/~/a2p-sms/messages?direction=Inbound&to=${item.number}`
          var filter = `/restapi/v1.0/account/~/a2p-sms/messages?direction=Inbound&to=${item.number}`
          eventFilters.push(filter)
          filter = `/restapi/v1.0/account/~/a2p-sms/messages?direction=Outbound&from=${item.number}`
          eventFilters.push(filter)
        }
        try {
          var resp = await p.post('/restapi/v1.0/subscription', {
            eventFilters: eventFilters,
            deliveryMode: {
              transportType: 'WebHook',
              address: process.env.DELIVERY_MODE_ADDRESS
            },
            expiresIn: process.env.WEBHOOK_EXPIRES_IN
          })
          var jsonObj = await resp.json()
          console.log("Ready to receive telephonyStatus notification via WebHook.")
          this.subscriptionId = jsonObj.id
          //thisUser.eventEngine.subscriptionId = thisUser.subscriptionId
          console.log("Subscription created")
          console.log(this.subscriptionId)
          this.updateActiveUserSubscription()
          callback(null, jsonObj.id)
        } catch (e) {
          console.log('ERR ' + e.message);
          callback(e.message, "failed")
        }
      }else{
        callback(err, "failed")
      }
    },
    renewNotification: async function(callback){
      var p = this.rc_platform.getPlatform()
      if (p){
        try {
          var resp = await p.get(`/restapi/v1.0/subscription/${this.subscriptionId}`)
          var jsonObj = await resp.json()
          console.log(JSON.stringify(jsonObj))
          if (jsonObj.status != "Active"){
            console.log("RENEW subscription")
            try {
            var renewResp = await p.post(`/restapi/v1.0/subscription/${this.subscriptionId}/renew`)
            var jsonObjRenew = renewResp.json()
              console.log("Update notification via WebHook.")
              callback(null, jsonObjRenew.id)
            } catch(e){
              console.log(e.message)
              callback(e, e.message)
            }
          }else{
            console.log("still active => use it")
            callback(null, jsonObj.id)
          }
        } catch (e) {
          console.log('ERR ' + e.message)
          this.subscribeForNotification((err, res) => {
            callback(err, res)
          })
        }
      }else{
        console.log("err: " + renewNotification);
        callback("err", "failed")
      }
    },
    /// Clean up WebHook subscriptions
    deleteAllRegisteredWebHookSubscriptions: async function() {
      var p = this.rc_platform.getPlatform()
      if (p){
        try{
          var resp = await p.get('/restapi/v1.0/subscription')
          var jsonObj = await resp.json()
          if (jsonObj.records.length > 0){
            for (var record of jsonObj.records) {
              console.log(JSON.stringify(record))

              if (record.deliveryMode.transportType == "WebHook"){
                var r =  await p.delete(`/restapi/v1.0/subscription/${record.id}`)
                  console.log("Deleted")
              }
            }
            console.log("Deleted all")
          }else{
            console.log("No subscription to delete")
          }
        }catch(e){
            console.log(e.message)
        }
      }else{
        console.log("Cannot get platform => Delete all subscriptions error")
      }
    },
    // Standard SMS
    sendSMSMessageAsync: async function(req, res){
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
    sendMessages: async function(){
      var thisUser = this
      var currentIndex = this.index
      var totalCount = this.recipientArr.length

      this.intervalTimer = setInterval(async function() {
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

            var p = thisUser.rc_platform.getPlatform()
            if (p){
              try {
                var params = {
                  from: {'phoneNumber': thisUser.fromNumber},
                  to: [{'phoneNumber': recipient }],
                  text: thisUser.sendMessage
                }
                var resp = await p.post('/restapi/v1.0/account/~/extension/~/sms', params)
                var jsonObj = await resp.json()
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
              } catch (e) {
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
              }
            }else{
              console.log("platform error")
            }
          }else{
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
    /*
    createTable: function (callback) {
      console.log("CREATE TABLE")
      var query = 'CREATE TABLE IF NOT EXISTS a2p_sms_users '
      query += '(user_id VARCHAR(16) PRIMARY KEY, account_id VARCHAR(16) NOT NULL, batches TEXT, votes TEXT, contacts TEXT)'
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
    */
    /*
    addBatchToDB: function(campaignName, batchInfo, type){
      var thisUser = this
      var newBatch = {
        campaign: campaignName,
        creationTime: batchInfo.creationTime,
        batchId: batchInfo.id,
        batchSize: batchInfo.batchSize,
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
    //addBatchDataToDB: function(campaignName, serviceNumber){
    addBatchDataToDB: function(){
      var thisUser = this
      /*
      var newBatch = {
        campaign: campaignName,
        creationTime: this.batchResult.creationTime,
        batchId: this.batchResult.id,
        batchSize: this.batchResult.batchSize,
        type: this.batchType,
        batchSummaryReport: this.batchSummaryReport
      }
      */
      /*
      campaignName: body.campaign_name,
      creationTime: new Date().getTime(),
      type: sendMode,
      serviceNumber: body.from_number,
      message: body.message,
      batchId: "",
      totalCount: totalRecipients,
      queuedCount: 0,
      deliveredCount: 0,
      unreachableCount: 0,
      totalCost: 0
      */
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
          if (thisUser.batchType == "vote")
            query += `, votes='${JSON.stringify(thisUser.eventEngine.voteCampaignArr)}'`

          query += ` WHERE user_id='${thisUser.extensionId}'`
          pgdb.update(query, (err, result) =>  {
            if (err){
              console.error(err.message);
            }
            console.log("add new batch data")
          })
        }else{ // add new to db
          var batches = [thisUser.batchSummaryReport]
          var voteStats = "[]"
          if (thisUser.batchType == "vote")
            voteStats = JSON.stringify(thisUser.eventEngine.voteCampaignArr)
          //var values = [thisUser.extensionId, thisUser.accountId, JSON.stringify(batches), voteStats]
          //var query = "INSERT INTO a2p_sms_users VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING"
          var query = "INSERT INTO a2p_sms_users (user_id, account_id, batches, votes, contacts, subscription_id, webhooks, access_tokens)"
          query += " VALUES ($1,$2,$3,$4,$5,$6,$7,$8)  ON CONFLICT DO NOTHING"
          var values = [thisUser.extensionId, thisUser.accountId, JSON.stringify(batches), voteStats, "", "", "", ""]
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
    updateVoteDataInDB: function(){
      var query = 'UPDATE a2p_sms_users SET '
      query += "votes='" + JSON.stringify(this.eventEngine.voteCampaignArr) + "' WHERE user_id='" + this.extensionId + "'"
      pgdb.update(query, (err, result) =>  {
        if (err){
          console.error(err.message);
        }
        console.log("updated batch data")
      })
    },
    */
    updateActiveUserSubscription: function() {
      console.log("updateActiveUserSubscription")
      var query = "INSERT INTO a2p_sms_users (user_id, account_id, batches, votes, contacts, subscription_id, webhooks, access_tokens)"
      query += " VALUES ($1,$2,$3,$4,$5,$6,$7,$8)"
      //var tokenStr = this.rc_platform.getTokens()
      var values = [this.extensionId, this.accountId, "", "", "", this.subscriptionId, "", ""]

      //var query = "INSERT INTO a2p_sms_active_users (user_id, subscription_id, connector_url, user_key, access_tokens)"
      //query += " VALUES ($1,$2,$3,$4,$5)"
      //var values = [this.extensionId, this.subscriptionId,"","",""]
      query += ` ON CONFLICT (user_id) DO UPDATE SET account_id='${this.accountId}', subscription_id='${this.subscriptionId}'`

      pgdb.insert(query, values, (err, result) =>  {
        if (err){
          console.error(err.message);
          console.log("QUERY: " + query)
        }else{
          console.log("updateActiveUserSubscription DONE");
        }
      })
    },
    /*
    updateActiveUserTokensTable: async function() {
      console.log("updateActiveUserTokens")
      var query = "INSERT INTO a2p_sms_active_users (user_id, subscription_id, connector_url, user_key, access_tokens)"
      query += " VALUES ($1,$2,$3,$4,$5)"
      var tokenStr = await this.rc_platform.getTokens()
      console.log(tokenStr)
      var values = [this.extensionId, this.subscriptionId, tokenStr]
      query += " ON CONFLICT (user_id) DO UPDATE SET access_tokens='" + tokenStr + "'"

      pgdb.insert(query, values, (err, result) =>  {
        if (err){
          console.error(err.message);
          console.log("QUERY: " + query)
        }else{
          console.log("updateActiveUserTokens DONE");
        }
      })
    }
    */
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
  //let re = new RegExp('/\{([^}]+)\}/g');
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
  message += "\nUser account Id: " + accountId
  message += "\nUser contact email: " + userEmail
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

function makeId() {
  var text = "";
  var possible = "-~ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 1; i < 65; i++){
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function sortBatchCreatedDate(a,b) {
  //var aTime = new Date(a.creationTime).getTime()
  //var bTime = new Date(b.creationTime).getTime()
  return b.creationTime - a.creationTime;
  //return bTime - aTime;
}
