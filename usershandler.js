var fs = require('fs')
var async = require("async");
const RCPlatform = require('./platform.js')
const pgdb = require('./db')
var router = require('./router');
const ActiveUser = require('./event-engine.js')
const Analytics = require('./analytics-engine.js')
require('dotenv').load()

const MASK = "#!#"

function User(id) {
  this.id = id;
  this.extensionId = 0;
  this.accountId = 0;
  this.adminUser = false
  this.userEmail = "" // for feedback only
  this.userName = ""
  this.subscriptionId = ""
  this.eventEngine = undefined
  this.rc_platform = new RCPlatform(id)
  this.analytics = new Analytics()
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
  this.analyticsData = {}

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
    loadAnalyticsPage: function(res){
      var lowVolume = false
      if (this.phoneTFNumbers.length)
        lowVolume = true
      res.render('analytics', {
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
              if (jsonObj.permissions.admin.enabled){
                this.adminUser = true
              }
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
      // admin w/o number

      if (this.adminUser){
        if ((this.phoneHVNumbers.length == 0) && (this.phoneTFNumbers.length == 0)){
            // check if this account has any users who has HV SMS numbers and ever used the app
            var query = `SELECT account_id FROM a2p_sms_users WHERE user_id='${this.accountId}'`
            pgdb.read(query, (err, result) => {
              if (!err && result.rows.length > 0){
                console.log(result.rows)
                res.render('analytics', {
                  userName: this.getUserName(),
                  phoneNumbers: this.phoneHVNumbers,
                  lowVolume: false,
                })
              }else{ // no history
                res.render('main', {
                  userName: this.userName,
                  lowVolume: false,
                  highVolume: false
                })
              }
            })
            return
        }
      }

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
        var contactsStr = JSON.stringify(savedContacts)
        contactsStr = contactsStr.replace(/'/g, "''")
        query += `contacts='${contactsStr}' WHERE user_id='${this.extensionId}'`
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
          var contactsStr = JSON.stringify(savedContacts)
          contactsStr = contactsStr.replace(/'/g, "''")
          query += `contacts='${contactsStr}' WHERE user_id='${this.extensionId}'`
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
            //recipient = (recipient[0] == "+") ? recipient : `+${recipient}`
            recipient = this.validateRicipientNumber(recipient)
            var item = {
              to:[recipient]
            }
            requestBody.messages.push(item)

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
          }
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
              var recipient = columns[csvColumnIndex[toNumberColumnName]]
              //toNumber = (toNumber[0] != "+") ? `+${toNumber}` : toNumber
              recipient = this.validateRicipientNumber(recipient)
              if (arr){
                msg = resembleMessage(message, columns, csvColumnIndex)
                if (sampleMessage == "")
                  sampleMessage = msg
                var group = {
                    to: [recipient],
                    text: msg
                }
                requestBody.messages.push(group)
              }else{ // no template => text is common to all recipients
                var item = {
                    to: [recipient]
                }
                requestBody.messages.push(item)
              }

              var voter = {
                id: "",
                phoneNumber: recipient,
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
            recipient = this.validateRicipientNumber(recipient)
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
              var recipient = columns[csvColumnIndex[toNumberColumnName]]
              //toNumber = (toNumber[0] != "+") ? `+${toNumber}` : toNumber
              recipient = this.validateRicipientNumber(recipient)
              if (arr){
                var msg = resembleMessage(message, columns, csvColumnIndex)
                if (sampleMessage == "")
                  sampleMessage = msg
                var group = {
                    to: [recipient],
                    text: msg
                }
                requestBody.messages.push(group)
              }else{ // no template => text is common to all recipients
                var item = {
                    to: [recipient]
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
      this.sendBatchMessage(res, requestBody, null)
    },
    validateRicipientNumber: function(number){
      number = number.replace(/[+()\-\s]/g, '')
      if (!isNaN(number)){
        if (number.length == 10)
          number = `+1${number}`
        else if (number.length == 11)
          number = `+${number}`
      }
      return number
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
          this.processingBatches.push(jsonObj.id)
          this.batchSummaryReport.batchId = jsonObj.id

          if (voteInfo){
            voteInfo.batchId = jsonObj.id
            this.eventEngine.setVoteInfo(voteInfo)
            //this._getVoteReport(jsonObj.id, "")
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
      //console.log(eventObj)
      this.readBatchReportFromDB(eventObj.body.id, (err, batch) => {
        if (batch){
          console.log("found batch")
          if (eventObj.body.status == "Completed"){
            var index = this.processingBatches.findIndex(o => o == eventObj.body.id)
            if (index >= 0)
              this.processingBatches.splice(index, 1)
            this._postBatchReport(batch, 1, "")
          }
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
      //this._readCampaignSummary_v2(res, batchId, batchReport)
    },
    _readCampaignSummary_v2: async function(res, batchId, batchReport){
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
          /*
          {
            queued: { count: 0 },
            delivered: { count: 2 },
            deliveryFailed: { count: 0, errorCodeCounts: {} },
            sent: { count: 0 },
            sendingFailed: { count: 0 }
          }
          */
          batchReport.queuedCount = jsonObj.queued.count
          batchReport.deliveredCount = jsonObj.delivered.count
          batchReport.sentCount = jsonObj.sent.count
          batchReport.unreachableCount = jsonObj.deliveryFailed.count
          batchReport.unreachableCount += jsonObj.sendingFailed.count
          res.send({
            status: "ok",
            batchReport: batchReport
          })
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
    // analytics
    pollAnalyticsResult: function (res){
      res.send({
          status: "ok",
          result: this.analytics.analyticsData
          //failureAnalysis: this.analytics.analyticsData.failureAnalysis
      })
    },
    downloadAnalytics: function(req, res){
      var dir = "reports/"
      if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
      }
      var fullNamePath = `${dir}Statistics-${req.query.fileName}.csv`
      var fileContent = ""
      // Total
      fileContent = `Messaging statistics ${req.query.fileName}`
      fileContent += "\nTotal messages by direction"
      fileContent += `\n,Outbound,${this.analytics.analyticsData.outboundCount}`
      fileContent += `\n,Inbound,${this.analytics.analyticsData.inboundCount}`
      fileContent += `\n,Total,${this.analytics.analyticsData.outboundCount + this.analytics.analyticsData.inboundCount},`

      fileContent += "\nTotal cost by direction (USD)"
      var totalCost = this.analytics.analyticsData.sentMsgCost + this.analytics.analyticsData.receivedMsgCost
      fileContent += `\n,Outbound,${this.analytics.analyticsData.sentMsgCost.toFixed(2)}`
      fileContent += `\n,Inbound,${this.analytics.analyticsData.receivedMsgCost.toFixed(2)}`
      fileContent += `\n,Total,${totalCost.toFixed(2)},`
      // status
      fileContent += "\nTotal messages by status"
      fileContent += `\n,Delivered,${this.analytics.analyticsData.deliveredCount}`
      fileContent += `\n,Sending failed,${this.analytics.analyticsData.sendingFailedCount}`
      fileContent += `\n,Delivery failed,${this.analytics.analyticsData.deliveryFailedCount}`

      // Monthly
      fileContent += "\n\n# Messages by direction (per month)"

      var monthlyData = this.analytics.analyticsData.months

      var months = "\n,Month"
      var inboundMsg = "\n,# Inbound messages"
      var outboundMsg = "\n,# Outbound messages"
      var totalMsg = "\n,# Total messages"
      var responseRate = "\n,Response rate"

      var statusInfoHeader = "\n# Outbound messages by status (per month)"
      var deliveredMsg = "\n,# Delivered messages"
      var failedMsg = "\n,# Failed messages"
      var deliveryRate = "\n,Delivery rate"

      var costInfoHeader = "\nCost by direction (USD per month)"
      var inboundCost = "\n,Cost of inbound messages"
      var outboundCost = "\n,Cost of outbound messages"
      var totalCost = "\n,Total cost"

      var costEfficiencyHeader = "\nOutbound messaging cost efficiency (USD per month)"
      var deliveredCost = "\n,Cost of succeeded outbound messages"
      var failedCost = "\n,Cost of failed outbound messages"
      var efficiencyRate = "\n,Cost efficiency rate"

      for (var i=monthlyData.length-1; i>=0; i--) {
        var m =  monthlyData[i]
        var total = m.inboundCount + m.outboundCount
        var rate = 0.0
        if (m.outboundCount > 0)
          rate = (m.inboundCount / m.outboundCount) * 100
        months += `,${m.month}`
        inboundMsg += `,${m.inboundCount}`
        outboundMsg += `,${m.outboundCount}`
        totalMsg += `,${total}`
        responseRate += `,${rate.toFixed(2)}%`

        // status
        total = m.deliveredCount + m.deliveryFailedCount + m.sendingFailedCount
        if (total > 0)
          rate = (m.deliveredCount / total) * 100
        deliveredMsg += `,${m.deliveredCount}`
        failedMsg += `,${m.deliveryFailedCount + m.sendingFailedCount}`
        deliveryRate += `,${rate.toFixed(2)}%`

        // cost
        var totalOutbountCost = m.deliveredMsgCost + m.failedMsgCost
        total = totalOutbountCost + m.receivedMsgCost
        if (totalOutbountCost > 0.0)
          rate = (m.deliveredMsgCost / totalOutbountCost) * 100
        inboundCost += `,${m.receivedMsgCost.toFixed(2)}`
        outboundCost += `,${totalOutbountCost.toFixed(2)}`
        totalCost += `,${total.toFixed(2)}`

        // cost efficiency
        total = m.deliveredMsgCost + m.failedMsgCost
        if (total > 0.0)
          rate = (m.deliveredMsgCost / total) * 100
        deliveredCost += `,${m.deliveredMsgCost.toFixed(2)}`
        failedCost += `,${m.failedMsgCost.toFixed(2)}`
        efficiencyRate += `,${rate.toFixed(2)}`
      }
      fileContent += `${months}${inboundMsg}${outboundMsg}${totalMsg}${responseRate}`
      fileContent += statusInfoHeader
      fileContent += `${months}${deliveredMsg}${failedMsg}${deliveryRate}`
      fileContent += costInfoHeader
      fileContent += `${months}${inboundCost}${outboundCost}${totalCost}`
      fileContent += costEfficiencyHeader
      fileContent += `${months}${deliveredCost}${failedCost}${efficiencyRate}`

      // per number
      fileContent += "\n\n# Messages by direction (per service number)"

      var serviceNumber = "\n,Service Number"
      inboundMsg = "\n,# Inbound messages"
      outboundMsg = "\n,# Outbound messages"
      totalMsg = "\n,# Total messages"
      responseRate = "\n,Response rate"

      statusInfoHeader = "\n# Outbound messages by status (per service number)"
      deliveredMsg = "\n,# Delivered messages"
      failedMsg = "\n,# Failed messages"
      deliveryRate = "\n,Delivery rate"

      costInfoHeader = "\nCost by direction (USD per service number)"
      inboundCost = "\n,Cost of inbound messages"
      outboundCost = "\n,Cost of outbound messages"
      totalCost = "\n,Total cost"

      costEfficiencyHeader = "\nOutbound messaging cost efficiency (USD per service number)"
      deliveredCost = "\n,Cost of succeeded outbound messages"
      failedCost = "\n,Cost of failed outbound messages"
      efficiencyRate = "\n,Cost efficiency rate"

      var serviceNumberData = this.analytics.analyticsData.phoneNumbers
      for (var i=serviceNumberData.length-1; i>=0; i--) {
        var m =  serviceNumberData[i]

        var total = m.inboundCount + m.outboundCount
        var rate = 0.0
        if (m.outboundCount > 0)
          rate = (m.inboundCount / m.outboundCount) * 100
        serviceNumber += `,${formatPhoneNumber(m.number)}`
        inboundMsg += `,${m.inboundCount}`
        outboundMsg += `,${m.outboundCount}`
        totalMsg += `,${total}`
        responseRate += `,${rate.toFixed(2)}%`

        // status
        total = m.deliveredCount + m.deliveryFailedCount + m.sendingFailedCount
        if (total > 0)
          rate = (m.deliveredCount / total) * 100
        deliveredMsg += `,${m.deliveredCount}`
        failedMsg += `,${m.deliveryFailedCount + m.sendingFailedCount}`
        deliveryRate += `,${rate.toFixed(2)}%`

        // cost
        var totalOutbountCost = m.deliveredMsgCost + m.failedMsgCost
        total = totalOutbountCost + m.receivedMsgCost
        if (totalOutbountCost > 0.0)
          rate = (m.deliveredMsgCost / totalOutbountCost) * 100
        inboundCost += `,${m.receivedMsgCost.toFixed(2)}`
        outboundCost += `,${totalOutbountCost.toFixed(2)}`
        totalCost += `,${total.toFixed(2)}`

        // cost efficiency
        total = m.deliveredMsgCost + m.failedMsgCost
        if (total > 0.0)
          rate = (m.deliveredMsgCost / total) * 100
        deliveredCost += `,${m.deliveredMsgCost.toFixed(2)}`
        failedCost += `,${m.failedMsgCost.toFixed(2)}`
        efficiencyRate += `,${rate.toFixed(2)}`
      }

      fileContent += `${serviceNumber}${inboundMsg}${outboundMsg}${totalMsg}${responseRate}`
      fileContent += statusInfoHeader
      fileContent += `${serviceNumber}${deliveredMsg}${failedMsg}${deliveryRate}`
      fileContent += costInfoHeader
      fileContent += `${serviceNumber}${inboundCost}${outboundCost}${totalCost}`
      fileContent += costEfficiencyHeader
      fileContent += `${serviceNumber}${deliveredCost}${failedCost}${efficiencyRate}`

      try{
        fs.writeFileSync('./'+ fullNamePath, fileContent)
        var link = "/downloads?filename=" + fullNamePath
        res.send({
          status:"ok",
          message:link
        })
        // delete in 20 secs
        var deleteFile = `./${fullNamePath}`
        setTimeout(function(){
          fs.unlinkSync(deleteFile)
        }, 20000, deleteFile)
      }catch (e){
        console.log("cannot create report file")
        res.send({
          status:"error",
          message:"Cannot create a report file! Please try gain"
        })
      }
    },
    getMessagingAnalytics: function (req, res){
      console.log("getMessagingAnalytics")
      /*
      if (this.analytics.analyticsData != undefined){
        res.send({
            status: "ok",
            result: this.analytics.analyticsData
        })
        return
      }
      */
      var timeOffset = 0 //parseInt(req.body.timeOffset)
      var ts = new Date(req.body.dateFrom).getTime()
      var dateFrom = new Date(ts - timeOffset).toISOString()
      ts = new Date(req.body.dateTo).getTime()
      var dateTo = new Date(ts - timeOffset).toISOString()
      var readParams = {
        view: "Detailed",
        dateFrom: dateFrom,
        dateTo: dateTo,
        perPage: 1000
      }
      var phoneNumbers = JSON.parse(req.body.phoneNumbers)
      if (phoneNumbers[0] != "all")
        readParams['phoneNumber'] = phoneNumbers

      if (req.body.pageToken)
          readParams['pageToken'] = req.body.pageToken

      this.analytics.resetAnalyticsData()
      res.send({
          status: "ok",
          result: this.analytics.analyticsData
      })
      this._readMessageStoreForAnalytics(readParams, timeOffset)
      //this._readTestMessageStore(timeOffset)

    },
    _readMessageStoreForAnalytics: async function(readParams, timeOffset){
      console.log("_readMessageStoreForAnalytics")
      var endpoint = "/restapi/v1.0/account/~/a2p-sms/messages"
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try {
          var resp = await p.get(endpoint, readParams)
          var jsonObj = await resp.json()
          for (var message of jsonObj.records){
            this.analytics.analyzeMessage(message)
          }
          //this.analyticsData.roundTheClock.sort(sortRoundTheClock)
          //this.analyticsData.segmentCounts.sort(sortSegmentCount)
          this.analytics.analyticsData.phoneNumbers.sort(sortbByNumber)
          if (jsonObj.paging.hasOwnProperty("nextPageToken")){
            this.analytics.analyticsData.task = "Processing"
            var thisUser = this
            setTimeout(function(){
                readParams['pageToken'] = jsonObj.paging.nextPageToken
                thisUser._readMessageStoreForAnalytics(readParams, timeOffset)
            }, 1200)
          }else{
            // clean up
            //console.log(this.analytics.analyticsData.failureAnalysis.contents.length)
            var check = true
            while (check){
              var index = this.analytics.analyticsData.failureAnalysis.contents.findIndex(o => o.ignore == true)
              if (index >= 0){
                this.analytics.analyticsData.failureAnalysis.contents.splice(index, 1)
                //console.log("REMOVED")
              }else{
                check = false
              }
            }
            /*
            console.log("AFTER CLEAN UP")
            console.log(this.analytics.analyticsData.failureAnalysis.contents.length)
            for (var item of this.analytics.analyticsData.failureAnalysis.contents){
              console.log(item.spams)
              console.log(item.nonspams)
            }
            */
            //this.analyticsData.roundTheClock.sort(sortRoundTheClock)
            //this.analyticsData.segmentCounts.sort(sortSegmentCount)
            this.analytics.analyticsData.task = "Completed"
          }
        } catch (e) {
          console.log('Endpoint: GET ' + endpoint)
          console.log('Params: ' + JSON.stringify(readParams))
          console.log(e.response.headers)
          console.log('ERR ' + e.message);
          this.analytics.analyticsData.task = "Interrupted"
        }
      }else{
        this.analytics.analyticsData.task = "Interrupted"
        console.log("Platform error")
      }
    },
    _readTestMessageStore: function (timeOffset){
      console.log("_readTestMessageStore")
      var resp = fs.readFileSync('./tempFile/testData_3.json', 'utf8');
      var jsonObj = JSON.parse(resp)
      var count = 0
      for (var message of jsonObj){
        this.analytics.analyzeMessage(message)
        count++
        if (count > 1000){
          count = 0
          this.analytics.analyticsData.task = "Processing"
          console.log("UPDATE PROCESSING")
        }
      }

      this.analytics.analyticsData.phoneNumbers.sort(sortbByNumber)
      console.log(this.analytics.analyticsData.failureAnalysis.contents.length)
      var check = true

      while (check){
        var index = this.analytics.analyticsData.failureAnalysis.contents.findIndex(o => o.ignore == true)
        if (index >= 0){
          this.analytics.analyticsData.failureAnalysis.contents.splice(index, 1)
          console.log("REMOVED")
        }else{
          check = false
        }
      }

      console.log("AFTER CLEAN UP")
      console.log(this.analytics.analyticsData.failureAnalysis.contents.length)
      for (var item of this.analytics.analyticsData.failureAnalysis.contents){
        console.log(item.spams)
        console.log(item.nonspams)
      }
      //console.log(this.analytics.analyticsData.failureAnalysis.contents)
      this.analytics.analyticsData.task = "Completed"
    },
    // analytics end
    downloadHVMessageStore: function(req, res){
      this.getMessagingAnalytics(req, res)
      //
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
          else{
            res.send({status:"ok",message:"deleted"})
          }
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
        fileContent = "Id,From,To,Creation Time,Last Updated Time,Message Status,Error Code,Error Description,Cost,Segment"
        //fileContent = "Id,From,To,Creation Time (UTC),Last Updated Time (UTC),Message Status,Error Code,Cost,Segment"
      var timeOffset = parseInt(query.timeOffset)
      let dateOptions = { weekday: 'short' }
      for (var item of records){
        console.log(item)
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
        var errorDes = ""
        if (item.hasOwnProperty('errorCode')){
          errorCode = item.errorCode
          errorDes = getErrorDescription(errorCode)
        }
        var cost = (item.cost) ? item.cost : 0.00
        var segmentCount = (item.segmentCount) ? item.segmentCount : 0
        fileContent += `\n${item.id},${from},${to},${createdDateStr},${updatedDateStr}`
        fileContent +=  `,${item.messageStatus},${errorCode},${errorDes},${cost},${segmentCount}`
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
    logout: async function(callback){
      console.log("LOGOUT FUNC")
      if ((this.eventEngine && this.eventEngine.voteCampaignArr.length > 0) || this.processingBatches.length > 0){
        callback(null, 1)
      }else{
        await this.deleteSubscription()
        var p = await this.rc_platform.getPlatform(this.extensionId)
        if (p)
        await p.logout()
        else
        console.log("No platform?")
        // may need to clear tokens and destroy eventEngine etc.
        var activeUsers = router.getActiveUsers()
        var index = activeUsers.findIndex(o => o.extensionId.toString() === this.extensionId.toString())
        activeUsers.splice(index, 1)
        //this.subscriptionId = ""
        this.resetSubscriptionAndAccessTokens((err, res) => {
          callback(null, 0)
        })
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
    deleteSubscription: async function() {
      console.log("deleteSubscription")
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try{
          var r =  await p.delete(`/restapi/v1.0/subscription/${this.subscriptionId}`)
          console.log("Deleted subscription")
        }catch(e){
          console.log("Cannot delete notification subscription")
          console.log(e.message)
        }
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
    resetSubscriptionAndAccessTokens: function(callback) {
      console.log("resetSubscriptionAndAccessTokens")
      var query = `UPDATE a2p_sms_users SET subscription_id='', access_tokens='' WHERE user_id='${this.extensionId}'`
      console.log(query)
      pgdb.update(query, (err, result) =>  {
        if (err){
          console.error("UPDATE ERR? " + err.message);
        }
        console.log("Subscription and access token reset")
        callback(null, "ok")
      })
    },
    updateActiveUserSubscription: function() {
      console.log("updateActiveUserSubscription")
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
          var query = `UPDATE a2p_sms_users SET batches='${batchesStr}' WHERE user_id='${thisUser.extensionId}'`
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

var errorCodes = {
  "SMS-UP-410": "Destination number invalid, unallocated, or does not support this kind of messaging.",
  "SMS-UP-430": "Spam content detected by SMS gateway.",
  "SMS-UP-431": "Number blacklisted due to spam.",
  "SMS-UP-500": "General SMS gateway error. Upstream is malfunctioning.",
  "SMS-CAR-104": "Carrier has not reported delivery status.",
  "SMS-CAR-199": "Carrier reports unknown message status.",
  "SMS-CAR-400": "Carrier does not support this kind of messaging.",
  "SMS-CAR-411": "Destination number invalid, unallocated, or does not support this kind of messaging.",
  "SMS-CAR-412": "Destination subscriber unavailable.",
  "SMS-CAR-413": "Destination subscriber opted out.",
  "SMS-CAR-430": "Spam content detected by mobile carrier.",
  "SMS-CAR-431": "Message rejected by carrier with no specific reason.",
  "SMS-CAR-432": "Message is too long.",
  "SMS-CAR-433": "Message is malformed for the carrier.",
  "SMS-CAR-450": "P2P messaging volume violation.",
  "SMS-CAR-460": "Destination rejected short code messaging.",
  "SMS-CAR-500": "Carrier reported general service failure.",
  "SMS-RC-500": "General/Unknown internal RingCentral error.",
  "SMS-RC-501": "RingCentral is sending a bad upstream API call.",
  "SMS-RC-503": "RingCentral provisioning error. Phone number is incorrectly provisioned by RingCentral in upstream."
}

function getErrorDescription(errorCode){
  for (var key of Object.keys(errorCodes)){
    if (key == errorCode)
      return errorCodes[key]
  }
  return ""
}

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

function detectPhoneNumber(message){
  var wordArr = message.split(" ")
  var contactNumber = ""
  for (var w of wordArr){
    var number = w.replace(/[+()\-\s]/g, '')
    if (!isNaN(number)){
      if (number.length >= 10 && number.length <= 11){
        contactNumber = w.trim()
        console.log(w)
        break
      }
    }
  }
  return contactNumber
}

const spamContentCodes = ["SMS-UP-430","SMS-CAR-430","SMS-CAR-431","SMS-CAR-432","SMS-CAR-433"]
const invalidNumberCodes = ["SMS-UP-420","SMS-CAR-411","SMS-CAR-412","SMS-UP-410"]
const optoutNumberCodes = ["SMS-CAR-413"]
const blockedNumberCodes = ["SMS-UP-431"]
function failureAnalysis(message){
  var code = (message.errorCode != undefined) ? message.errorCode : "Others"
  var toNumber = message.to[0]
  if (spamContentCodes.findIndex(c => c === code) >= 0){
    this.analyticsData.outboundFailureTypes.content.count++
    if (this.analyticsData.outboundFailureTypes.content.numbers.findIndex(number => number === toNumber) < 0)
      this.analyticsData.outboundFailureTypes.content.numbers.push(toNumber)
    var url = detectShortenUrl(message.text)
    if (url != ""){
      console.log("URL: " + url)
      if (this.analyticsData.outboundFailureTypes.content.messages.findIndex(link => link === url) < 0)
        this.analyticsData.outboundFailureTypes.content.messages.push(url)
    }else{
      var contactNumber = detectPhoneNumber(message.text)
      if (contactNumber != ""){
        if (this.analyticsData.outboundFailureTypes.content.messages.findIndex(number => number === contactNumber) < 0)
          this.analyticsData.outboundFailureTypes.content.messages.push(contactNumber)
      }else
        this.analyticsData.outboundFailureTypes.content.messages.push(message.text)
    }
  }else if (invalidNumberCodes.findIndex(c => c === code) >= 0){
    // recipient number problem
    if (this.analyticsData.outboundFailureTypes.invalidRecipientNumbers.findIndex(number => number === toNumber) < 0)
      this.analyticsData.outboundFailureTypes.invalidRecipientNumbers.push(toNumber)
  }else if (optoutNumberCodes[0] == code){
    // opted out
    if (this.analyticsData.outboundFailureTypes.optoutNumbers.findIndex(number => number === toNumber) < 0)
      this.analyticsData.outboundFailureTypes.optoutNumbers.push(toNumber)
  }else if (blockedNumberCodes[0] == code){
    if (this.analyticsData.outboundFailureTypes.blockedSenderNumbers.findIndex(number => number === message.from) < 0)
      this.analyticsData.outboundFailureTypes.blockedSenderNumbers.push(message.from)
  }else{
    this.analyticsData.outboundFailureTypes.others.count++
    if (this.analyticsData.outboundFailureTypes.others.numbers.findIndex(number => number === toNumber) < 0)
      this.analyticsData.outboundFailureTypes.others.numbers.push(toNumber)
    this.analyticsData.outboundFailureTypes.others.messages.push(message.text)
  }
}

function detectUrl(message){
  var unsafeLink = ""
  var tempMsg = message.toLowerCase()
  var shortenLinks = [
    "https://",
    "http://"
  ]

  for (var link of shortenLinks){
    var index = tempMsg.indexOf(link)
    if (index >= 0){
      var temp = tempMsg.substring(index, tempMsg.length-1)
      var endIndex = temp.indexOf(" ")
      endIndex = (endIndex > 0) ? endIndex : temp.length+1
      unsafeLink = msg.substr(index, endIndex)
      console.log(message)
      break
    }
  }
  return unsafeLink
}

function detectShortenUrl(message){
  var unsafeLink = ""
  var tempMsg = message.toLowerCase()
  var shortenLinks = [
    "https://bit.ly/",
    "https://ow.ly",
    "https://goo.gl/",
    "https://tinyurl.com/",
    "https://tiny.cc/",
    "https://bc.vc/",
    "https://budurl.com/",
    "https://clicky.me/",
    "https://is.gd/",
    "https://lc.chat/",
    "https://soo.gd/",
    "https://s2r.co/",
    "http://bit.ly/",
    "http://ow.ly",
    "http://goo.gl/",
    "http://tinyurl.com/",
    "http://tiny.cc/",
    "http://bc.vc/",
    "http://budurl.com/",
    "http://clicky.me/",
    "http://is.gd/",
    "http://lc.chat/",
    "http://soo.gd/",
    "http://s2r.co/",
    "https://",
    "http://"
  ]

  for (var link of shortenLinks){
    var index = tempMsg.indexOf(link)
    if (index >= 0){
      var temp = tempMsg.substring(index, tempMsg.length-1)
      var endIndex = temp.indexOf(" ")
      endIndex = (endIndex > 0) ? endIndex : temp.length+1
      unsafeLink = message.substr(index, endIndex)
      break
    }
  }
  return unsafeLink
}

function detectSegment(message){
  var segmented = (message.length > 160) ? 1 : 0
  return segmented
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

function sortRoundTheClock(a,b) {
  return a.hour - b.hour;
}

function sortSegmentCount(a,b) {
  return a.count - b.count;
}

function sortbByNumber(a,b) {
  return a.number - b.number;
}

//// TBD
async function _readMessageStore(readParams, timeOffset){
  console.log("_readMessageStore")
  var endpoint = "/restapi/v1.0/account/~/a2p-sms/messages"
  var p = await this.rc_platform.getPlatform(this.extensionId)
  if (p){
    try {
      var resp = await p.get(endpoint, readParams)
      var jsonObj = await resp.json()
      for (var message of jsonObj.records){
        var localDate = message.creationTime.substring(0, 7)
        var found = false
        for (var i=0; i<this.analyticsData.months.length; i++){
          var month = this.analyticsData.months[i]
          if (month.month == localDate){
            if (message.direction == "Outbound"){
              this.analyticsData.months[i].outboundCount++
              switch (message.messageStatus) {
                case "Delivered":
                case "Sent":
                  this.analyticsData.months[i].deliveredCount++
                  var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                  this.analyticsData.months[i].deliveredMsgCost += cost
                  break
                case "DeliveryFailed":
                  this.analyticsData.months[i].deliveryFailedCount++
                  var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                  this.analyticsData.months[i].failedMsgCost += cost
                  break
                case "SendingFailed":
                  this.analyticsData.months[i].sendingFailedCount++
                  var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                  this.analyticsData.months[i].failedMsgCost += cost
                  break;
                default:
                  break
              }
            }else{ // received messages
              this.analyticsData.months[i].inboundCount++
              var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
              this.analyticsData.months[i].receivedMsgCost += cost
            }
            found = true
            break
          }
        }
        if (!found){
          var item = {
            month: localDate,
            outboundCount: 0,
            inboundCount: 0,
            deliveredCount: 0,
            sendingFailedCount: 0,
            deliveryFailedCount: 0,
            deliveredMsgCost: 0.0,
            failedMsgCost: 0.0,
            receivedMsgCost: 0.0,
          }
          if (message.direction == "Outbound"){
            item.outboundCount++
            switch (message.messageStatus) {
              case "Delivered":
              case "Sent":
                item.deliveredCount++
                var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                item.deliveredMsgCost += cost
                break
              case "DeliveryFailed":
                item.deliveryFailedCount++
                var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                item.failedMsgCost += cost
                break
              case "SendingFailed":
                item.sendingFailedCount++
                var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                item.failedMsgCost += cost
                break;
              default:
                break
            }
          }else{ // received messages
            item.inboundCount++
            var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
            item.receivedMsgCost += cost
          }
          this.analyticsData.months.push(item)
          //console.log(this.analyticsData.months)
        }
        // by phoneNumbers
        found = false
        var fromNumber = (message.direction == "Outbound") ? message.from : message.to[0]
        for (var i=0; i<this.analyticsData.phoneNumbers.length; i++){
          var number = this.analyticsData.phoneNumbers[i]
          if (number.number == fromNumber){
            if (message.direction == "Outbound"){
              this.analyticsData.phoneNumbers[i].outboundCount++
              switch (message.messageStatus) {
                case "Delivered":
                case "Sent":
                  this.analyticsData.phoneNumbers[i].deliveredCount++
                  var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                  this.analyticsData.phoneNumbers[i].deliveredMsgCost += cost
                  break
                case "DeliveryFailed":
                  this.analyticsData.phoneNumbers[i].deliveryFailedCount++
                  var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                  this.analyticsData.phoneNumbers[i].failedMsgCost += cost
                  break
                case "SendingFailed":
                  this.analyticsData.phoneNumbers[i].sendingFailedCount++
                  var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                  this.analyticsData.phoneNumbers[i].failedMsgCost += cost
                  break;
                default:
                  break
              }
            }else{ // received messages
              this.analyticsData.phoneNumbers[i].inboundCount++
              var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
              this.analyticsData.phoneNumbers[i].receivedMsgCost += cost
            }
            found = true
            break
          }
        }
        if (!found){
          var item = {
            number: fromNumber,
            outboundCount: 0,
            inboundCount: 0,
            deliveredCount: 0,
            sendingFailedCount: 0,
            deliveryFailedCount: 0,
            deliveredMsgCost: 0.0,
            failedMsgCost: 0.0,
            receivedMsgCost: 0.0,
          }
          if (message.direction == "Outbound"){
            item.outboundCount++
            switch (message.messageStatus) {
              case "Delivered":
              case "Sent":
                item.deliveredCount++
                var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                item.deliveredMsgCost += cost
                break
              case "DeliveryFailed":
                item.deliveryFailedCount++
                var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                item.failedMsgCost += cost
                break
              case "SendingFailed":
                item.sendingFailedCount++
                var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
                item.failedMsgCost += cost
                break;
              default:
                break
            }
          }else{ // received messages
            item.inboundCount++
            var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
            item.receivedMsgCost += cost
          }
          this.analyticsData.phoneNumbers.push(item)
          //console.log(this.analyticsData.phoneNumbers)
        }
        /*
        // by weekDays
        found = false
        // "creationTime":"2021-05-24T13:49:41.441964Z",
        var createdDate = new Date(message.creationTime)
        let dateOptions = { weekday: 'short' }
        var createdDateStr = createdDate.toLocaleDateString("en-US", dateOptions)
        //  createdDateStr += " " + createdDate.toLocaleDateString("en-US")
        var wd = createdDateStr.substring(0, 3)
        for (var i=0; i<this.analyticsData.weekDays.length; i++){
          var week = this.analyticsData.weekDays[i]
          if (week.wd == wd){
            if (message.direction == "Outbound"){
              this.analyticsData.weekDays[i].outboundCount++
              switch (message.messageStatus) {
                case "Delivered":
                case "Sent":
                  this.analyticsData.weekDays[i].deliveredCount++
                  break
                case "DeliveryFailed":
                  this.analyticsData.weekDays[i].deliveryFailedCount++
                  break
                case "SendingFailed":
                  this.analyticsData.weekDays[i].sendingFailedCount++
                  break;
                default:
                  break
              }
              var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
              this.analyticsData.weekDays[i].sentMsgCost += cost
            }else{ // received messages
              this.analyticsData.weekDays[i].inboundCount++
              var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
              this.analyticsData.weekDays[i].receivedMsgCost += cost
            }
            found = true
            break
          }
        }
        if (!found){
          var item = {
            wd: wd,
            outboundCount: 0,
            inboundCount: 0,
            deliveredCount: 0,
            sendingFailedCount: 0,
            deliveryFailedCount: 0,
            sentMsgCost: 0.0,
            receivedMsgCost: 0.0,
          }
          if (message.direction == "Outbound"){
            item.outboundCount++
            switch (message.messageStatus) {
              case "Delivered":
              case "Sent":
                item.deliveredCount++
                break
              case "DeliveryFailed":
                item.deliveryFailedCount++
                break
              case "SendingFailed":
                item.sendingFailedCount++
                break;
              default:
                break
            }
            var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
            item.sentMsgCost += cost
          }else{ // received messages
            item.inboundCount++
            var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
            item.receivedMsgCost += cost
          }
          this.analyticsData.weekDays.push(item)
          //console.log(this.analyticsData.weekDays)
        }
        // by roundTheClock
        found = false
        // "creationTime":"2021-05-24T13:49:41.441964Z",
        var hr = message.creationTime.substring(11, 13)
        var hour = parseInt(hr)
        for (var i=0; i<this.analyticsData.roundTheClock.length; i++){
          var timeSlide = this.analyticsData.roundTheClock[i]
          if (timeSlide.hour == hour){
            if (message.direction == "Outbound"){
              this.analyticsData.roundTheClock[i].outboundCount++
              switch (message.messageStatus) {
                case "Delivered":
                case "Sent":
                  this.analyticsData.roundTheClock[i].deliveredCount++
                  break
                case "DeliveryFailed":
                  this.analyticsData.roundTheClock[i].deliveryFailedCount++
                  break
                case "SendingFailed":
                  this.analyticsData.roundTheClock[i].sendingFailedCount++
                  break;
                default:
                  break
              }
              var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
              this.analyticsData.roundTheClock[i].sentMsgCost += cost
            }else{ // received messages
              this.analyticsData.roundTheClock[i].inboundCount++
              var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
              this.analyticsData.roundTheClock[i].receivedMsgCost += cost
            }
            found = true
            break
          }
        }
        if (!found){
          var item = {
            hour: hour,
            outboundCount: 0,
            inboundCount: 0,
            deliveredCount: 0,
            sendingFailedCount: 0,
            deliveryFailedCount: 0,
            sentMsgCost: 0.0,
            receivedMsgCost: 0.0,
          }
          if (message.direction == "Outbound"){
            item.outboundCount++
            switch (message.messageStatus) {
              case "Delivered":
              case "Sent":
                item.deliveredCount++
                break
              case "DeliveryFailed":
                item.deliveryFailedCount++
                break
              case "SendingFailed":
                item.sendingFailedCount++
                break;
              default:
                break
            }
            var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
            item.sentMsgCost += cost
          }else{ // received messages
            item.inboundCount++
            var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
            item.receivedMsgCost += cost
          }
          this.analyticsData.roundTheClock.push(item)
          //console.log(this.analyticsData.roundTheClock)
        }
        // by segmentCount
        found = false
        var segment = (message.segmentCount != undefined) ? parseInt(message.segmentCount) : 0
        for (var i=0; i<this.analyticsData.segmentCounts.length; i++){
          var seg = this.analyticsData.segmentCounts[i]
          if (seg.count == segment){
            if (message.direction == "Outbound"){
              this.analyticsData.segmentCounts[i].outboundCount++
              switch (message.messageStatus) {
                case "Delivered":
                case "Sent":
                  this.analyticsData.segmentCounts[i].deliveredCount++
                  break
                case "DeliveryFailed":
                  this.analyticsData.segmentCounts[i].deliveryFailedCount++
                  break
                case "SendingFailed":
                  this.analyticsData.segmentCounts[i].sendingFailedCount++
                  break;
                default:
                  break
              }
              var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
              this.analyticsData.segmentCounts[i].sentMsgCost += cost
            }else{ // received messages
              this.analyticsData.segmentCounts[i].inboundCount++
              var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
              this.analyticsData.segmentCounts[i].receivedMsgCost += cost
            }
            found = true
            break
          }
        }
        if (!found){
          var item = {
            count: segment,
            outboundCount: 0,
            inboundCount: 0,
            deliveredCount: 0,
            sendingFailedCount: 0,
            deliveryFailedCount: 0,
            sentMsgCost: 0.0,
            receivedMsgCost: 0.0,
          }
          if (message.direction == "Outbound"){
            item.outboundCount++
            switch (message.messageStatus) {
              case "Delivered":
              case "Sent":
                item.deliveredCount++
                break
              case "DeliveryFailed":
                item.deliveryFailedCount++
                break
              case "SendingFailed":
                item.sendingFailedCount++
                break;
              default:
                break
            }
            var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
            item.sentMsgCost += cost
          }else{ // received messages
            item.inboundCount++
            var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
            item.receivedMsgCost += cost
          }
          this.analyticsData.segmentCounts.push(item)
          //console.log(this.analyticsData.segmentCounts)
        }
        */
        // breakout ends

        if (message.direction == "Outbound"){
          this.analytics.extractKeywords(message)
          this.analyticsData.outboundCount++
          switch (message.messageStatus) {
            case "Delivered":
              this.analyticsData.deliveredCount++
              break
            case "Sent":
              this.analyticsData.deliveredCount++
              break
            case "DeliveryFailed":
              this.analyticsData.deliveryFailedCount++
              var code = (message.errorCode != undefined) ? message.errorCode : "Others"
              var toNumber = message.to[0]
              if (code == "SMS-UP-430" || code == "SMS-CAR-430" || code == "SMS-CAR-431" || code == "SMS-CAR-432" || code == "SMS-CAR-433"){ // content problem
                //console.log(code)
                //this.analytics.extractKeywords(message.text)
                this.analyticsData.outboundFailureTypes.content.count++
                if (this.analyticsData.outboundFailureTypes.content.numbers.findIndex(number => number === toNumber) < 0)
                  this.analyticsData.outboundFailureTypes.content.numbers.push(toNumber)
                var url = detectShortenUrl(message.text)
                if (url != ""){
                  console.log("URL: " + url)
                  if (this.analyticsData.outboundFailureTypes.content.messages.findIndex(link => link === url) < 0)
                    this.analyticsData.outboundFailureTypes.content.messages.push(url)
                }else{
                  var contactNumber = detectPhoneNumber(message.text)
                  if (contactNumber != ""){
                    if (this.analyticsData.outboundFailureTypes.content.messages.findIndex(number => number === contactNumber) < 0)
                      this.analyticsData.outboundFailureTypes.content.messages.push(contactNumber)
                  }else
                    this.analyticsData.outboundFailureTypes.content.messages.push(message.text)
                }
              }else if (code == "SMS-UP-410" || code == "SMS-CAR-411" || code == "SMS-CAR-412"){
                // recipient number problem
                if (this.analyticsData.outboundFailureTypes.invalidRecipientNumbers.findIndex(number => number === toNumber) < 0)
                  this.analyticsData.outboundFailureTypes.invalidRecipientNumbers.push(toNumber)
              }else if (code == "SMS-CAR-413 "){
                // opted out
                if (this.analyticsData.outboundFailureTypes.optoutNumbers.findIndex(number => number === toNumber) < 0)
                  this.analyticsData.outboundFailureTypes.optoutNumbers.push(toNumber)
              }else if (code == "SMS-UP-431"){
                if (this.analyticsData.outboundFailureTypes.blockedSenderNumbers.findIndex(number => number === message.from) < 0)
                  this.analyticsData.outboundFailureTypes.blockedSenderNumbers.push(message.from)
              }else{
                this.analyticsData.outboundFailureTypes.others.count++
                if (this.analyticsData.outboundFailureTypes.others.numbers.findIndex(number => number === toNumber) < 0)
                  this.analyticsData.outboundFailureTypes.others.numbers.push(toNumber)
                //if (this.analyticsData.outboundFailureTypes.others.messages.findIndex(msg => msg === message.text) < 0)
                  this.analyticsData.outboundFailureTypes.others.messages.push(message.text)
              }
              break
            case "SendingFailed":
              this.analyticsData.sendingFailedCount++
              var code = (message.errorCode != undefined) ? message.errorCode : "Unknown"
              var found = false
              for (var i=0; i<this.analyticsData.sendingFailures.length; i++){
                var item = this.analyticsData.sendingFailures[i]
                if (code == item.code){
                  this.analyticsData.sendingFailures[i].count++
                  found = true
                  break
                }
              }
              if (!found){
                var item = {
                  code: code,
                  count: 1
                }
                this.analyticsData.sendingFailures.push(item)
              }
              break;
            default:
              break
          }
          var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
          this.analyticsData.sentMsgCost += cost
        }else{ // received messages
          this.analyticsData.inboundCount++
          var cost = (message.hasOwnProperty('cost')) ? message.cost : 0.0
          this.analyticsData.receivedMsgCost += cost
        }

      }
      //this.analyticsData.roundTheClock.sort(sortRoundTheClock)
      //this.analyticsData.segmentCounts.sort(sortSegmentCount)
      this.analyticsData.phoneNumbers.sort(sortbByNumber)
      if (jsonObj.paging.hasOwnProperty("nextPageToken")){
        this.analyticsData.task = "Processing"
        var thisUser = this
        setTimeout(function(){
            readParams['pageToken'] = jsonObj.paging.nextPageToken
            thisUser._readMessageStore(readParams, timeOffset)
        }, 1200)
      }else{
        console.log(this.analyticsData.outboundFailureTypes.content.messages)
        console.log(this.analyticsData.outboundFailureTypes.content.numbers)
        console.log(this.analyticsData)
        console.log(this.analytics.analyticsData.failureAnalysis)
        //this.analyticsData.roundTheClock.sort(sortRoundTheClock)
        //this.analyticsData.segmentCounts.sort(sortSegmentCount)
        this.analyticsData.task = "Completed"
        /*
        res.send({
            status: "ok",
            result: this.analyticsData
          })
        */
      }
    } catch (e) {
      console.log('Endpoint: GET ' + endpoint)
      console.log('Params: ' + JSON.stringify(readParams))
      console.log(e.response.headers)
      console.log('ERR ' + e.message);
      this.analyticsData.task = "Interrupted"
      /*
      res.send({
          status: "error",
          message: e.message
        })
      */
    }
  }else{
    this.analyticsData.task = "Interrupted"
    console.log("Platform error")
  }
}
