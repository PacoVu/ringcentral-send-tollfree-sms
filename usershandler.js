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
  this.rc_platform = new RCPlatform(id)
  //this.sendVote = false
  this.phoneHVNumbers = []
  this.phoneTFNumbers = []

  // High Volume SMS Report
  this.batchSummaryReport = {
    //pending: true,
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

  // High Volume SMS Result
  this.batchResult = {
    id:"",
    batchSize: 0,
    processedCount: 0,
    rejectedCount: 0,
    rejectedNumbers: [],
    status:"Completed",
    batchType: "group"
  }

  this.downloadLink = ""
  this.batchFullReport = []
  this.processingBatches = []
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
      this.updateNotification(false, (err, result) => {
        console.log("Stop getting outbound notification")
      })
      var enableHVSMS = (this.phoneHVNumbers.length) ? false : true
      res.render('standard-sms', {
        userName: this.getUserName(),
        phoneNumbers: this.phoneTFNumbers,
        sendReport: this.sendReport,
        enableHighVolumeSMS: enableHVSMS
      })
    },
    loadSettingsPage: function(res, pageToken){
      var lowVolume = false
      if (this.phoneTFNumbers.length)
        lowVolume = true
      res.render('settings', {
        userName: this.getUserName(),
        lowVolume: lowVolume,
        phoneNumbers: this.phoneHVNumbers
      })
    },
    getContacts: function(res, pageToken){
      this.readContactsFromDataInDB((err, contacts) => {
        res.send({
          status: "ok",
          contactList: contacts
        })
      })
    },
    readTemplates: function(res, pageToken){
      this.readTemplatesFromDataInDB((err, templates) => {
        res.send({
          status: "ok",
          templateList: templates
        })
      })
    },
    loadMessageStorePage: function(res){
      if (this.eventEngine)
        this.eventEngine.logNewMessage = true
      this.updateNotification(true, (err, result) => {
        console.log("Start getting outbound/inbound notification")
      })
      var lowVolume = false
      if (this.phoneTFNumbers.length)
        lowVolume = true
      res.render('conversations', {
        userName: this.getUserName(),
        phoneNumbers: this.phoneHVNumbers,
        lowVolume: lowVolume
      })
    },
    loadCampaignHistoryPage: function(res){
      this.updateNotification(false, (err, result) => {
        console.log("Stop getting outbound notification")
      })
      var lowVolume = false
      if (this.phoneTFNumbers.length)
        lowVolume = true
      res.render('campaign', {
        userName: this.getUserName(),
        lowVolume: lowVolume
      })
    },
    loadHVSMSPage: function(res){
      this.eventEngine.logNewMessage = false
      this.updateNotification(false, (err, result) => {
        console.log("Stop getting outbound notification")
      })
      var lowVolume = false
      if (this.phoneTFNumbers.length)
        lowVolume = true

      res.render('highvolume-sms', {
        userName: this.getUserName(),
        phoneNumbers: this.phoneHVNumbers,
        //smsBatchIds: this.smsBatchIds,
        //batchResult: this.batchResult,
        lowVolume: lowVolume
      })
    },
    login: async function(req, res, callback){
      if (req.query.code) {
        //var rc_platform = this.rc_platform
        var thisUser = this
        var extensionId = await this.rc_platform.login(req.query.code)
        if (extensionId){
          this.extensionId = extensionId
          req.session.extensionId = extensionId;

          //thisUser.deleteAllRegisteredWebHookSubscriptions()

          var p = await this.rc_platform.getPlatform(this.extensionId)
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
            callback(null, extensionId)
            res.send('login success');
            // only customers with A2P SMS would be able to subscribe for notification
            if (this.phoneHVNumbers.length){
              this.eventEngine = router.getActiveUsers().find(o => o.extensionId.toString() === this.extensionId.toString())
              if (this.eventEngine){
                this.eventEngine.setPlatform(this.rc_platform)
                this.subscriptionId = this.eventEngine.subscriptionId
                if (this.subscriptionId == ""){
                  console.log(`user ${this.extensionId} has no subscription => create a new one`)
                  this.subscribeForNotification((err, subscriptionId) => {
                    if (!err){
                      thisUser.eventEngine.subscriptionId = subscriptionId
                    }
                    console.log("new subscriptionId: " + subscriptionId)
                  })
                }else{
                  console.log(`user ${this.extensionId} has existing subscription => check to renew it`)
                  this.renewNotification((err, subscriptionId) => {
                    if (!err){
                      console.log("SUB ID: " + subscriptionId)
                      thisUser.eventEngine.subscriptionId = subscriptionId
                      thisUser.subscriptionId = subscriptionId
                    }
                  })
                }
              }else{ // should subscribe for notification and create eventEngine by default
                console.log(`user ${this.extensionId} was not in the active user list => create a object`)
                this.subscribeForNotification((err, subscriptionId) => {
                  thisUser.eventEngine = new ActiveUser(thisUser.extensionId, subscriptionId)
                  // must push to router's activeUser list in order to receive routed subscription
                  router.getActiveUsers().push(thisUser.eventEngine)
                  thisUser.eventEngine.setup(thisUser.rc_platform, (err, result) => {
                    if (err == null){
                      console.log("eventEngine is set")
                    }
                  })
                })
              }
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
    readA2PSMSPhoneNumber: async function(req, res){
      // decide what page to load
      if (this.phoneHVNumbers.length > 0 && this.subscriptionId != ""){
        console.log("temp solution")
        this.updateNotification(false, (err, result) => {
          console.log("Stop getting outbound notification")
        })
      }

      if (this.phoneHVNumbers.length > 0 && this.phoneTFNumbers.length > 0){
        // launch option page
        res.render('highvolume-sms', {
          userName: this.getUserName(),
          phoneNumbers: this.phoneHVNumbers,
          //smsBatchIds: this.smsBatchIds,
          //batchResult: this.batchResult,
          lowVolume: true
        })
      }else if (this.phoneHVNumbers.length > 0){
        // launch high volume page
        res.render('highvolume-sms', {
          userName: this.userName,
          phoneNumbers: this.phoneHVNumbers,
          //smsBatchIds: this.smsBatchIds,
          //batchResult: this.batchResult
        })
      }else if (this.phoneTFNumbers.length > 0){
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
        //console.log(this.phoneTFNumbers)
      } catch (e) {
        console.log("Cannot read phone numbers!!!")
        console.error(e.message);
      }
    },
    setWebhookAddress: function (req, res){
      if (req.body.address.indexOf("https://") < 0 && req.body.address.indexOf("http://") < 0){
        return res.send({
          status: "error",
          message: "Invalid webhook address!"
        })
      }
      var query = 'UPDATE a2p_sms_users SET '
      var data = {
        url: req.body.address,
        headerName: req.body.header_name,
        headerValue: req.body.header_value
      }
      this.eventEngine.webhooks = data
      query += `webhooks='${JSON.stringify(data)}' WHERE user_id='${this.extensionId}'`
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
    saveTemplate: function (req, res){
      this.readTemplatesFromDataInDB((err, templates) => {
        if (err){
          res.send({
            status: "error",
            message: "Cannot save template. Please try again."
          })
          return
        }
        var data = {
          type: req.body.type,
          name: req.body.name,
          message: escape(req.body.message),
          requestResponse: req.body.requestResponse
        }
        var replace = false
        for (var i=0; i<templates.length; i++){
          var template = templates[i]
          if (template.name == req.body.name){
            replace = true
            templates[i] = data
            break
          }
        }
        if (!replace){
          templates.push(data)
        }
        var templatesStr = JSON.stringify(templates)
        templatesStr = templatesStr.replace(/'/g, "''")
        var query = `UPDATE a2p_sms_users SET templates='${templatesStr}' WHERE user_id='${this.extensionId}'`
        pgdb.update(query, (err, result) =>  {
          if (err){
            console.error(err.message);
          }
          res.send({
            status: "ok",
            message: ""
          })
        })
      })
    },
    deleteTemplate: function (req, res){
      var thisUser = this
      this.readTemplatesFromDataInDB((err, templates) => {
        if (err){
          res.send({
            status: "error",
            message: "Cannot delete template. Please try again."
          })
        }
        for (var i=0; i<templates.length; i++){
          var item = templates[i]
          if (item.type == req.body.type && item.name == req.body.name) {
            templates.splice(i, 1)
            var templatesStr = JSON.stringify(templates)
            templatesStr = templatesStr.replace(/'/g, "''")
            var query = `UPDATE a2p_sms_users SET templates='${templatesStr}' WHERE user_id='${this.extensionId}'`
            pgdb.update(query, (err, result) =>  {
              if (err){
                console.error(err.message);
              }
            })
            break
          }
        }
        res.send({
          status: "ok",
          message: ""
        })
      })
    },
    readTemplatesFromDataInDB: function(callback){
      var query = `SELECT templates FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
          return callback(err.message, null)
        }
        if (!err && result.rows.length > 0){
          var templates = []
          if (result.rows[0].templates.length)
            templates = JSON.parse(result.rows[0].templates)
          callback(null, templates)
        }else{ // no history
          callback(null, [])
        }
      })
    },
    deleteWebhookAddress: function (res){
      var query = 'UPDATE a2p_sms_users SET '
      query += `webhooks='' WHERE user_id='${this.extensionId}'`
      console.log(query)
      var thisUser = this
      pgdb.update(query, (err, result) =>  {
        if (err){
          console.error(err.message);
        }
        thisUser.eventEngine.webhooks = undefined
        res.send({
          status: "ok",
          message: "deleted"
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
            var contactFirstName = ""
            var contactLastName = ""
            if (body.fname_column)
              contactFirstName = columns[csvColumnIndex[body.fname_column]]
            if (body.lname_column)
              contactLastName = columns[csvColumnIndex[body.lname_column]]
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
        this.updateContactsDataInDB(body.group_name, contactList, (err, newContactList) => {
          if (!err)
            res.send({
              status: "ok",
              contactList: newContactList
            })
          else
          res.send({
            status: "failed",
            message: "Cannot update contacts"
          })
        })
      }
    },
    deleteContacts: function (req, res){
      var body = req.body
      this.readContactsFromDataInDB((err, savedContacts) => {
        var index = savedContacts.findIndex(o => o.groupName === body.groupName)
        var savedGroup = savedContacts[index]
        if (body.removeGroup == 'true'){
          savedContacts.splice(index, 1)
          savedGroup.contacts = []
        }else{
          if (savedGroup){
            var deleteContactList = JSON.parse(body.phoneNumber)
            for (var phoneNumber of deleteContactList){
              var contactIndex = savedGroup.contacts.findIndex(o => o.phoneNumber === phoneNumber)
              if (contactIndex >= 0){
                savedGroup.contacts.splice(contactIndex, 1)
              }
            }
          }
        }
        var query = 'UPDATE a2p_sms_users SET '
        query += "contacts='" + JSON.stringify(savedContacts) + "' WHERE user_id='" + this.extensionId + "'"
        pgdb.update(query, (err, result) =>  {
          if (err){
            console.error(err.message);
          }
        })
        res.send({
          status: "ok",
          contactList: savedGroup
        })
      })
    },
    readContactsFromDataInDB: function(callback){
      var query = `SELECT contacts FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
        }
        if (!err && result.rows.length > 0){
          var contacts = []
          if (result.rows[0].contacts.length)
            contacts = JSON.parse(result.rows[0].contacts)
          callback(null, contacts)
        }else{ // no history
          callback(null, [])
        }
      })
    },
    updateContactsDataInDB: function(groupName, contactList, callback){
      this.readContactsFromDataInDB((err, savedContacts) => {
        if (!err){
          var newContactList = []
          var updateContactList = undefined
          var savedGroup = savedContacts.find(o => o.groupName === groupName)
          if (savedGroup){
            for (var contact of contactList){
              var c = savedGroup.contacts.find(o => o.phoneNumber === contact.phoneNumber)
              if (!c)
                newContactList.push(contact)
            }
            updateContactList = savedGroup.contacts.concat(newContactList)
            savedGroup.contacts = updateContactList
          }else{
            savedGroup = {
              groupName: groupName,
              contacts: contactList
            }
            savedContacts.push(savedGroup)
          }
          var query = 'UPDATE a2p_sms_users SET '
          query += "contacts='" + JSON.stringify(savedContacts) + "' WHERE user_id='" + this.extensionId + "'"
          pgdb.update(query, (err, result) =>  {
            if (err){
              console.error(err.message);
              callback(err, "updated contacts failed")
            }
            callback(null, savedGroup)
          })
        }else {
          callback(err.message, "failed updating contacts")
        }
      })
    },
    sendIndividualMessage: async function(req, res){
      var body = req.body
      var requestBody = {
          from: body.from,
          text: body.message,
          messages: [{to:[body.to]}]
      }
      //console.log(JSON.stringify(requestBody))
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        var endpoint = "/restapi/v1.0/account/~/a2p-sms/batch"
        try {
          var resp = await p.post(endpoint, requestBody)
          var jsonObj = await resp.json()
          res.send({
              status:"ok",
              message: body.message
          })
        } catch (e) {
          console.log("Endpoint POST: " + endpoint)
          console.log(e.response.headers)
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
      var command = ""
      if (body.command_1 != null && body.command_1 != ""){
        command = body.command_1.trim()
        voteInfo.voteCommands.push(command)
        voteInfo.voteResults[command] = 0
      }
      if (body.command_2 != null && body.command_2 != ""){
        command = body.command_2.trim()
        voteInfo.voteCommands.push(command)
        voteInfo.voteResults[command] = 0
      }
      if (body.command_3 != null && body.command_3 != ""){
        command = body.command_3.trim()
        voteInfo.voteCommands.push(command)
        voteInfo.voteResults[command] = 0
      }

      // auto reply
      if (body.reply_1_message != null && body.reply_1_message != ""){
        command = body.command_1.trim()
        voteInfo.autoReplyMessages[command] = body.reply_1_message
        voteInfo.autoReply = true
      }
      if (body.reply_2_message  != null && body.reply_2_message != ""){
        command = body.command_2.trim()
        voteInfo.autoReplyMessages[command] = body.reply_2_message
          voteInfo.autoReply = true
      }
      if (body.reply_3_message != null && body.reply_3_message != ""){
        command = body.command_3.trim()
        voteInfo.autoReplyMessages[command] = body.reply_3_message
        voteInfo.autoReply = true
      }
      console.log(voteInfo)
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
      sampleMessage = (sampleMessage.length > 50) ? (sampleMessage.substring(0, 50) + "...") : sampleMessage
      voteInfo.message = sampleMessage
      this.batchSummaryReport = {
        //pending: true,
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
        rejectedCount: 0,
        totalCost: 0.0
      }
      //this.eventEngine.setPlatform(this.rc_platform)
      this.sendBatchMessage(res, requestBody, voteInfo)
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
      sampleMessage = (sampleMessage.length > 50) ? (sampleMessage.substring(0, 50) + "...") : sampleMessage
      this.batchSummaryReport = {
        //pending: true,
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
        rejectedCount: 0,
        totalCost: 0.0
      }

      //console.log(JSON.stringify(requestBody))
      //console.log(this.batchSummaryReport)
      this.sendBatchMessage(res, requestBody, null)
    },
    sendBatchMessage: async function(res, requestBody, voteInfo){
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        var endpoint = "/restapi/v1.0/account/~/a2p-sms/batch"
        try {
          var resp = await p.post(endpoint, requestBody)
          var jsonObj = await resp.json()

          var batchResult = {
            id: jsonObj.id,
            batchSize: jsonObj.batchSize,
            processedCount: jsonObj.processedCount,
            rejectedCount: jsonObj.rejected.length,
            rejectedNumbers: jsonObj.rejected,
            status: jsonObj.status,
            batchType: this.batchSummaryReport.type
          }
          console.log("Ext id: " + this.extensionId)
          console.log(batchResult)

          if (jsonObj.rejected.length){
            this.batchSummaryReport.rejectedCount = jsonObj.rejected.length
            this.batchSummaryReport.totalCount -= jsonObj.rejected.length
            if (voteInfo)
              voteInfo.voteCounts.Total -= jsonObj.rejected.length
            // add rejected numbers to a temp db
            this.addRejectedNumberToDB(jsonObj.rejected, jsonObj.id)
          }

          this.batchSummaryReport.batchId = jsonObj.id

          if (voteInfo){
            voteInfo.batchId = jsonObj.id
            this.eventEngine.setVoteInfo(voteInfo)
          }
          this.addBatchDataToDB((err, result) => {
            res.send({
                status:"ok",
                result: batchResult
            })
          })
        } catch (e) {
          console.log("Endpoint POST: " + endpoint)
          console.log(e.response.headers)
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
    processBatchEventNotication: function(eventObj){
      console.log("Batch completed")
      // find the batch
      this.readBatchReportFromDB(eventObj.body.id, (err, batch) => {
        if (batch){
          console.log("found batch")
          if (eventObj.body.status == "Completed")
            this._postBatchReport(batch, 1, "")
          // check status to deal with the future when deletion is supported
        }
      })
    },
    _postBatchReport: async function(batch, page, pageToken){
      console.log("_postBatchReport")
      var endpoint = "/restapi/v1.0/account/~/a2p-sms/messages"
      var params = {
        batchId: batch.batchId
      }
      if (pageToken != "")
        params['pageToken'] = pageToken

      var vote = undefined
      if (batch.type == "vote")
       vote = this.eventEngine.getCampaignByBatchId(batch.batchId)

      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try {
          var resp = await p.get(endpoint, params)
          var jsonObj = await resp.json()
          for (var message of jsonObj.records){
            switch (message.messageStatus) {
              case "Queued":
                batch.queuedCount++
                break;
              case "Delivered":
                batch.deliveredCount++
                if (vote){
                  var voter = vote.voterList.find(o => o.phoneNumber == message.to[0])
                  if (voter && voter.isSent == false){
                    vote.voteCounts.Delivered++
                    voter.id = message.id
                    voter.isSent = true
                  }
                }
                break
              case "Sent":
                batch.sentCount++
                if (vote){
                  var voter = vote.voterList.find(o => o.phoneNumber == message.to[0])
                  if (voter && voter.isSent == false){
                    vote.voteCounts.Delivered++
                    voter.id = message.id
                    voter.isSent = true
                  }
                }
                break;
              case "DeliveryFailed":
              case "SendingFailed":
                batch.unreachableCount++
                if (vote)
                  vote.voteCounts.Unreachable++
                break;
              default:
                break
            }
            var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
            batch.totalCost += cost
          }
          var postData = {
            dataType: "Campaign_Details",
            campaignName: batch.campaignName,
            pageNumber: page,
            records: jsonObj.records
          }
          //console.log(postData)
          this.eventEngine.postResults(postData)

          var thisUser = this
          if (jsonObj.paging.hasOwnProperty("nextPageToken")){
            console.log("has nextPageToken, get it after 1.2 secs")
            page++
            setTimeout(function(){
              thisUser._postBatchReport(batch, page, jsonObj.paging.nextPageToken)
            }, 1200)
          }else{
            if (vote)
              this.eventEngine.setCampainByBatchId(batch.batchId, vote)
            // update local db
            this._updateCampaignDB(batch, (err, result) => {
              console.log("Call post result only once when batch result is completed. Post only if webhook uri is provided.")
              var postData = {
                dataType: "Campaign_Summary",
                report: result
              }
              //console.log(postData)
              // post batch data to webhook address
              thisUser.eventEngine.postResults(postData)
            })
          }
        } catch (e) {
          console.log('Endpoint: GET ' + endpoint)
          console.log('Params: ' + JSON.stringify(params))
          console.log(e.response.headers)
          console.log('ERR ' + e.message);
        }
      }else{
        console.log("platform issue")
      }
    },
    readCampaignSummary: function(res, batchId){
      //console.log("readCampaignSummary - sendCount > 0")
      var batchReport = {
        batchId: batchId,
        queuedCount: 0,
        deliveredCount: 0,
        sentCount: 0,
        unreachableCount: 0,
        totalCost: 0.0
      }
      this._readCampaignSummary(res, batchId, batchReport, "")

      //this._readCampaignSummary_v2(batchId)
    },
    _readCampaignSummary_v2: async function(batchId){
      console.log("_readCampaignSummary_v2")
      var endpoint = `/restapi/v1.0/account/~/a2p-sms/statuses`
      var params = {
        batchId: batchId
      }
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try {
          var resp = await p.get(endpoint, params)
          var jsonObj = await resp.json()
          console.log(jsonObj)
        } catch (e) {
          console.log('Endpoint: GET ' + endpoint)
          console.log('ERR ' + e.message);
        }
      }else{
        console.log("platform issue")
      }
    },
    _readCampaignSummary: async function(res, batchId, batchReport, pageToken){
      console.log("_readCampaignSummary")
      var endpoint = "/restapi/v1.0/account/~/a2p-sms/messages"
      var params = {
        batchId: batchId
      }
      if (pageToken != "")
        params['pageToken'] = pageToken

      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try {
          var resp = await p.get(endpoint, params)
          var jsonObj = await resp.json()
          for (var message of jsonObj.records){
            switch (message.messageStatus) {
              case "Queued":
                batchReport.queuedCount++
                break;
              case "Delivered":
                batchReport.deliveredCount++
                break
              case "Sent":
                batchReport.sentCount++
                break;
              case "DeliveryFailed":
              case "SendingFailed":
                batchReport.unreachableCount++
                break;
              default:
                break
            }
            var cost = (message.hasOwnProperty('cost')) ? parseFloat(message.cost) : 0.0
            batchReport.totalCost += cost
          }
          //console.log(batchReport.totalCost)
          var thisUser = this
          if (jsonObj.paging.hasOwnProperty("nextPageToken")){
            console.log("has nextPageToken")
            setTimeout(function(){
              thisUser._readCampaignSummary(res, batchId, batchReport, jsonObj.paging.nextPageToken)
            }, 1200)
          }else{
            // don't update db. Taken care by notification path
            /*
            this._updateCampaignDB(batchReport, (err, result) => {
              console.log("DONE READ BATCH REPORT")
            })
            */
            res.send({
              status: "ok",
              batchReport: batchReport
            })
          }
        } catch (e) {
          console.log('Endpoint: GET ' + endpoint)
          console.log('Params: ' + JSON.stringify(params))
          console.log(e.response.headers)
          console.log('ERR ' + e.message);
          res.send({
            status: "failed",
            message: e.message
          })
        }
      }else{
        console.log("platform issue")
        res.send({
          status: "error",
          message: "Platform error."
        })
      }
    },
    readCampaignDetails: async function(res, batchId, pageToken){
      // Read single page only
      var endpoint = "/restapi/v1.0/account/~/a2p-sms/messages"
      var params = {
        batchId: batchId,
        perPage: 1000
      }
      if (pageToken != "")
        params['pageToken'] = pageToken

      console.log('Params: ' + JSON.stringify(params))
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try {
          var resp = await p.get(endpoint, params)
          var jsonObj = await resp.json()
          var nextPage = ""
          var prevPage = ""
          if (jsonObj.paging.hasOwnProperty("nextPageToken")){
            console.log("next page")
            nextPage = jsonObj.paging.nextPageToken
          }
          if (jsonObj.paging.hasOwnProperty("previousPageToken")){
            console.log("prev page")
            prevPage = jsonObj.paging.previousPageToken
          }
          res.send({
            status: "ok",
            nextPage: nextPage,
            prevPage: prevPage,
            fullReport: jsonObj.records
          })
        } catch (e) {
          console.log('Endpoint: GET ' + endpoint)
          console.log('Params: ' + JSON.stringify(params))
          console.log(e.response.headers)
          console.log('ERR ' + e.message);
          res.send({
            status: "error",
            message: e.message
          })
        }
      }else{
        res.send({
          status: "failed",
          message: "Platform error."
        })
      }
    },
    pollNewMessages: function(res){
      if (this.eventEngine){
        res.send({
          status: "ok",
          newMessages: this.eventEngine.newMessageArr
        })
        this.eventEngine.newMessageArr = []
      }else{
        res.send({
          status: "ok",
          newMessages: []
        })
      }
    },
    readOptedOutNumber: async function (req, res){
      var params = {
        from: req.query.fromNumber,
        perPage: 1000
      }
      var endpoint = '/restapi/v1.0/account/~/a2p-sms/opt-outs'
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try {
          var resp = await p.get(endpoint, params)
          var jsonObj = await resp.json()
          var optedOutNumbers = []
          for (var record of jsonObj.records){
            optedOutNumbers.push(record.to)
          }
          res.send({
              status: "ok",
              result: optedOutNumbers,
          })
        } catch (e) {
          console.log('Endpoint: GET ' + endpoint)
          console.log('Params: ' + JSON.stringify(params))
          console.log(e.response.headers)
          console.log('ERR ' + e.message);
          res.send({
              status: "error",
              message: e.message
            })
        }
      }else{
        res.send({
          status: "failed",
          message: "Platform error."
        })
      }
    },
    readMessageList: function (req, res){
      console.log("readMessageList")
      this.batchFullReport = []
      // reset incoming messages via webhook
      if (this.eventEngine)
        this.eventEngine.newMessageArr = []
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
      var endpoint = "/restapi/v1.0/account/~/a2p-sms/messages"
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try {
          var resp = await p.get(endpoint, readParams)
          var jsonObj = await resp.json()
          this.batchFullReport = this.batchFullReport.concat(jsonObj.records)
          if (jsonObj.paging.hasOwnProperty("nextPageToken")){
            // limits to 4000 messages
            if (this.batchFullReport.length >= 4000){
              // return messages list with nextPageToken
              res.send({
                  status: "ok",
                  result: this.batchFullReport,
                  pageTokens: {
                    nextPage: jsonObj.paging.nextPageToken,
                    //previousPage: jsonObj.paging.previousPageToken
                  }
              })
              return
            }else{ // continue reading next page
              var thisUser = this
              setTimeout(function(){
                readParams['pageToken'] = jsonObj.paging.nextPageToken
                thisUser._readMessageList(res, readParams)
              }, 1200)
            }
          }else{
            res.send({
                status: "ok",
                result: this.batchFullReport,
                pageTokens: {
                  nextPage: undefined,//jsonObj.paging.nextPageToken,
                  //previousPage: undefined//jsonObj.paging.previousPageToken
                }
            })
            // reset: ?? don't reset, user may want to download it
            //thisUser.batchFullReport = []
          }
        } catch (e) {
          console.log('Endpoint: GET ' + endpoint)
          console.log('Params: ' + JSON.stringify(readParams))
          console.log(e.response.headers)
          console.log('ERR ' + e.message);
          res.send({
              status: "error",
              message: e.message
            })
        }
      }else{
        res.send({
          status: "failed",
          message: "Platform error."
        })
      }
    },
    downloadHVMessageStore: function(req, res){
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
        res.send({
          status:"ok",
          message:link
        })
      }catch (e){
        console.log("cannot create report file")
        res.send({
          status:"error",
          message:"Cannot create a report file! Please try gain"
        })
      }
    },
    deleteSurveyResult: function(req, res){
      if (this.eventEngine){
        this.eventEngine.deleteCampaignByBatchId(req.query.batchId, (err, result) => {
          if (err)
            res.send({status:"error",message:"Cannot deleted"})
          else
            res.send({status:"ok",message:"deleted"})
        })
      }
    },
    downloadSurveyResult: function(req, res){
      var dir = "reports/"
      if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
      }
      var fullNamePath = './' + dir
      if (this.eventEngine){
        var campaign = this.eventEngine.getCampaignByBatchId(req.query.batchId)
        if (campaign){
          var timeOffset = parseInt(req.query.timeOffset)
          var name = campaign.campaignName.replace(/#/g, "")
          fullNamePath += `${name.replace(/\s/g, "-")}-survey-result.csv`
          let dateOptions = { weekday: 'short' }
          var index = 0
          var appendFile = false
          var fileContent = "Campaign,From,To,Creation Time,Status,Sent Message,Response Option,Response Message,Response Time,Replied,Delivered,Auto-Reply Message"
          try{
            async.forEachLimit(campaign.voterList, 1, function(voter, readNextVoter){
              async.waterfall([
                function readNextVoter(done) {
                  fileContent += `\n${campaign.campaignName}`
                  fileContent += `,${formatPhoneNumber(campaign.serviceNumber)}`
                  fileContent += `,${formatPhoneNumber(voter.phoneNumber)}`
                  var date = new Date(campaign.startDateTime - timeOffset)
                  var dateStr = date.toISOString()
                  fileContent += `,${dateStr}`
                  fileContent += `,${campaign.status}`
                  fileContent += `,"${voter.sentMessage}"`
                  var commands = campaign.voteCommands.join("|")
                  fileContent += `,${commands}`
                  fileContent += `,"${voter.repliedMessage}"`
                  if (voter.repliedTime > 0){
                    date = new Date(voter.repliedTime - timeOffset)
                    dateStr = date.toISOString()
                  }else{
                    dateStr = "--"
                  }
                  fileContent += `,"${dateStr}"`
                  fileContent += `,${voter.isReplied}`
                  fileContent += `,${voter.isSent}`
                  var autoReplyMessage = (campaign.autoReplyMessages[`${voter.repliedMessage}`]) ? campaign.autoReplyMessages[`${voter.repliedMessage}`] : ""
                  fileContent += `,"${autoReplyMessage}"`
                  index++
                  if (index > 500){
                    index = 0
                    if (appendFile == false){
                      appendFile = true
                      fs.writeFile(fullNamePath, fileContent, function (err) {
                        fileContent = ""
                        done()
                      });
                    }else{
                      fs.appendFile(fullNamePath, fileContent, function (err) {
                        fileContent = ""
                        done()
                      });
                    }
                  }else{
                    done()
                  }
                }
              ], function (error, success) {
                readNextVoter()
              });
            }, function(err){
              if (index > 0)
                fs.writeFileSync(fullNamePath, fileContent)
              console.log("Done write file")
              var link = "/downloads?filename=" + fullNamePath
              res.send({
                status:"ok",
                message:link
              })
            });
          }catch (e){
            console.log("cannot create report file")
            res.send({status:"error",message:"Cannot create a report file! Please try again"})
          }
        }else{
          res.send({status:"error",message:"This servey has been deleted."})
        }
      }else{
        res.send({status:"error",message:"Unknown error!"})
      }
    },
    downloadInvalidNumbers: function(req, res){
      var dir = "reports/"
      if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
      }
      var name = decodeURIComponent(req.query.campaign_name).replace(/#/g, "")
      var fullNamePath = dir + name.replace(/\s/g, "-")
      var fileContent = ""
      fullNamePath += '-invalid-numbers.csv'
      fileContent = "Index,Number,Error Code,Description"
      var query = `SELECT rejected_numbers FROM a2p_sms_users_tempdata WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (!err && result.rows.length > 0){
          var batches = JSON.parse(result.rows[0].rejected_numbers)
          var campaign = batches.find(o => o.batchId === req.query.batchId)
          if (campaign){
            for (var item of campaign.rejected){
              fileContent += `\n${item.index},${item.to[0]},${item.errorCode},"${item.description}"`
            }
          }
          try{
            fs.writeFileSync('./'+ fullNamePath, fileContent)
            var link = "/downloads?filename=" + fullNamePath
            res.send({
              status:"ok",
              message:link
            })
          }catch (e){
            console.log("cannot create download file")
            res.send({
              status:"error",
              message:"Cannot create download file! Please try gain"})
          }
        }else{ // no history
          res.send({
            status: "error",
            message: "Not found!",
          })
        }
      })
    },
    _createReportFile: async function(query, pageToken, callback){
      console.log("_createReportFile")
      var endpoint = "/restapi/v1.0/account/~/a2p-sms/messages"
      var params = {
        batchId: query.batchId,
        perPage: 1000
      }
      if (pageToken != "")
        params['pageToken'] = pageToken

      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try {
          var resp = await p.get(endpoint, params)
          var jsonObj = await resp.json()
          var appendFile = (pageToken == "") ? false : true
          var link = this.writeToFile(query, jsonObj.records, appendFile)

          if (jsonObj.paging.hasOwnProperty("nextPageToken")){
            console.log("Read next page")
            var thisUser = this
            setTimeout(function(){
              thisUser._createReportFile(query, jsonObj.paging.nextPageToken, callback)
            }, 1200)
          }else{
            callback(null, link)
          }
        } catch (e) {
          console.log('Endpoint: GET ' + endpoint)
          console.log('Params: ' + JSON.stringify(params))
          console.log(e.response.headers)
          console.log('ERR ' + e.message);
          callback('error', "error")
        }
      }else{
        callback("failed", "failed")
      }
    },
    writeToFile: function(query, records, appendFile){
      var dir = "reports/"
      if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
      }
      var name = decodeURIComponent(query.campaignName).replace(/#/g, "")
      var fullNamePath = dir + name.replace(/\s/g, "-")
      var fileContent = ""
      fullNamePath += '-campaign-report.csv'
      if (appendFile == false)
        fileContent = "Id,From,To,Creation Time,Last Updated Time,Message Status,Error Code,Cost,Segment"
        //fileContent = "Id,From,To,Creation Time (UTC),Last Updated Time (UTC),Message Status,Error Code,Cost,Segment"
      var timeOffset = parseInt(query.timeOffset)
      let dateOptions = { weekday: 'short' }
      for (var item of records){
        var from = formatPhoneNumber(item.from)
        var to = formatPhoneNumber(item.to[0])
        var date = new Date(item.creationTime)
        var timestamp = date.getTime() - timeOffset
        var createdDate = new Date (timestamp)
        var createdDateStr = createdDate.toLocaleDateString("en-US", dateOptions)
        createdDateStr += " " + createdDate.toLocaleDateString("en-US")
        createdDateStr += " " + createdDate.toLocaleTimeString("en-US", {timeZone: 'UTC'})
        date = new Date(item.lastModifiedTime)
        var timestamp = date.getTime() - timeOffset
        var updatedDate = new Date (timestamp)
        var updatedDateStr = createdDate.toLocaleDateString("en-US", dateOptions)
        updatedDateStr += " " + createdDate.toLocaleDateString("en-US")
        updatedDateStr += " " + updatedDate.toLocaleTimeString("en-US", {timeZone: 'UTC'})
        var errorCode = ""
        if (item.hasOwnProperty('errorCode')){
          errorCode = item.errorCode
        }
        var cost = (item.cost) ? item.cost : 0.00
        var segmentCount = (item.segmentCount) ? item.segmentCount : 0
        fileContent += `\n${item.id},${from},${to},${createdDateStr},${updatedDateStr}`
        fileContent +=  `,${item.messageStatus},${errorCode},${cost},${segmentCount}`
      }
      try{
        if (appendFile == false){
          fs.writeFileSync('./'+ fullNamePath, fileContent)
        }else{
          fs.appendFileSync('./'+ fullNamePath, fileContent)
        }
      }catch(e){
          console.log("cannot create report file")
      }
      //downloadLink = "/downloads?filename=" + fullNamePath
      return "/downloads?filename=" + fullNamePath
    },
    downloadBatchReport: function(req, res){
      console.log("downloadBatchReport")
      this._createReportFile(req.query, "", (err, link) => {
        if (!err){
          console.log("file is ready for download")
          res.send({"status":"ok","message": link})
        }else{
          if (err == "error")
            res.send({
              status: "error",
              message: "Failed to read campaign report. Please retry!"
            })
          else
            res.send({
              status: "failed",
              message: "You have been logged out. Please login again."
            })
        }
      })
    },
    deleteCampaignResult: function(req, res){
      var thisUser = this
      var query = `SELECT batches FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (!err && result.rows.length > 0){
          var batches = JSON.parse(result.rows[0].batches)
          var campaignIndex = batches.findIndex(o => o.batchId === req.query.batchId)
          if (campaignIndex >= 0){
            batches.splice(campaignIndex, 1)
          }
          var batchesStr = JSON.stringify(batches)
          batchesStr = batchesStr.replace(/'/g, "''")
          var query = `UPDATE a2p_sms_users SET batches='${batchesStr}' WHERE user_id='${thisUser.extensionId}'`
          pgdb.update(query, (err, result) =>  {
            if (err){
              console.error(err.message);
            }
            console.log("deleted and updated batches data")
            batches.sort(sortBatchCreatedDate)
            res.send({
              status: "ok",
              campaigns: batches,
            })
          })
        }else{ // no history
          res.send({
            status: "ok",
            campaigns: [],
          })
        }
      })
    },
    downloadStandardSMSReport: function(req, res){
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
        callback(null, "logged out")
      }else{
        var p = await this.rc_platform.getPlatform(this.extensionId)
        if (p)
          await p.logout()
        else
          console.log("No platform?")
        // may need to clear tokens and destroy eventEngine etc.
        callback(null, "logged out")
      }
    },
    readBatchReportFromDB: function(batchId, callback){
      var query = `SELECT batches FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (!err && result.rows.length > 0){
          var batch = undefined
          if (result.rows[0].batches.length){
            batches = JSON.parse(result.rows[0].batches)
            batch = batches.find(o => o.batchId === batchId)
          }
          callback(null, batch)
        }else{ // no history
          callback(null, undefined)
        }
      })
    },
    readCampaignsLogFromDB: function(res){
      var thisUser = this
      var voteReports = (this.eventEngine) ? thisUser.eventEngine.getCopyVoteCampaignsInfo() : []
      var query = `SELECT batches FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (!err && result.rows.length > 0){
          var batches = []
          if (result.rows[0].batches.length){
            batches = JSON.parse(result.rows[0].batches)
            batches.sort(sortBatchCreatedDate)
          }
          thisUser.batchSummaryReport = batches[0]
          res.send({
            status: "ok",
            campaigns: batches,
            recentBatch: thisUser.batchSummaryReport,
            voteReports: voteReports //thisUser.eventEngine.getCopyVoteCampaignsInfo()
          })
        }else{ // no history
          res.send({
            status: "ok",
            campaigns: [],
            recentBatch: thisUser.batchSummaryReport,
            voteReports: voteReports //thisUser.eventEngine.getCopyVoteCampaignsInfo()
          })
        }
      })
    },
    readVoteReports: function(res){
      var voteReports = (this.eventEngine) ? this.eventEngine.getCopyVoteCampaignsInfo() : []
      res.send({
          status: "ok",
          voteReports: voteReports //this.eventEngine.getCopyVoteCampaignsInfo()
      })
    },
    // Notifications
    subscribeForNotification: async function(callback){
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        var endpoint = '/restapi/v1.0/subscription'
        var eventFilters = []
        var filter = ""
        for (var item of this.phoneHVNumbers){
          filter = `/restapi/v1.0/account/~/a2p-sms/messages?direction=Inbound&to=${item.number}`
          eventFilters.push(filter)
          filter = `/restapi/v1.0/account/~/a2p-sms/batch?from=${item.number}`
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
          console.log('Endpoint: POST ' + endpoint)
          console.log('EventFilters: ' + JSON.stringify(eventFilters))
          console.log(e.response.headers)
          console.log('ERR ' + e.message);
          callback(e.message, "")
        }
      }else{
        callback("failed", "")
      }
    },
    renewNotification: async function(callback){
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        var endpoint = `/restapi/v1.0/subscription/${this.subscriptionId}`
        try {
          var resp = await p.get(endpoint)
          var jsonObj = await resp.json()
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
          console.log('Endpoint: POST ' + endpoint)
          console.log(e.response.headers)
          console.log('ERR: ' + e.message)
          this.subscribeForNotification((err, res) => {
            callback(err, res)
          })
        }
      }else{
        console.log("err: renewNotification");
        callback("err", "failed")
      }
    },
    updateBatchNotification: async function( batchId, callback){
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        var eventFilters = []
        var filter = ""
        for (var item of this.phoneHVNumbers){
          filter = `/restapi/v1.0/account/~/a2p-sms/messages?direction=Inbound&to=${item.number}`
          eventFilters.push(filter)
          filter = `/restapi/v1.0/account/~/a2p-sms/batch/${batchId}`
          eventFilters.push(filter)
        }

        var endpoint = `/restapi/v1.0/subscription/${this.subscriptionId}`
        try {
          var resp = await p.put(endpoint, {
            eventFilters: eventFilters,
            deliveryMode: {
              transportType: 'WebHook',
              address: process.env.DELIVERY_MODE_ADDRESS
            },
            expiresIn: process.env.WEBHOOK_EXPIRES_IN
          })
          var jsonObj = await resp.json()
          this.subscriptionId = jsonObj.id
          console.log("Subscription updated")
          callback(null, jsonObj.id)
        } catch (e) {
          console.log('Endpoint: PUT ' + endpoint)
          console.log('EventFilters: ' + JSON.stringify(eventFilters))
          console.log(e.response.headers)
          console.log('ERR ' + e.message);
          callback(e.message, "failed")
        }
      }else{
        console.log("err: updateNotification");
        callback("err", "failed")
      }
    },
    updateNotification: async function( outbound, callback){
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        var eventFilters = []
        for (var item of this.phoneHVNumbers){
          var filter = `/restapi/v1.0/account/~/a2p-sms/messages?direction=Inbound&to=${item.number}`
          eventFilters.push(filter)

          if (outbound){
            filter = `/restapi/v1.0/account/~/a2p-sms/messages?direction=Outbound&from=${item.number}`
            eventFilters.push(filter)
          }else{
            filter = `/restapi/v1.0/account/~/a2p-sms/batch?from=${item.number}`
            eventFilters.push(filter)
          }
        }

        var endpoint = `/restapi/v1.0/subscription/${this.subscriptionId}`
        try {
          var resp = await p.put(endpoint, {
            eventFilters: eventFilters,
            deliveryMode: {
              transportType: 'WebHook',
              address: process.env.DELIVERY_MODE_ADDRESS
            },
            expiresIn: process.env.WEBHOOK_EXPIRES_IN
          })
          var jsonObj = await resp.json()
          this.subscriptionId = jsonObj.id
          console.log("Subscription updated")
          console.log(this.subscriptionId)
          callback(null, jsonObj.id)
        } catch (e) {
          console.log('Endpoint: PUT ' + endpoint)
          console.log('EventFilters: ' + JSON.stringify(eventFilters))
          console.log(e.response.headers)
          console.log('ERR ' + e.message);
          callback(e.message, "failed")
        }
      }else{
        console.log("err: updateNotification");
        callback("err", "failed")
      }
    },
    /// Clean up WebHook subscriptions
    deleteAllRegisteredWebHookSubscriptions: async function() {
      console.log("deleteAllRegisteredWebHookSubscriptions")
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try{
          var resp = await p.get('/restapi/v1.0/subscription')
          var jsonObj = await resp.json()
          if (jsonObj.records.length > 0){
            for (var record of jsonObj.records) {
              console.log(JSON.stringify(record))

              if (record.deliveryMode.transportType == "WebHook"){
              //if (record.id != "3e738712-3de9-41ec-bd56-36426d52a98d"){
                var r =  await p.delete(`/restapi/v1.0/subscription/${record.id}`)
                  console.log("Deleted")
              }
            }
            console.log("Deleted all")
          }else{
            console.log("No subscription to delete")
          }
        }catch(e){
          console.log("Cannot delete notification subscription")
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
          this.addTFBatchToDB()
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

            var p = await thisUser.rc_platform.getPlatform(thisUser.extensionId)
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
    getStandardSMSResult: function(req, res){
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
    addBatchDataToDB: function(callback){
      var thisUser = this
      var query = `SELECT batches FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
        }
        if (!err && result.rows.length > 0){
          // attach to array then update db
          var batches = []
          if (result.rows[0].batches.length)
            batches = JSON.parse(result.rows[0].batches)
          batches.push(thisUser.batchSummaryReport)
          var batchesStr = JSON.stringify(batches)
          batchesStr = batchesStr.replace(/'/g, "''")
          var query = `UPDATE a2p_sms_users SET batches='${batchesStr}' WHERE user_id='${thisUser.extensionId}'`
          pgdb.update(query, (err, result) =>  {
            if (err){
              console.error(err.message);
            }
            callback(null, "added new batch data")
            console.log("added new batch data")
          })
        }else{ // add new to db
          var batches = [thisUser.batchSummaryReport]
          var batchesStr = JSON.stringify(batches)
          batchesStr = batchesStr.replace(/'/g, "''")
          var query = "INSERT INTO a2p_sms_users (user_id, account_id, batches, contacts, subscription_id, webhooks, access_tokens, templates)"
          query += " VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING"
          var values = [thisUser.extensionId, thisUser.accountId, batchesStr,"[]","[]","","","","[]"]
          pgdb.insert(query, values, (err, result) =>  {
            if (err){
              console.error(err.message);
            }
            callback(null, "stored batch in to db")
            console.log("stored batch in to db")
          })
        }
      })
    },
    _updateCampaignDB: function(batchReport, callback){
      var thisUser = this
      var query = `SELECT batches FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
          return callback(err.message, "Cannot read batches")
        }
        if (!err && result.rows.length > 0){
          // attach to array then update db
          var batches = []
          if (result.rows[0].batches.length)
            batches = JSON.parse(result.rows[0].batches)
          if (batchReport == null)
            batchReport = thisUser.batchSummaryReport
          var batch = batches.find(o => o.batchId == batchReport.batchId)
          if (batch){
            batch.queuedCount = batchReport.queuedCount
            batch.deliveredCount = batchReport.deliveredCount
            batch.sentCount = batchReport.sentCount
            batch.unreachableCount = batchReport.unreachableCount
            batch.totalCost = batchReport.totalCost
            //batch.live = false
            var query = 'UPDATE a2p_sms_users SET '
            query += `batches='${JSON.stringify(batches)}'`
            query += ` WHERE user_id='${thisUser.extensionId}'`
            var batchesStr = JSON.stringify(batches)
            batchesStr = batchesStr.replace(/'/g, "''")
            var query = `UPDATE a2p_sms_users SET batches='${batchesStr}' WHERE user_id='${thisUser.extensionId}'`
            pgdb.update(query, (err, result) =>  {
              if (err){
                console.error(err.message);
              }
              console.log("updated batch data")
              callback(null, batch)
            })
          }
        }
      })
    },
    addRejectedNumberToDB: function(rejectedData, batchId){
      //a2p_sms_users_tempdata
      var query = `SELECT rejected_numbers FROM a2p_sms_users_tempdata WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
        }
        var rejectNumbers = []
        if (!err && result.rows.length > 0){
          // attach to array then update db
          rejectNumbers = JSON.parse(result.rows[0].rejected_numbers)
          var rejectObj = {
            batchId: batchId,
            rejected: rejectedData
          }
          rejectNumbers.push(rejectObj)
        }else{
          var rejectObj = {
            batchId: batchId,
            rejected: rejectedData
          }
          rejectNumbers.push(rejectObj)
        }
        var query = "INSERT INTO a2p_sms_users_tempdata (user_id, active_survey, rejected_numbers)"
        query += " VALUES ($1,$2,$3)"
        //var tokenStr = this.rc_platform.getTokens()
        var values = [this.extensionId, '[]', JSON.stringify(rejectNumbers)]
        query += ` ON CONFLICT (user_id) DO UPDATE SET rejected_numbers='${JSON.stringify(rejectNumbers)}'`
        pgdb.insert(query, values, (err, result) =>  {
          if (err){
            console.error(err.message);
            console.log("QUERY: " + query)
          }else{
            console.log("addRejectedNumberToDB DONE");
          }
        })
      })
    },
    updateActiveUserSubscription: function() {
      console.log("updateActiveUserSubscription")
      //var query = "INSERT INTO a2p_sms_users (user_id, account_id, batches, votes, contacts, subscription_id, webhooks, access_tokens)"
      //query += " VALUES ($1,$2,$3,$4,$5,$6,$7,$8)"
      //var values = [this.extensionId, this.accountId, "", "", "", this.subscriptionId, "", ""]

      var query = "INSERT INTO a2p_sms_users (user_id, account_id, batches, contacts, subscription_id, webhooks, access_tokens, templates)"
      query += " VALUES ($1,$2,$3,$4,$5,$6,$7,$8)"
      var values = [this.extensionId, this.accountId, "[]", "[]", this.subscriptionId, "", "", "[]"]

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
    addTFBatchToDB: function(){
      var thisUser = this
      var msg = (this.sendMessage.length > 50) ? (this.sendMessage.substring(0, 50) + "...") : this.sendMessage
      var newBatch = {
        //live: false,
        campaignName: "Campaign Name",
        type: "tollfree",
        serviceNumber: this.fromNumber,
        message: msg,
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
          var batches = []
          if (result.rows[0].batches.length)
            batches = JSON.parse(result.rows[0].batches)
          batches.push(newBatch)
          var batchesStr = JSON.stringify(batches)
          batchesStr = batchesStr.replace(/'/g, "''")
          var query = `UPDATE a2p_sms_users SET batches='  ${batchesStr}' WHERE user_id='${thisUser.extensionId}'`
          pgdb.update(query, (err, result) =>  {
            if (err){
              console.error(err.message);
            }
            console.log("updated TF batch data")
          })
        }else{ // add new to db
          var batches = [newBatch]
          var query = "INSERT INTO a2p_sms_users (user_id, account_id, batches, contacts, subscription_id, webhooks, access_tokens, templates)"
          query += " VALUES ($1,$2,$3,$4,$5,$6,$7,$8)  ON CONFLICT DO NOTHING"
          var batchesStr = JSON.stringify(batches)
          batchesStr = batchesStr.replace(/'/g, "''")
          var values = [thisUser.extensionId, thisUser.accountId, batchesStr, "[]", "[]", "", "", "[]"]
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
