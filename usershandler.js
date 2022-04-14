var fs = require('fs')
var async = require("async");
const RCPlatform = require('./platform.js')
const pgdb = require('./db')
var router = require('./router');
const logger = require('./write-log')
const database = require('./write-database')
const ActiveUser = require('./event-engine.js')
const Analytics = require('./analytics-engine.js')
require('dotenv').load()

const MASK = "#!#"

function User(id) {
  this.userId = id;
  this.extensionId = 0;
  this.accountId = 0;
  this.adminUser = false
  this.monitor = false
  this.userEmail = "" // for feedback only
  this.userName = ""
  this.subscriptionId = ""
  this.eventEngine = undefined
  this.rc_platform = new RCPlatform(id)
  this.analytics = new Analytics()
  this.autoDelele = false
  this.phoneHVNumbers = []
  this.phoneTFNumbers = []
  this.reputationScore = 0
  this.numberReputation = []

  // High Volume SMS Report
  this.batchSummaryReport = {
    scheduled: false,
    sendAt: 0,
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

  this.downloadLink = ""
  this.downloadBatchId = ""
  this.createReportStatus = "idle"

  this.batchFullReport = []
  this.processingBatches = []
  this.mainCompanyNumber = ""
  this.downloadFileName = ""
  this.analyticsData = {}

  this.userActivities = {}
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
      return this.userId
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
    loadOptionPage: async function(res){
      console.log("loadOptionPage")
      var ret = await this.readA2PSMSPhoneNumber(res)
      return ret
    },
    loadStandardSMSPage: async function(res){
      //logger.writeLog(this.extensionId, `----- time: ${new Date().toISOString()} -----\r\nOpen Standard SMS page`)
      //check login
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (!p){
        logger.writeLog(this.extensionId, "Tokens expired => force relogin")
        return false
      }
      this.userActivities.currentPresence = 'standard-sms'
      var enableHVSMS = (this.phoneHVNumbers.length) ? false : true
      res.render('standard-sms', {
        userName: this.getUserName(),
        phoneNumbers: this.phoneTFNumbers,
        sendReport: this.sendReport,
        enableHighVolumeSMS: enableHVSMS
      })
      return true
    },
    loadHelpPage: function(res){
      this.userActivities.currentPresence = 'help'
      this.userActivities.helps++
      console.log(this.userActivities)
      database.updateUserMonitorActivities(this.extensionId, this.userActivities)
      res.render('about')
      return true
    },
    loadSettingsPage: async function(res){
      //logger.writeLog(this.extensionId, `----- time: ${new Date().toISOString()} -----\r\nOpen Settings page`)
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (!p){
        logger.writeLog(this.extensionId, "Tokens expired => force relogin")
        return false
      }
      this.userActivities.currentPresence = 'settings'
      var lowVolume = false
      if (this.phoneTFNumbers.length)
        lowVolume = true
      res.render('settings', {
        userName: this.getUserName(),
        lowVolume: lowVolume,
        phoneNumbers: this.phoneHVNumbers
      })
      return true
    },
    getContacts: function(res){
      this.readContactsFromDataInDB((err, contacts) => {
        res.send({
          status: "ok",
          contactList: contacts
        })
      })
    },
    readTemplates: function(res){
      this.readTemplatesFromDataInDB((err, templates) => {
        res.send({
          status: "ok",
          templateList: templates
        })
      })
    },
    loadAnalyticsPage: async function(res){
      //logger.writeLog(this.extensionId, `----- time: ${new Date().toISOString()} -----\r\nOpen Analytics page`)
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (!p){
        logger.writeLog(this.extensionId, "Tokens expired => force relogin")
        return false
      }
      this.userActivities.currentPresence = 'analytics'
      var lowVolume = false
      if (this.phoneTFNumbers.length)
        lowVolume = true
      res.render('analytics', {
        userName: this.getUserName(),
        phoneNumbers: this.phoneHVNumbers,
        lowVolume: lowVolume
      })
      return true
    },
    loadMonitorPage: function(res){
      if (this.monitor){
        res.render('monitor', {
          userName: this.getUserName(),
          activeUsers: activeUsers
        })
      }else
        this.loadHelpPage(res)
    },
    loadCampaignHistoryPage: async function(res){
      //logger.writeLog(this.extensionId, `----- time: ${new Date().toISOString()} -----\r\nOpen Logs page`)
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (!p){
        logger.writeLog(this.extensionId, "Tokens expired => force relogin")
        return false
      }
      this.userActivities.currentPresence = 'logs'
      var lowVolume = false
      if (this.phoneTFNumbers.length)
        lowVolume = true
      res.render('campaign', {
        userName: this.getUserName(),
        lowVolume: lowVolume
      })
      return true
    },
    loadHVSMSPage: async function(res){
      //logger.writeLog(this.extensionId, `----- time: ${new Date().toISOString()} -----\r\nOpen Campaigns page`)
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (!p){
        logger.writeLog(this.extensionId, "Tokens expired => force relogin")
        return false
      }
      if (this.eventEngine)
        this.eventEngine.logNewMessage = false
      this.userActivities.currentPresence = 'campaigns'
      var lowVolume = false
      if (this.phoneTFNumbers.length)
        lowVolume = true

      res.render('highvolume-sms', {
        userName: this.getUserName(),
        phoneNumbers: this.phoneHVNumbers,
        lowVolume: lowVolume,
        monitor: this.monitor
      })
      return true
    },
    login: async function(req, res, callback){
      if (req.query.code) {
        var thisUser = this
        var extensionId = await this.rc_platform.login(req.query.code)
        if (extensionId){
          this.extensionId = extensionId
          req.session.extensionId = extensionId;
          /*
          var admins = process.env.ADMINS.split(',')
          for (var adminId of admins){
            if (this.extensionId == adminId){
              this.monitor = true
              break
            }
          }
          */
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
              console.log("login() - Failed")
              console.error(e.message);
            }
            // read monitor data
            database.readMonitorDB(this.extensionId, function(err, result){
              thisUser.userActivities = result
              //console.log(thisUser.userActivities)
              thisUser.updateUserMonitorLastSeen()
            })
            logger.writeLog(this.extensionId, `------------\r\nUser login at ${new Date().toISOString()}\r\nEmail: ${this.userEmail} - Account id: ${this.accountId}`)
            await this._readA2PSMSPhoneNumber(p)

            this.userActivities.currentPresence = 'campaigns'

            this._readReputationScore((err, result) => {
              for (var number of thisUser.numberReputation){
                if (number.score <= 0){
                  console.log("This number score is low: " + number.number)
                  //return
                }
              }
            })
            // only customers with A2P SMS would be able to subscribe for notification
            if (this.phoneHVNumbers.length){
              this.eventEngine = router.getActiveUsers().find(o => o.extensionId.toString() === this.extensionId.toString())
              if (this.eventEngine){
                this.eventEngine.setPlatform(this.rc_platform)
                this.eventEngine.changeOwner("user")
                this.subscriptionId = this.eventEngine.subscriptionId
                // copy active campaigns if any
                //this.processingBatches = this.eventEngine.processingBatches
                //console.log("Copied processingBatches")
                //console.log(this.processingBatches)
                if (this.subscriptionId == ""){
                  console.log(`user ${this.extensionId} has no subscription => create a new one`)
                  var eventFilters = []
                  var filter = ""
                  for (var item of this.phoneHVNumbers){
                    filter = `/restapi/v1.0/account/~/a2p-sms/batches?from=${item.number}`
                    eventFilters.push(filter)
                  }
                  this.subscribeForNotification(eventFilters, (err, subscriptionId) => {
                    console.log("new subscriptionId: " + subscriptionId)
                  })
                }else{
                  console.log(`user ${this.extensionId} has existing subscription => check to renew it`)
                  this.renewNotification((err, subscriptionId) => {
                    if (!err){
                      console.log("RENEW SUB ID: " + subscriptionId)
                      thisUser.eventEngine.subscriptionId = subscriptionId
                      thisUser.subscriptionId = subscriptionId
                    }
                  })
                }
                callback(null, extensionId)
                res.send('login success');
              }else{ // should subscribe for notification and create eventEngine by default
                console.log(`user ${this.extensionId} was not in the active user list => create a object`)
                var eventFilters = []
                var filter = ""
                for (var item of this.phoneHVNumbers){
                  filter = `/restapi/v1.0/account/~/a2p-sms/batches?from=${item.number}`
                  eventFilters.push(filter)
                }
                this.subscribeForNotification(eventFilters, (err, subscriptionId) => {
                  thisUser.eventEngine = new ActiveUser(thisUser.extensionId, subscriptionId, "user")
                  // must push to router's activeUser list in order to receive routed subscription
                  router.getActiveUsers().push(thisUser.eventEngine)
                  thisUser.eventEngine.setup(thisUser.rc_platform, (err, result) => {
                    if (err == null){
                      console.log("eventEngine is set")
                    }
                  })
                  callback(null, extensionId)
                  res.send('login success');
                })
              }
            }else{
              callback(null, extensionId)
              res.send('login success');
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
    readMonitorDB: function(callback){
      var thisUser = this
      var query = `SELECT * FROM a2p_sms_users_monitor WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
        }
        if (!err && result.rows.length > 0){
          thisUser.userActivities = JSON.parse(result.rows[0].activities)
        }else{ // no activities
          thisUser.userActivities = {
            currentPresence: 'offline',
            standard_sms: { count: 0, total_messages: 0, download_count: 0, ts: 0 },
            campaign_broadcast: { count: 0, total_messages: 0, ts: 0 },
            campaign_personalized: { count: 0, total_message: 0, ts: 0 },
            campaigns_logs: { view_count: 0, delete_count: 0, download_count: 0, total_delivered: 0, total_failed: 0, ts: 0 },
            message_store_downloads: { count: 0, ts: 0 },
            analytics: { view_count: 0, download_count: 0, ts: 0 },
            settings: { webhook: 0, contacts: 0, opt_out: 0, ts: 0 },
            helps: 0
          }
        }
        callback(null, "ok")
      })
    },
    updateUserMonitorLastSeen: function(){
      var query = "INSERT INTO a2p_sms_users_monitor (user_id, full_name, email, activities, last_seen)"
      query += " VALUES ($1,$2,$3,$4,$5)"
      var now = new Date().getTime()
      var activities = JSON.stringify(this.userActivities)
      var values = [this.extensionId, this.userName, this.userEmail, activities, now]
      query += ` ON CONFLICT (user_id) DO UPDATE SET full_name='${this.userName}', email='${this.userEmail}', last_seen=${now}`
      pgdb.insert(query, values, (err, result) =>  {
        if (err){
          console.error(err.message);
          console.log("QUERY: " + query)
        }else{
          console.log("updateUserMonitorActivities DONE");
        }
      })
    },
    readA2PSMSPhoneNumber: async function(res){
      console.log("readA2PSMSPhoneNumber")
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (!p){
        logger.writeLog(this.extensionId, "Tokens expired => force relogin")
        return false
      }
      if (this.adminUser){
        // admin w/o number
        console.log("checking")
        if ((this.phoneHVNumbers.length == 0) && (this.phoneTFNumbers.length == 0)){
            // check if this account has any users who has HV SMS numbers and ever used the app
            var query = `SELECT account_id FROM a2p_sms_users WHERE user_id='${this.accountId}'`
            console.log(query)
            pgdb.read(query, (err, result) => {
              console.log("Found?", err)
              console.log(result.rows)
              if (err){
                res.render('main', {
                  userName: this.userName,
                  lowVolume: false,
                  highVolume: false
                })
              }else{
                if (result.rows.length > 0 && result.rows[0].account_id != ''){
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
              }
            })
            return true
        }
      }
      // decide what page to load
      if (this.phoneHVNumbers.length > 0 && this.subscriptionId != ""){
        console.log("temp solution")
        var thisUser = this
        this.updateNotification(false, (err, eventFilters) => {
          logger.writeLog(thisUser.extensionId, "readA2PSMSPhoneNumber => Stop getting outbound notification")
          if (err){
            if (eventFilters){
              logger.writeLog(thisUser.extensionId, "updateNotification failed => resubscribe for notification")
              thisUser.subscribeForNotification(eventFilters, (err, subscriptionId) => {
                if (!err)
                  logger.writeLog(thisUser.extensionId, `subscribeForNotification => resubscribe for notification subId ${subscriptionId}`);
                else{
                  logger.writeLog(thisUser.extensionId, `subscribeForNotification failed`);
                }
              })
            }else{
              // force login
              logger.writeLog(thisUser.extensionId, "updateNotification failed => Tokens expired. Force relogin ")
              return false
            }
          }
        })
      }
      //console.log(this.phoneHVNumbers)
      if (this.phoneHVNumbers.length > 0 && this.phoneTFNumbers.length > 0){
        // launch option page
        res.render('highvolume-sms', {
          userName: this.getUserName(),
          phoneNumbers: this.phoneHVNumbers,
          lowVolume: true,
          monitor: this.monitor
        })
      }else if (this.phoneHVNumbers.length > 0){
        // launch high volume page
        res.render('highvolume-sms', {
          userName: this.userName,
          phoneNumbers: this.phoneHVNumbers,
          monitor: this.monitor
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
      return true
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
          //console.log(record)
          //console.log("==")
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
        //console.log(this.phoneHVNumbers)
      } catch (e) {
        console.log("_readA2PSMSPhoneNumber() - Cannot read phone numbers!!!")
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
      this.userActivities.settings.webhook++
      this.userActivities.settings.ts = new Date().getTime()
      //this.updateUserMonitorActivities()
      database.updateUserMonitorActivities(this.extensionId, this.userActivities)
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
        var currentFolder = process.cwd();
        for (var f of req.files){
          var tempFile = `${currentFolder}/uploads/${f.filename}`
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
            row = detectAndHandleCommas(row)
            var columns = row.trim().split(",")
            var contactNumber = columns[csvColumnIndex[body.number_column]]
            if (contactNumber && contactNumber.length > 0)
              contactNumber = (contactNumber[0] != "+") ? `+${contactNumber}` : contactNumber
            else
              contactNumber = ""
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
        for (var file of req.files){
          var tempFile = `${currentFolder}/uploads/${file.filename}`
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
              status: "error",
              message: "Cannot update contacts"
            })
        })
        this.userActivities.settings.contacts++
        this.userActivities.settings.ts = new Date().getTime()
        database.updateUserMonitorActivities(this.extensionId, this.userActivities)
      }
    },
    deleteContacts: function (req, res){
      var body = req.body
      this.readContactsFromDataInDB((err, savedContacts) => {
        var index = savedContacts.findIndex(o => o.groupName === body.groupName)
        if (index >= 0){
          var savedGroup = savedContacts[index]
          if (body.removeGroup == 'true'){
            savedContacts.splice(index, 1)
            if (savedGroup)
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
    sendHighVolumeMessage: function (req, res){
      // check reputation
      var checkNumber = this.numberReputation.find(o => o.number == req.body.from_number)
      if (checkNumber){
        if (checkNumber.score <= 0){
          res.send({status:'blocked',message:'Your phone number is temporarily blocked from sending SMS. Please contact us using the feedback form for resolution.'})
          return
        }
      }
      // batchFullReport could take lots of memory
      // reset it to release memory
      this.batchFullReport = []
      var body = req.body
      this._sendTailoredMessage(req, res)
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
          //var message = body.message.trim()
          requestBody['text'] = body.message.trim()
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
            var message = body.message.trim()
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
        }
      }
      if (sampleMessage == "")
        sampleMessage = body.message.trim()
      sampleMessage = (sampleMessage.length > 50) ? (sampleMessage.substring(0, 50) + "...") : sampleMessage
      this.batchSummaryReport = {
        scheduled: false,
        sendAt: 0,
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
      if (req.body.scheduled){
        this.batchSummaryReport.scheduled = true
        console.log(req.body.send_at)
        var currentTime = new Date().getTime()
        var sendAt = currentTime + parseInt(req.body.send_at)
        this.batchSummaryReport.sendAt = sendAt
        this.batchSummaryReport.creationTime = currentTime //sendAt
        //console.log("Current Time " + currentTime)
        //console.log("sendAt: " + sendAt)
        //var sendIn = (sendAt - currentTime) / 60000
        //console.log("Send in " + sendIn + " mins")
        var scheduledCampaign = {
          sendAt: sendAt,
          creationTime: currentTime,
          requestBody: requestBody
        }
        var thisUser = this
        this.addBatchDataToDB((err, result) => {
          console.log("add scheduled campaign to DB.")
          // send response after saving the scheduled campaign to db
          thisUser.eventEngine.setScheduledCampaign(scheduledCampaign, (err, result) => {
            if (!err)
              res.send({
                status: 'scheduled',
                message: `Campaign scheduled`
              })
            else
              res.send({
                status: 'error',
                message: 'Cannot schedule campaign. Please try again.'
              })
          })
        })
      }else{
        this.sendBatchMessage(res, requestBody)
      }
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
    sendBatchMessage: async function(res, requestBody){
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        if (this.batchSummaryReport.type == 'group'){
          this.userActivities.campaign_broadcast.count++
          this.userActivities.campaign_broadcast.total_messages += this.batchSummaryReport.totalCount
          this.userActivities.campaign_broadcast.ts = new Date().getTime()
        }else if( this.batchSummaryReport.type == 'customized'){
          this.userActivities.campaign_personalized.count++
          this.userActivities.campaign_personalized.total_messages += this.batchSummaryReport.totalCount
          this.userActivities.campaign_personalized.ts = new Date().getTime()
        }
        database.updateUserMonitorActivities(this.extensionId, this.userActivities)
        var endpoint = "/restapi/v1.0/account/~/a2p-sms/batches"
        try {
          var resp = await p.post(endpoint, requestBody)
          var jsonObj = await resp.json()
          //var obj = resp.headers
          logger.writeLog(this.extensionId, `------------\r\nCampaign sent to ${jsonObj.batchSize} recipients at ${new Date().toISOString()}\r\nBatch id: ${jsonObj.id}`)

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
            this.userActivities.campaigns_logs.total_rejected += jsonObj.rejected.length
            this.batchSummaryReport.totalCount -= jsonObj.rejected.length
            database.addRejectedNumberToDB(jsonObj.rejected, jsonObj.id, this.extensionId)
          }

          this.processingBatches.push(jsonObj.id)
          this.batchSummaryReport.batchId = jsonObj.id

          this.addBatchDataToDB((err, result) => {
            res.send({
                status:"ok",
                result: batchResult
            })
          })
        } catch (e) {
          console.log("sendBatchMessage()")
          var obj = e.response.headers
          logger.writeLog(this.extensionId, `------------\r\nCampaign => POST endpoint ${endpoint} at ${new Date().toISOString()}\r\nRequest id: ${obj.get('rcrequestid')}`)
          logger.writeLog(this.extensionId, `Error message: ${e.message}`);
          res.send({
              status:"error",
              message: e.message
          })
        }
      }else{
        console.log("sendBatchMessage() - You have been logged out. Please login again.")
        res.send({
          status: "failed",
          message: "You have been logged out. Please login again."
        })
      }
    },
    processBatchEventNotication: function(eventObj){
      //console.log("Batch completed: userHandler")
      var thisUser = this
      if (eventObj.body.status == "Completed"){
        if (this.eventEngine.processingBatches.length){
          console.log("before copy")
          console.log(this.eventEngine.processingBatches)
          console.log(this.processingBatches)
          this.processingBatches = this.processingBatches.concat(this.eventEngine.processingBatches)
          this.eventEngine.processingBatches = []
          console.log("after copy from event engine")
          console.log(this.processingBatches)
        }
        var index = thisUser.processingBatches.findIndex(o => o == eventObj.body.id)
        if (index >= 0){
          this.processingBatches.splice(index, 1)
          this.readBatchReportFromDB(eventObj.body.id, (err, batch) => {
            if (batch){
              console.log("found batch")
              console.log(eventObj.body.id)
              //console.log(batch)
              logger.writeLog(thisUser.extensionId, `------------\r\nCampaign status: ${eventObj.body.status} notified at ${new Date().toISOString()}\r\nBatch id: ${batch.batchId}`)

              batch.queuedCount = 0
              batch.deliveredCount = 0
              batch.sentCount = 0
              batch.unreachableCount = 0
              batch.totalCost = 0.0
              thisUser._readBatchReport(batch, 1, 0, "")
            }else{
              logger.writeLog(thisUser.extensionId, `------------\r\nBatch not found from db! Notified at ${new Date().toISOString()}\r\nEvent body: ${JSON.stringify(eventObj.body)}`)
            }
          })
        }
      }
    },
    _readBatchReport: async function(batch, page, spamMsgCount, pageToken){
      console.log(`_readBatchReport: ${batch.batchId} / ${page} / ${pageToken}`)
      var endpoint = "/restapi/v1.0/account/~/a2p-sms/messages"
      var params = {
        batchId: batch.batchId,
        perPage: 1000
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
                batch.queuedCount++
                break;
              case "Delivered":
                batch.deliveredCount++
                break
              case "Sent":
                batch.sentCount++
                break;
              case "DeliveryFailed":
              case "SendingFailed":
                // detect spam to block user
                if ( message.errorCode == 'SMS-UP-430' || message.errorCode == 'SMS-CAR-430')
                     spamMsgCount++
                batch.unreachableCount++
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

          if (jsonObj.paging.hasOwnProperty("nextPageToken")){
            //console.log("has nextPageToken, get it after 1.2 secs")
            page++
            var thisUser = this
            setTimeout(function(){
              thisUser._readBatchReport(batch, page, spamMsgCount, jsonObj.paging.nextPageToken)
            }, 1200)
          }else{
            // update local db
            console.log(`From notification. Page# = ${page} `)

            // Keep track of this to see if this is enough to block spammers
            var numberObj = this.numberReputation.find(o => o.number == batch.serviceNumber)
            console.log(numberObj)
            console.log(this.numberReputation)
            console.log("batch Id", batch.batchId)
            if (numberObj){
              const prevScore = numberObj.score
              numberObj.score -= spamMsgCount
              console.log(prevScore, " == ", numberObj.score)
              if (prevScore > 0 && numberObj.score <= 0){
                post_alert_to_group(this)
              }
            }

            console.log(numberObj)
            console.log(this.numberReputation)

            this._updateCampaignDB(batch, (err, result) => {
              //console.log("Call post result only once when batch result is completed. Post only if webhook uri is provided.")
              var postData = {
                dataType: "Campaign_Summary",
                report: result
              }
              //console.log(postData)
              // post batch data to webhook address
              this.eventEngine.postResults(postData)
              if (this.processingBatches.length == 0){
                if (this.autoDelele == true){
                  logger.writeLog(this.extensionId, `----- time: ${new Date().toISOString()} -----\r\nSelf removed`)
                  this.userActivities.currentPresence = 'offline'
                  this.logout(function(err, remove){
                    router.removeMe(this.extensionId, remove)
                  })
                }
              }
            })

            this.userActivities.campaigns_logs.total_delivered += batch.deliveredCount
            this.userActivities.campaigns_logs.total_failed += batch.unreachableCount
            this.userActivities.campaigns_logs.ts = new Date().getTime()
            database.updateUserMonitorActivities(this.extensionId, this.userActivities)
          }
        } catch (e) {
          console.log("_readBatchReport()")
          if (e.response){
            var obj = e.response.headers
            logger.writeLog(this.extensionId, `------------\r\n_readBatchReport => GET ${endpoint} at ${new Date().toISOString()}\r\nRequest id: ${obj.get('rcrequestid')}`)
          }
          logger.writeLog(this.extensionId, `Params ${JSON.stringify(params)}`);
          logger.writeLog(this.extensionId, `Error message: ${e.message}`);
        }
      }else{
        console.log("_readBatchReport() - platform issue")
      }
    },
    readCampaignSummary: async function(res, reqQuery){
      console.log("readCampaignSummary - sendCount > 0")
      var endpoint = `/restapi/v1.0/account/~/a2p-sms/statuses`
      //.batchId, req.query.ts
      var params = {
        batchId: reqQuery.batchId
      }
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try {
          var resp = await p.get(endpoint, params)
          var jsonObj = await resp.json()
          //console.log(jsonObj)
          var unreachableCount = jsonObj.deliveryFailed.count
          unreachableCount += jsonObj.sendingFailed.count
          var totalCost = 0.0
          if (jsonObj.delivered.hasOwnProperty('cost'))
            totalCost += jsonObj.delivered.cost
          if (jsonObj.deliveryFailed.hasOwnProperty('cost'))
            totalCost += jsonObj.deliveryFailed.cost
          if (jsonObj.sent.hasOwnProperty('cost'))
            totalCost += jsonObj.sent.cost
          if (jsonObj.sendingFailed.hasOwnProperty('cost'))
            totalCost += jsonObj.sendingFailed.cost

          var batchReport = {
            batchId: reqQuery.batchId,
            queuedCount: jsonObj.queued.count,
            deliveredCount: jsonObj.delivered.count,
            sentCount: jsonObj.sent.count,
            unreachableCount: unreachableCount,
            totalCost: totalCost
          }

          var timeStamp = parseInt(reqQuery.ts)
          var now = new Date().getTime()
          if ((now - timeStamp) > 86400000){
            var spamMsgCount = 0
            var deliveryFailed = jsonObj.deliveryFailed
            if (deliveryFailed.count > 0){
              if (deliveryFailed.errorCodeCounts.hasOwnProperty('SMS-CAR-430'))
                spamMsgCount += deliveryFailed.errorCodeCounts['SMS-CAR-430']
              if (deliveryFailed.errorCodeCounts.hasOwnProperty('SMS-UP-430'))
                spamMsgCount += deliveryFailed.errorCodeCounts['SMS-UP-430']
            }

            var numberObj = this.numberReputation.find(o => o.number == reqQuery.number)
            console.log("batch Id", reqQuery.batchId)
            console.log(numberObj)
            console.log(this.numberReputation)
            if (numberObj){
              const prevScore = numberObj.score
              numberObj.score -= spamMsgCount
              if (prevScore > 0 && numberObj.score <= 0){
                post_alert_to_group(this)
              }
            }
            console.log(numberObj)
            console.log(this.numberReputation)

            this._updateCampaignDB(batchReport, (err, result) => {
              console.log("DONE READ BATCH REPORT. UPDATE FROM POLLING")
            })
            this.userActivities.campaigns_logs.total_delivered += batchReport.deliveredCount
            this.userActivities.campaigns_logs.total_failed += batchReport.unreachableCount
            this.userActivities.campaigns_logs.ts = new Date().getTime()
            database.updateUserMonitorActivities(this.extensionId, this.userActivities)
          }else{
            console.log("DONT UPDATE CAMPAIGN DB!")
          }
          res.send({
            status: "ok",
            batchReport: batchReport
          })
        } catch (e) {
          console.log("readCampaignSummary()")
          if (e.response){
            var obj = e.response.headers
            logger.writeLog(this.extensionId, `----- time: ${new Date().toISOString()} -----\r\nreadCampaignSummary => GET ${endpoint}\r\nRequest id: ${obj.get('rcrequestid')}`)
          }
          logger.writeLog(this.extensionId, `Params ${JSON.stringify(params)}`);
          logger.writeLog(this.extensionId, `Error message: ${e.message}`);
          res.send({
            status: "error",
            message: e.message
          })
        }
      }else{
        console.log("readCampaignSummary() - You have been logged out. Please login again.")
        res.send({
          status: "failed",
          message: "You have been logged out. Please login again."
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
      else{
        this.userActivities.campaigns_logs.view_count++
        this.userActivities.campaigns_logs.ts = new Date().getTime()
        database.updateUserMonitorActivities(this.extensionId, this.userActivities)
      }

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
          console.log("readCampaignDetails()")
          if (e.response){
            var obj = e.response.headers
            logger.writeLog(this.extensionId, `----- time: ${new Date().toISOString()} -----\r\nreadCampaignDetails => GET ${endpoint}\r\nRequest id: ${obj.get('rcrequestid')}`)
          }
          logger.writeLog(this.extensionId, `Params ${JSON.stringify(params)}`);
          logger.writeLog(this.extensionId, `Error message: ${e.message}`);
          res.send({
            status: "error",
            message: e.message
          })
        }
      }else{
        console.log("readCampaignDetails() - You have been logged out. Please login again.")
        res.send({
          status: "failed",
          message: "You have been logged out. Please login again."
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
          console.log("readOptedOutNumber()")
          if (e.response){
            var obj = e.response.headers
            logger.writeLog(this.extensionId, `----- time: ${new Date().toISOString()} -----\r\nreadOptedOutNumber => GET ${endpoint}\r\nRequest id: ${obj.get('rcrequestid')}`)
          }
          logger.writeLog(this.extensionId, `Params ${JSON.stringify(params)}`);
          logger.writeLog(this.extensionId, `Error message: ${e.message}`);
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
      this.userActivities.settings.opt_out++
      this.userActivities.settings.ts = new Date().getTime()
      database.updateUserMonitorActivities(this.extensionId, this.userActivities)
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
          console.log("_readMessageList()")
          if (e.response){
            var obj = e.response.headers
            logger.writeLog(this.extensionId, `----- time: ${new Date().toISOString()} -----\r\n_readMessageList => GET ${endpoint}\r\nRequest id: ${obj.get('rcrequestid')}`)
          }
          logger.writeLog(this.extensionId, `Params ${JSON.stringify(readParams)}`);
          logger.writeLog(this.extensionId, `Error message: ${e.message}`);
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
    // analytics
    pollAnalyticsResult: function (res){
      console.log("poll analytics")
      res.send({
          status: "ok",
          result: this.analytics.analyticsData
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
          if (fs.existsSync(deleteFile))
            fs.unlinkSync(deleteFile)
        }, 20000, deleteFile)

        this.userActivities.analytics.download_count++
        this.userActivities.analytics.ts = new Date().getTime()
        database.updateUserMonitorActivities(this.extensionId, this.userActivities)
      }catch (e){
        console.log("downloadAnalytics() - cannot create report file")
        res.send({
          status:"error",
          message:"Cannot create a report file! Please try gain"
        })
      }
    },
    getMessagingAnalytics: function (req, res){
      console.log("getMessagingAnalytics")
      // REMOVE WHEN COMMIT
      /*
      if (this.analytics.analyticsData != undefined){
        res.send({
            status: "ok",
            result: this.analytics.analyticsData
        })
        return
      }
      */
      this.analytics.resetAnalyticsData()
      res.send({
          status: "ok",
          result: this.analytics.analyticsData
      })

      this.userActivities.analytics.view_count++
      this.userActivities.analytics.ts = new Date().getTime()
      database.updateUserMonitorActivities(this.extensionId, this.userActivities)

      if (req.body.mode == 'date'){
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
            readParams['pageToken'] = ""

        this._readMessageStoreForAnalytics(readParams, timeOffset)
      }else{
        var campaignIds = JSON.parse(req.body.campaignIds)
        console.log(campaignIds)
        this._readMessageStoreByCampaign(campaignIds, "", 0)
      }
    },
    // currently, not supported
    _readMessageStoreByCampaign: async function(campaignIds, pageToken, index){
      console.log("_readMessageStoreByCampaign")
      var endpoint = "/restapi/v1.0/account/~/a2p-sms/messages"
      var params = {
        batchId: campaignIds[index],
        view: 'Detailed',
        perPage: 1000
      }
      if (pageToken != "")
        params['pageToken'] = pageToken
      console.log(index)
      console.log(JSON.stringify(params))
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try {
          var resp = await p.get(endpoint, params)
          var jsonObj = await resp.json()
          console.log(jsonObj)
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
                //readParams['pageToken'] = jsonObj.paging.nextPageToken
                thisUser._readMessageStoreByCampaign(campaignIds, jsonObj.paging.nextPageToken, index)
            }, 1200)
          }else{
            index++
            if (index < campaignIds.length){
              this._readMessageStoreByCampaign(campaignIds, "", index)
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
          }
        } catch (e) {
          console.log("_readMessageStoreByCampaign()")
          if (e.response){
            var obj = e.response.headers
            logger.writeLog(this.extensionId, `----- time: ${new Date().toISOString()} -----\r\n_readMessageStoreByCampaign => GET ${endpoint}\r\nRequest id: ${obj.get('rcrequestid')}`)
          }
          logger.writeLog(this.extensionId, `Params ${JSON.stringify(params)}`);
          logger.writeLog(this.extensionId, `Error message: ${e.message}`);
          this.analytics.analyticsData.task = "Interrupted"
        }
      }else{
        this.analytics.analyticsData.task = "Interrupted"
        console.log("Platform error")
      }
    },
    _readMessageStoreForAnalytics: async function(readParams, timeOffset){
      console.log("_readMessageStoreForAnalytics")
      var endpoint = "/restapi/v1.0/account/~/a2p-sms/messages"
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try {
          var resp = await p.get(endpoint, readParams)
          var jsonObj = await resp.json()
          //console.log(jsonObj)
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
            console.log("done analytics")
            this.analytics.analyticsData.task = "Completed"
          }
        } catch (e) {
          console.log("_readMessageStoreForAnalytics()")
          if (e.response){
            var obj = e.response.headers
            logger.writeLog(this.extensionId, `----- time: ${new Date().toISOString()} -----\r\n_readMessageStoreForAnalytics => GET ${endpoint}\r\nRequest id: ${obj.get('rcrequestid')}`)
          }
          logger.writeLog(this.extensionId, `Params ${JSON.stringify(readParams)}`);
          logger.writeLog(this.extensionId, `Error message: ${e.message}`);
          this.analytics.analyticsData.task = "Interrupted"
        }
      }else{
        this.analytics.analyticsData.task = "Interrupted"
        console.log("_readMessageStoreForAnalytics() - Platform error")
      }
    },
    // analytics end
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
        fileContent = "Id,From,To,Creation Time (UTC),Last Updated Time (UTC),Message Status,Error Code, Error Description, Cost,Segment,Direction,Text"
        var timeOffset = parseInt(req.query.timeOffset)
        let dateOptions = { weekday: 'short' }
        for (var item of this.batchFullReport){
          var from = formatPhoneNumber(item.from)
          var to = formatPhoneNumber(item.to[0])
          var cost = (item.hasOwnProperty('cost')) ? item.cost : 0.0
          var segmentCount = (item.hasOwnProperty('segmentCount')) ? item.segmentCount : 0
          var errorCode = "-"
          var errorDes = "-"
          if (item.hasOwnProperty('errorCode')){
            errorCode = item.errorCode
            errorDes = getErrorDescription(errorCode)
          }
          fileContent += `\n${item.id},${from},${to},${item.creationTime},${item.lastModifiedTime}`
          fileContent += `,${item.messageStatus},${errorCode},"${errorDes}",${cost},${segmentCount}`
          fileContent += `,${item.direction},"${item.text}"`
        }
      }
      try{
        fs.writeFileSync('./'+ fullNamePath, fileContent)
        var link = "/downloads?filename=" + fullNamePath
        console.log("link: " + link)
        this.userActivities.message_store_downloads.count++
        this.userActivities.message_store_downloads.ts = new Date().getTime()
        database.updateUserMonitorActivities(this.extensionId, this.userActivities)
        res.send({
          status:"ok",
          message:link
        })

        // delete in 20 secs
        var deleteFile = `./${fullNamePath}`
        setTimeout(function(){
          if (fs.existsSync(deleteFile))
            fs.unlinkSync(deleteFile)
        }, 20000, deleteFile)

      }catch (e){
        console.log("downloadHVMessageStore() - cannot create report file")
        res.send({
          status:"error",
          message:"Cannot create a report file! Please try gain"
        })
      }
    },
    cancelScheduledCampaign: function(req, res){
      console.log("cancelScheduledCampaign")
      if (this.eventEngine){
        this.eventEngine.cancelScheduledCampaign(req.query.creationTime, (err, result) => {
          console.log(result)
          if (err)
            res.send({status:"error",message:"Cannot deleted"})
          else
            res.send({status:"ok",message:"cancelled"})
        })
      }
    },
    downloadInvalidNumbers: function(req, res){
      var dir = "reports/"
      if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
      }
      var name = decodeURIComponent(req.query.campaign_name).replace(/#/g, "")
      var fullNamePath = dir + name.replace(/[\/\s]/g, "-")
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

            // delete in 20 secs
            var deleteFile = `./${fullNamePath}`
            setTimeout(function(){
              if (fs.existsSync(deleteFile))
                fs.unlinkSync(deleteFile)
            }, 20000, deleteFile)

          }catch (e){
            console.log("downloadInvalidNumbers() - cannot create download file")
            res.send({
              status:"error",
              message:"Cannot create download file! Please try gain"})
          }
        }else{ // no history
          console.log("downloadInvalidNumbers() - not found")
          res.send({
            status: "error",
            message: "Not found!",
          })
        }
      })
    },
    _createReportFile: async function(query, pageToken){
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
              thisUser._createReportFile(query, jsonObj.paging.nextPageToken)
            }, 1200)
          }else{
            console.log("No next page => create report done")
            this.downloadLink = link
            this.createReportStatus = 'done'
            //callback(null, link)
          }
        } catch (e) {
          console.log('Endpoint: GET ' + endpoint)
          console.log('Params: ' + JSON.stringify(params))
          console.log(e.response.headers)
          console.log('ERR ' + e.message);
          this.createReportStatus = 'error'
        }
      }else{
        console.log("create report failed")
        this.createReportStatus = 'failed'
      }
    },
    writeToFile: function(query, records, appendFile){
      var dir = "reports/"
      if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
      }
      var name = decodeURIComponent(query.campaignName).replace(/#/g, "")
      name = name.replace(/[\/\s]/g, "-")
      var fullNamePath = dir + name
      console.log(`fullNamePath ${fullNamePath}`)
      var fileContent = ""
      fullNamePath += '-campaign-report.csv'
      if (appendFile == false)
        fileContent = "Id,From,To,Creation Time,Last Updated Time,Message Status,Error Code,Error Description,Cost,Segment"
      var timeOffset = parseInt(query.timeOffset)
      let dateOptions = { weekday: 'short' }
      for (var item of records){
        //console.log(item)
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
        fileContent +=  `,${item.messageStatus},${errorCode},"${errorDes}",${cost},${segmentCount}`
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
      return "/downloads?filename=" + fullNamePath
    },
    downloadBatchReport: function(req, res){
      console.log("downloadBatchReport")
      if (this.createReportStatus != 'idle'){
        var response = {
          status: 'reading',
          message: ''
        }
        if (this.createReportStatus == 'done'){
          response.status = 'ok'
          response.message = this.downloadLink
          this.createReportStatus = 'idle'
          this.downloadBatchId = ''
          // delete in 20 secs
          var fullNamePath = this.downloadLink.split("=")[1]
          console.log(fullNamePath)
          var deleteFile = `./${fullNamePath}`
          setTimeout(function(){
            if (fs.existsSync(deleteFile))
              fs.unlinkSync(deleteFile)
          }, 20000, deleteFile)

          this.userActivities.campaigns_logs.download_count++
          this.userActivities.campaigns_logs.ts = new Date().getTime()
          database.updateUserMonitorActivities(this.extensionId, this.userActivities)
        }else if (this.createReportStatus == 'error'){
          response.status = 'error'
          response.message = 'Failed to read campaign report. Please retry!'
          this.createReportStatus = 'idle'
          this.downloadBatchId = ''
        }else if (this.createReportStatus == 'failed'){
          response.status = 'failed'
          response.message = 'You have been logged out. Please login again.'
          this.createReportStatus = 'idle'
          this.downloadBatchId = ''
        }
        console.log(response.message)
        res.send(response)
      }else{
        if (this.downloadBatchId == ''){
          this.downloadBatchId = req.query.batchId
          this.createReportStatus = 'reading'
          this.downloadLink = ''
          this._createReportFile(req.query, "")
          var response = {
            status: 'reading',
            message: ''
          }
          res.send(response)
        }else{
          // cancel previous reading
          console.log('previous report is pending')
          var response = {
            status: 'error',
            message: 'Busy'
          }
          res.send(response)
        }
      }
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
          thisUser.userActivities.campaigns_logs.delete_count++
          thisUser.userActivities.campaigns_logs.ts = new Date().getTime()
          database.updateUserMonitorActivities(thisUser.extensionId, thisUser.userActivities)
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
        res.send({
          status:"ok",
          message:link
        })
        var deleteFile = `./${fullNamePath}`
        setTimeout(function(){
          if(fs.existsSync(deleteFile))
            fs.unlinkSync(deleteFile)
        }, 20000, deleteFile)

        this.userActivities.standard_sms.download_count++
        this.userActivities.standard_sms.ts = new Date().getTime()
        database.updateUserMonitorActivities(this.extensionId, this.userActivities)
      }catch (e){
        console.log("cannot create report file")
        res.send({
          status: "error",
          message: "Cannot create a report file! Please try gain"
        })
      }
    },
    logout: async function(callback){
      console.log("LOGOUT FUNC")
      logger.writeLog(this.extensionId, `----- time: ${new Date().toISOString()} -----\r\nLogout`)
      if (this.eventEngine.scheduledSendAtArr.length > 0){
        logger.writeLog(this.extensionId, `There is ${this.eventEngine.scheduledSendAtArr.length} scheduled campaign`)
        this.eventEngine.changeOwner("autoStart")
        if (this.processingBatches.length > 0){
          logger.writeLog(this.extensionId, `There is ${this.processingBatches.length} pending campaign`)
          this.autoDelele = true
          callback(null, 0)
        }else
          callback(null, 1)
      }else{
        if (this.processingBatches.length == 0){
          // delete subscription
          await this.deleteSubscription()
          var p = await this.rc_platform.getPlatform(this.extensionId)
          if (p)
            await p.logout()
          else
            console.log("No platform?")
          // may need to clear tokens and destroy eventEngine etc.
          this.userActivities.currentPresence = 'offline'
          this.subscriptionId = ""
          this.updateActiveUserSubscription()
          this.rc_platform.updateUserAccessTokens("")
          var activeUsers = router.getActiveUsers()
          var index = activeUsers.findIndex(o => o.extensionId.toString() === this.extensionId.toString())
          console.log("Remove active user")
          activeUsers.splice(index, 1)
          callback(null, 1)
        }else{
          logger.writeLog(this.extensionId, `There is ${this.processingBatches.length} pending campaign`)
          this.autoDelele = true
          callback(null, 0)
        }
      }
    },
    readBatchReportFromDB: function(batchId, callback){
      var query = `SELECT batches FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (!err && result.rows.length > 0){
          var batch = undefined
          if (result.rows[0].batches.length){
            batches = JSON.parse(result.rows[0].batches)
            batch = batches.find(o => o.batchId == batchId)
          }
          callback(null, batch)
        }else{ // no history
          callback(null, undefined)
        }
      })
    },
    readCampaignsLogFromDB: function(res){
      var thisUser = this
      var batches = []
      var query = `SELECT batches FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (!err && result.rows.length > 0){
          if (result.rows[0].batches.length){
            batches = JSON.parse(result.rows[0].batches)
            batches.sort(sortBatchCreatedDate)
          }
          thisUser.batchSummaryReport = batches[0]
        }
        res.send({
            status: "ok",
            campaigns: batches,
            recentBatch: thisUser.batchSummaryReport
          })
      })
    },
    // Notifications
    subscribeForNotification: async function(eventFilters, callback){
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        var endpoint = '/restapi/v1.0/subscription'
        console.log(process.env.WEBHOOK_DELIVERY_ADDRESS)
        try {
          var resp = await p.post('/restapi/v1.0/subscription', {
            eventFilters: eventFilters,
            deliveryMode: {
              transportType: 'WebHook',
              address: process.env.WEBHOOK_DELIVERY_ADDRESS
            },
            expiresIn: process.env.WEBHOOK_EXPIRES_IN
          })
          var jsonObj = await resp.json()
          console.log("Ready to receive telephonyStatus notification via WebHook.")
          this.subscriptionId = jsonObj.id
          //thisUser.eventEngine.subscriptionId = thisUser.subscriptionId
          console.log("Subscription created")
          console.log(this.subscriptionId)
          if (this.eventEngine)
            this.eventEngine.subscriptionId = this.subscriptionId
          this.updateActiveUserSubscription()
          callback(null, jsonObj.id)
        } catch (e) {
          if (e.response){
            var obj = e.response.headers
            logger.writeLog(this.extensionId, `----- time: ${new Date().toISOString()} -----\r\nsubscribeForNotification => POST ${endpoint}\r\nRequest id: ${obj.get('rcrequestid')}`)
          }
          logger.writeLog(this.extensionId, `EventFilters: ${JSON.stringify(eventFilters)}`)
          logger.writeLog(this.extensionId, `Error message: ${e.message}`);
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
          if (e.response){
            var obj = e.response.headers
            logger.writeLog(this.extensionId, `----- time: ${new Date().toISOString()} -----\r\nrenewNotification => POST ${endpoint}\r\nRequest id: ${obj.get('rcrequestid')}`)
          }
          logger.writeLog(this.extensionId, `Error message: ${e.message}`);
          var eventFilters = []
          var filter = ""
          for (var item of this.phoneHVNumbers){
            filter = `/restapi/v1.0/account/~/a2p-sms/messages?direction=Inbound&to=${item.number}`
            eventFilters.push(filter)
            filter = `/restapi/v1.0/account/~/a2p-sms/batches?from=${item.number}`
            eventFilters.push(filter)
          }
          this.subscribeForNotification(eventFilters, (err, res) => {
            if (!err)
              callback(null, res)
          })
        }
      }else{
        console.log("err: renewNotification");
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
          filter = `/restapi/v1.0/account/~/a2p-sms/batches?from=${item.number}`
          eventFilters.push(filter)
          if (outbound){
            filter = `/restapi/v1.0/account/~/a2p-sms/messages?direction=Outbound&from=${item.number}`
            eventFilters.push(filter)
            /*
            // keep subscribe for batch if there is/are pending campaigns
            if (this.processingBatches.length){
              console.log('keep batch notification')
              filter = `/restapi/v1.0/account/~/a2p-sms/batches?from=${item.number}`
              eventFilters.push(filter)
            }
            */
          }
          /*
          else{
            filter = `/restapi/v1.0/account/~/a2p-sms/batches?from=${item.number}`
            eventFilters.push(filter)
          }
          */
        }

        var endpoint = `/restapi/v1.0/subscription/${this.subscriptionId}`
        try {
          var resp = await p.put(endpoint, {
            eventFilters: eventFilters,
            deliveryMode: {
              transportType: 'WebHook',
              address: process.env.WEBHOOK_DELIVERY_ADDRESS
            },
            expiresIn: process.env.WEBHOOK_EXPIRES_IN
          })
          var jsonObj = await resp.json()
          this.subscriptionId = jsonObj.id
          logger.writeLog(this.extensionId, `----- time: ${new Date().toISOString()} -----\r\nupdateNotification successfully`)
          logger.writeLog(this.extensionId, `EventFilters: ${JSON.stringify(eventFilters)}`)
          callback(null, jsonObj.id)
        } catch (e) {
          if (e.response){
            var obj = e.response.headers
            logger.writeLog(this.extensionId, `----- time: ${new Date().toISOString()} -----\r\nupdateNotification => POST ${endpoint}\r\nRequest id: ${obj.get('rcrequestid')}`)
          }
          logger.writeLog(this.extensionId, `EventFilters: ${JSON.stringify(eventFilters)}`)
          logger.writeLog(this.extensionId, `Error message: ${e.message}`);
          callback(e.message, eventFilters)
        }
      }else{
        console.log("err: updateNotification");
        callback("err", null)
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

        this.userActivities.standard_sms.count++
        this.userActivities.standard_sms.total_messages += this.recipientArr.length
        this.userActivities.standard_sms.ts = new Date().getTime()
        database.updateUserMonitorActivities(this.extensionId, this.userActivities)

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
        res.send({
          status: "ok",
          message: "pause sending"
        })
      }else
        res.send({
          status:"error",
          message:"cannot pause sending"
        })
    },
    resumeMessageSending: function(req, res){
      if (this.intervalTimer != null){
        console.log("resumeMessageSending")
        this.sendMessages()
        res.send({status: "ok", message: "resume sending"})
      }else
        res.send({status: "failed", message: "cannot resume sending"})
    },
    cancelMessageSending: function(req, res){
      if (this.intervalTimer != null){
        console.log("cancelMessageSending")
        clearInterval(this.intervalTimer);
        this.intervalTimer = null
      }
      res.send({status:"ok", message:"cancel timer"})
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
    /*setReputation: function(req, res){
      console.log("setReputation")
      var query = `UPDATE a2p_sms_users SET reputation_score=${parseInt(req.body.score)} WHERE user_id='${req.body.user_id}'`
      pgdb.update(query, (err, result) => {
        if (err){
          console.error(err.message);
        }
        res.send({status:"ok", result: "Completed!"})
      })
    },*/
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
    _readReputationScore: function(callback){
      var thisUser = this
      var query = `SELECT reputation_score FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
        }
        if (!err && result.rows.length > 0){
          //thisUser.reputationScore = parseInt(result.rows[0].reputation_score)
          var check = result.rows[0].reputation_score
          if (isNaN(check)){
            thisUser.numberReputation = JSON.parse(result.rows[0].reputation_score)
            if (thisUser.numberReputation.length == 0){
              console.log("Grant max score" )
              for (var number of thisUser.phoneHVNumbers){
                var item = {
                  number: number.number,
                  score: 1000
                }
                thisUser.numberReputation.push(item)
              }
              console.log(thisUser.phoneHVNumbers)
              console.log(thisUser.numberReputation)
              var query = `UPDATE a2p_sms_users SET reputation_score='${JSON.stringify(thisUser.numberReputation)}' WHERE user_id='${thisUser.extensionId}'`
              pgdb.update(query, (err, result) =>  {
                if (err){
                  console.error(err.message);
                }
                console.log("granted max score and updated new score syntax")
              })
            }
          }else{
            console.log("Conversion...")
            var score = parseInt(result.rows[0].reputation_score)
            for (var number of thisUser.phoneHVNumbers){
              var item = {
                number: number.number,
                score: score
              }
              thisUser.numberReputation.push(item)
            }
            console.log(thisUser.numberReputation)
            // update new score syntax
            var query = `UPDATE a2p_sms_users SET reputation_score='${JSON.stringify(thisUser.numberReputation)}' WHERE user_id='${thisUser.extensionId}'`
            //console.log(query)
            pgdb.update(query, (err, result) =>  {
              if (err){
                console.error(err.message);
              }
              console.log("updated new score syntax")
            })
          }
          console.log(`User reputation score: ${result.rows[0].reputation_score}`)
        }
        callback(null, "ok")
      })
    },
    _updateCampaignDB: function(batchReport, callback){
      console.log("_updateCampaignDB")
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
            var batchesStr = JSON.stringify(batches)
            batchesStr = batchesStr.replace(/'/g, "''")
            var query = `UPDATE a2p_sms_users SET batches='${batchesStr}', reputation_score='${JSON.stringify(thisUser.numberReputation)}' WHERE user_id='${thisUser.extensionId}'`
            //console.log(query)
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
        var query = "INSERT INTO a2p_sms_users_tempdata (user_id, rejected_numbers, scheduled_campaigns)"
        query += " VALUES ($1,$2,$3)"
        //var tokenStr = this.rc_platform.getTokens()
        var values = [this.extensionId, JSON.stringify(rejectNumbers), '[]']
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
    },
    sendInviteToSupportTeam: async function(req, res){
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try {
          var userInvite = [ req.body.userInvite || '' ];
          var userList = [userInvite]
          //userList.push();
          var resp = await p.post('/restapi/v1.0/glip/groups/' + process.env.SUPPORT_TEAM_ID + '/bulk-assign',{
                        "addedPersonEmails": userInvite
          })
          var jsonObj = await resp.json()
          console.log('The response is :', jsonObj);
          console.log('The total number of users invited to the group is :'+ userList.length);
          console.log('The total number of users registered in the group is :'+jsonObj.members.length);
          console.log("The type of data is :" + typeof userList.length);
          res.send(userList.length.toString());
        }
        catch(e) {
          console.log('INVITE USER DID NOT WORK');
          console.log(e);
          res.send({status: "error", message: "Cannot join group"});
        }
      }else{
        console.log("need login")
        res.send({status: "failed", message: "Not login"});
      }
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
  "SMS-RC-410": "Destination number unsupported",
  "SMS-RC-413": "Destination subscriber opted out",
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
    if (startPos >= 0){
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
    }else{
      return row
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

function post_alert_to_group(thisUser){
  var https = require('https');
  var message = `User main company number: ${thisUser.mainCompanyNumber}`
  for (var numberObj of thisUser.numberReputation){
    message += `\nHV SMS number: ${formatPhoneNumber(numberObj.number)} - Reputation score: ${numberObj.score}`
  }
  message += `\nAccount Id: ${thisUser.accountId} - Extension Id: ${thisUser.extensionId}`
  message += `\nUser contact email: ${thisUser.userEmail}`
  message += `\nSalesforce lookup: https://rc.my.salesforce.com/_ui/search/ui/UnifiedSearchResults?str=${thisUser.accountId}`
  message += `\nAI admin lookup: https://admin.ringcentral.com/userinfo/csaccount.asp?user=XPDBID++++++++++${thisUser.accountId}User`

  var body = {
    "icon": "http://www.qcalendar.com/icons/alert.png",
    "activity": "High Volume SMS spammer alert",
    "title": `User name: ${thisUser.userName}`,
    "body": message
  }
  var post_options = {
      host: "hooks.ringcentral.com",
      path: `/webhook/${process.env.ABUSED_INBOUND_WEBHOOK}`,
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
  return b.creationTime - a.creationTime;
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
