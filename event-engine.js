const pgdb = require('./db')

function ActiveUser(extensionId, subscriptionId){
  this.extensionId = extensionId
  this.subscriptionId = subscriptionId
  this.webhooks = undefined
  this.voteCampaignArr = []
  this.logNewMessage = false
  this.newMessageArr = []
  this.rc_platform = undefined
  this.autoDeleteTimer = undefined
  this.updateStatusTimer = undefined
  this.deleteInterval = 3600000 // 1hr
  this.updateInterval = 60000 // 1 min
}

var engine = ActiveUser.prototype = {
    setup: function(platform, callback){
      console.log("setup ActiveUser Engine")
      this.rc_platform = platform
      var thisUser = this
      this.loadVoteDataFromDB(async (err, result) => {
        if (!err){
          if (result > 0){
            this.autoDeleteTimer = setInterval(function(){
              thisUser.autoDeleteVoteCampaign()
            }, this.deleteInterval)
            this.updateStatusTimer = setInterval(function(){
              thisUser.detectExpiredVoteCampaign()
            }, this.updateInterval)
            console.log("result: " + result)
            thisUser.readWebhookInfoFromDB( async (err, res) => {
              await thisUser.deleteExtraSubscriptions(false)
              callback(null, result)
            })
          }else{
            // delete all subscriptions
            await thisUser.deleteExtraSubscriptions(false)
            callback(null, result)
          }
        }else{
          callback(err, result)
        }
      })
      //thisUser.readWebhookInfoFromDB( async (err, res) => {})
    },
    autoSetup: function(platform, callback){
      console.log("setup ActiveUser Engine")
      this.rc_platform = platform
      var thisUser = this
      this.loadVoteDataFromDB(async (err, result) => {
        if (!err){
          if (result > 0){
            this.autoDeleteTimer = setInterval(function(){
              thisUser.autoDeleteVoteCampaign()
            }, this.deleteInterval)
            this.updateStatusTimer = setInterval(function(){
              thisUser.detectExpiredVoteCampaign()
            }, this.updateInterval)
            console.log("result: " + result)
            thisUser.readWebhookInfoFromDB( async (err, res) => {
              await thisUser.deleteExtraSubscriptions(false)
              callback(null, result)
            })
          }else{
            // delete all subscriptions
            await thisUser.deleteExtraSubscriptions(true)
            callback(null, result)
          }
        }else{
          callback(err, result)
        }
      })
      //thisUser.readWebhookInfoFromDB( async (err, res) => {})
    },
    setVoteInfo: function (voteInfo){
      this.voteCampaignArr.push(voteInfo)
      var thisUser = this
      if (!this.autoDeleteTimer)
        this.autoDeleteTimer = setInterval(function(){
          thisUser.autoDeleteVoteCampaign()
        }, this.deleteInterval)

      if (!this.updateStatusTimer)
        this.updateStatusTimer = setInterval(function(){
          thisUser.detectExpiredVoteCampaign()
        }, this.updateInterval)

      this.updateVoteDataInDB((err, res) => {
        console.log(res)
      })
      if (!this.webhooks){
        this.readWebhookInfoFromDB((err, res) => {
          console.log("readWebhookInfoFromDB")
          console.log(res)
        })
      }
      //console.log(JSON.stringify(this.voteCampaignArr))
    },
    getCopyVoteCampaignsInfo: function(){
      var voteInfoList = []
      for (var campaign of this.voteCampaignArr){
        var voteInfo = {
            campaignName: campaign.campaignName,
            serviceNumber: campaign.serviceNumber,
            startDateTime: campaign.startDateTime,
            endDateTime: campaign.endDateTime,
            status: campaign.status,
            batchId: campaign.batchId,
            message: campaign.message,
            voteResults: campaign.voteResults,
            voteCounts: campaign.voteCounts
        }
        voteInfoList.push(voteInfo)
      }
      return voteInfoList
    },
    getCampaignByBatchId: function(batchId){
      for (var campaign of this.voteCampaignArr){
        if (campaign.batchId == batchId)
          return campaign
      }
      return null
    },
    setCampainByBatchId: function(batchId, campaign){
      for (var item of this.voteCampaignArr){
        if (item.batchId == batchId){
          item = campaign
        }
      }
      this.updateVoteDataInDB((err, res) => {
          if (err){
            console.log("cannot update db " + err)
          }else{
            console.log("add new vote to tempdata")
            console.log(res)
          }
      })
    },
    deleteCampaignByBatchId: function(batchId, callback){
      for (var i = this.voteCampaignArr.length; i--;) {
        var campaign = this.voteCampaignArr[i]
        if (campaign.batchId == batchId){
          console.log("User click delete")
          var status = (campaign.status == "Active") ? "Cancelled" : campaign.status
          var voteReport = {
            batchId: campaign.batchId,
            voteReport: {
              status: status,
              voteResults: campaign.voteResults,
              voteCounts: campaign.voteCounts
            }
          }
          this.updateCampaignDataInDB([voteReport], (err, result) => {
            this.voteCampaignArr.splice(i, 1);
            this.updateVoteDataInDB((err, res) => {
              if (err){
                console.log("cannot update db " + err)
                callback(err, res)
              }else{
                callback(null, res)
              }
            })
          })
          return
        }else{
          return callback("err", "")
        }
      }
      callback("err", "")
    },
    setPlatform: function(p){
      if (this.rc_platform){
        console.log("REPLACE SDK PLATFORM")
      }
      this.rc_platform = p
    },
    processNotification: function(jsonObj){
      //console.log(jsonObj)
      var body = jsonObj.body
      var notFound = true
      // seach for the "from" number within those campaigns
      for (var campaign of this.voteCampaignArr){
        if (campaign.serviceNumber != body.to[0]){
          continue
        }else{
          if (campaign.status == "Closed") continue;

          var voter = campaign.voterList.find(o => o.phoneNumber == body.from)
          //console.log(voter)
          if (voter != undefined){
            if (campaign.status == "Completed" /*&& !campaign.allowCorrection*/){
              continue
            }else{
              notFound = false
              // process this vote campaign
              console.log("Processing response")
              if (this.processThisCampaign(campaign, voter, body)){
                console.log("Processed")
                break
              }else{
                console.log("process next campaign if any")
              }
            }
          }else continue;
        }
      }
      //
      if (notFound && this.logNewMessage)
        this.newMessageArr.push(body)
    },
    processThisCampaign: function(campaign, voter, body){
        var cost = (body.hasOwnProperty('cost')) ? body.cost : 0.0
        campaign.voteCounts.Cost += cost
        var now = new Date().getTime()
        if (now > campaign.endDateTime){
          console.log("vote has been closed")
          if (campaign.status == "Active"){
            // close now
            campaign.status = "Closed"
            var postData = {
              dataType: "Survey_Result",
              result: campaign
            }
            this.postResults(postData)
            this.updateVoteDataInDB((err, res) => {
              console.log(res)
            })
          }
          return true
        }
        var needUpdateDd = false
        var processed = false
        if (!voter.isReplied){
          for (var command of campaign.voteCommands){
            if (body.text.trim().toLowerCase() == command.toLowerCase()){
              processed = true
              campaign.voteCounts.Replied++
              voter.isReplied = true
              voter.repliedTime = new Date().getTime()
              voter.repliedMessage = command
              campaign.voteResults[command]++
              //console.log("Client reply message: " + body.text)
              //console.log(campaign.autoReply)
              if (campaign.autoReply == true){
                var repliedMsg = campaign.autoReplyMessages[command]
                if (repliedMsg != undefined){
                  var requestBody = {
                      from: body.to[0],
                      text: repliedMsg,
                      messages: [{to:[body.from]}]
                  }
                  campaign.voteCounts.Cost += 0.007
                  this.sendMessage(requestBody)
                }
              }
              needUpdateDd = true
              break
            }
          }
          if (voter.repliedMessage == ""){
            console.log("Client reply message not match: " + body.text)
            var repliedWords = body.text.trim().split(" ")
            if (repliedWords.length == 1) { // possibly typo mistake
              // => resend reminder
              var requestBody = {
                  from: body.to[0],
                  text: "Please reply with a correct response!",
                  messages: [{to:[body.from]}]
              }
              campaign.voteCounts.Cost += 0.007
              this.sendMessage(requestBody)
            }else{
              voter.repliedMessage = body.text
              needUpdateDd = true
            }
          }
        }else if(campaign.allowCorrection){
          for (var command of campaign.voteCommands){
            if (body.text.trim().toLowerCase() == command.toLowerCase()){
              processed = true
              campaign.voteResults[voter.repliedMessage]--
              voter.repliedMessage = command
              campaign.voteResults[command]++
              console.log("Client correction message: " + body.text)
              if (campaign.autoReply){
                var repliedMsg = campaign.autoReplyMessages[command]
                var requestBody = {
                    from: body.to[0],
                    text: repliedMsg,
                    messages: [{to:[body.from]}]
                }
                campaign.voteCounts.Cost += 0.007
                this.sendMessage(requestBody)
              }
              needUpdateDd = true
              break
            }
          }
          console.log(campaign.voterList)
          console.log(campaign)
          console.log("======")
        }
        if (campaign.voteCounts.Delivered == campaign.voteCounts.Replied){
          campaign.status = "Completed"
          needUpdateDd = true
          var postData = {
            dataType: "Survey_Result",
            result: campaign
          }
          this.postResults(postData)
        }
        if (needUpdateDd)
          this.updateVoteDataInDB((err, res) => {
            console.log(res)
          })
        return processed
    },
    sendMessage: async function(requestBody){
      if (this.rc_platform == undefined)
        return
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try {
          var resp = await p.post("/restapi/v1.0/account/~/a2p-sms/batch", requestBody)
          console.log("Auto-reply succeeded")
        }catch(e) {
          console.log("Auto-reply error")
        }
      }
    },
    loadVoteDataFromDB: function(callback){
      var thisUser = this
      var query = `SELECT active_survey FROM a2p_sms_users_tempdata WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
          return callback(err, err.message)
        }
        if (!err && result.rows.length > 0){
          thisUser.voteCampaignArr = JSON.parse(result.rows[0].active_survey)
          //console.log(thisUser.voteCampaignArr)
          callback(null, thisUser.voteCampaignArr.length)
        }else{
          callback(null, 0)
        }
      })
    },
    autoDeleteVoteCampaign: function(){ // call via timer every hr
      console.log("autoDeleteVoteCampaign")
      var now = new Date().getTime()
      var deleting = false
      var archiveVoteList = []
      for (var i = this.voteCampaignArr.length; i--;){
        var campaign = this.voteCampaignArr[i]
        var twentyFourHrs = (now - campaign.endDateTime) / 1000
        console.log(twentyFourHrs)
        if (twentyFourHrs > 86400){ //86400
          console.log("create voteInfo for achiving")
          var voteReport = {
            batchId: campaign.batchId,
            voteReport: {
              status: campaign.status,
              voteResults: campaign.voteResults,
              voteCounts: campaign.voteCounts
            }
          }
          archiveVoteList.push(voteReport)
          console.log("Delete after closed/completed for 24 hours")
          this.voteCampaignArr.splice(i, 1);
          if (this.voteCampaignArr.length == 0){
            clearInterval(this.autoDeleteTimer)
          }
          deleting = true
        }
      }
      var thisUser = this
      if (deleting) {
        thisUser.updateCampaignDataInDB(archiveVoteList)
        this.updateVoteDataInDB((err, res) => {
          console.log(res)
        })
      }
    },
    detectExpiredVoteCampaign: function(){ // call via timer every minute
      var now = new Date().getTime()
      var changed = false
      var hasActive = false
      for (var i = this.voteCampaignArr.length; i--;){
        var campaign = this.voteCampaignArr[i]
        if (campaign.status == "Active"){
          hasActive = true
          console.log(now + " == " + campaign.endDateTime)
          if (now > campaign.endDateTime){
            campaign.status = "Closed"
            changed = true
            var postData = {
              dataType: "Survey_Result",
              result: campaign
            }
            this.postResults(postData)
          }
        }
      }
      if (!hasActive){
        clearInterval(this.updateStatusTimer)
      }
      console.log("detectExpiredVoteCampaign")
      if (changed)
        this.updateVoteDataInDB((err, res) => {
          console.log(res)
        })
    },
    readWebhookInfoFromDB: function(callback){
      var thisUser = this
      var query = `SELECT webhooks FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
        }
        if (!err && result.rows.length > 0){
          if (result.rows[0].webhooks){
            thisUser.webhooks = JSON.parse(result.rows[0].webhooks)
            console.log(thisUser.webhooks.url)
          }
        }else{ // no connector
          thisUser.webhooks = undefined
        }
        callback(null, "ok")
      })
    },
    updateVoteDataInDB: function(callback){
      /*
      var query = 'UPDATE a2p_sms_users_tempdata SET '
      query += "active_survey='" + JSON.stringify(this.voteCampaignArr) + "' WHERE user_id='" + this.extensionId + "'"
      //console.log(query)
      pgdb.update(query, (err, result) =>  {
        if (err){
          console.error(err.message);
        }
        callback(null, "updated vote campaign data")
      })
      */
      var query = "INSERT INTO a2p_sms_users_tempdata (user_id, active_survey, rejected_numbers)"
      query += " VALUES ($1,$2,$3)"
      var activeServeys = JSON.stringify(this.voteCampaignArr)
      activeServeys = activeServeys.replace(/'/g, "''")
      var values = [this.extensionId, activeServeys, '[]']
      query += ` ON CONFLICT (user_id) DO UPDATE SET active_survey='${activeServeys}'`
      pgdb.insert(query, values, (err, result) =>  {
        if (err){
          console.error(err.message);
          console.log("QUERY: " + query)
          callback(err, "Cannot update survey data")
        }else{
          console.log("updateVoteDataInDB DONE");
          callback(null, "ok")
        }
      })
    },
    updateCampaignDataInDB: function(archiveVoteList, callback){
      var thisUser = this
      var query = `SELECT batches FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
        }
        if (!err && result.rows.length > 0){
          var allCampaigns = JSON.parse(result.rows[0].batches)
          for (var campaign of allCampaigns){
            for (var vote of archiveVoteList){
              if (campaign.batchId == vote.batchId){
                campaign['voteReport'] = vote.voteReport
                break
              }
            }
          }
          // write back to database
          var batchesStr = JSON.stringify(allCampaigns)
          batchesStr = batchesStr.replace(/'/g, "''")
          var query = `UPDATE a2p_sms_users SET batches='${batchesStr}' WHERE user_id='${thisUser.extensionId}'`
          //console.log(query)
          pgdb.update(query, (err, result) => {
            if (err){
              console.log("Error?")
            }
            console.log("Archive vote done")
            callback(null, "done")
          })
        }else{
          callback(err, "")
        }
      })
    },
    postResults: function (data){
      if (this.webhooks == undefined || this.webhooks.url == "")
        return
      var https = undefined;
      var url = ""
      if (this.webhooks.url.indexOf("https://") >= 0){
        https = require('https');
        url = this.webhooks.url.replace("https://", "")
      }else{
        var https = require('http');
        url = this.webhooks.url.replace("http://", "")
      }
      var content = JSON.stringify(data)
      var arr = url.split("/")
      var domain = arr[0]
      var path = `/${arr[1]}`
      var post_options = {
          host: domain,
          path: path,
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': content.length
          }
      }
      if (this.webhooks.headerName.length && this.webhooks.headerValue.length){
        post_options.headers[`${this.webhooks.headerName}`] = this.webhooks.headerValue
      }

      try{
        var post_req = https.request(post_options, function(res) {
            var response = ""
            res.on('data', function (chunk) {
                response += chunk
            });
            res.on("end", function(){
              console.log(response)
            });
        });

        post_req.write(content);
        post_req.end();
      }catch(e){
        console.log("CRASHED POST RESULT")
        console.log(e.message)
      }
    },
    /// Clean up WebHook subscriptions
    deleteExtraSubscriptions: async function(deleteCurrentSubscription) {
      if (this.rc_platform == undefined)
        return

      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try{
          var resp = await p.get('/restapi/v1.0/subscription')
          var jsonObj = await resp.json()
          if (jsonObj.records.length > 0){
            for (var record of jsonObj.records) {
              //console.log(JSON.stringify(record.eventFilters))
              if (record.deliveryMode.transportType == "WebHook"){
                if (record.id != this.subscriptionId){
                  for (var ev of record.eventFilters){
                    if (ev.indexOf("/a2p-sms/") >= 0){
                      var r =  await p.delete(`/restapi/v1.0/subscription/${record.id}`)
                      console.log(`Deleted id: ${record.id}`)
                      break
                    }
                  }
                }else{
                  if (deleteCurrentSubscription && this.subscriptionId != ""){
                    var r =  await p.delete(`/restapi/v1.0/subscription/${this.subscriptionId}`)
                    console.log(`Deleted current subscription: ${this.subscriptionId}`)
                    this.subscriptionId = ""
                    this.updateActiveUserSubscription()
                  }else
                    console.log(`my only subscription ${this.subscriptionId}`)
                  /*
                  this.updateNotification(record.eventFilters, (err, res) => {
                    console.log("update")
                  })
                  */
                }
              }
            }
            console.log("Done deleting extra subsscriptions")
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
    updateNotification: async function(eventFilters, callback){
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        //var eventFilters = [`/restapi/v1.0/account/~/a2p-sms/messages?direction=Inbound`]
        console.log(eventFilters)
        try {
          var resp = await p.put(`/restapi/v1.0/subscription/${this.subscriptionId}`, {
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
          console.log('ERR ' + e.message);
          callback(e.message, "failed")
        }
      }else{
        console.log("err: updateNotification");
        callback("err", "failed")
      }
    },
    updateActiveUserSubscription: function() {
      console.log("updateActiveUserSubscription")
      var query = `UPDATE a2p_sms_users SET subscription_id='${this.subscriptionId}' WHERE user_id='${this.extensionId}'`
      pgdb.update(query, (err, result) =>  {
        if (err){
          console.error(err.message);
        }
        console.log("updated TF batch data")
      })
    }
};

module.exports = ActiveUser;
