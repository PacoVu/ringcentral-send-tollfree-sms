const pgdb = require('./db')

function ActiveUser(extensionId, subscriptionId){
  this.extensionId = extensionId
  this.subscriptionId = subscriptionId
  this.webhooks = undefined
  this.voteCampaignArr = []
  this.incomingMessageArr = []
  this.rc_platform = undefined
}

var engine = ActiveUser.prototype = {
    ActiveUser: function(){
      //constructor
      console.log("Constructor call?")
    },
    setup: function(platform, callback){
      console.log("setup ActiveUser Engine")
      this.rc_platform = platform
      var thisUser = this
      this.loadVoteDataFromDB((err, changed) => {
        if (!err && changed){
          thisUser.updateVoteDataInDB((err, res) => {
            if (err){
              console.log("cannot update db")
            }
            console.log(res)
            callback(null, res)
          })
        }else{
          callback(err, "cannot read db")
        }

      })
      /*
      this.renewNotification((err, res) => {
        console.log("renewNotification Done")
      })
      */
      this.readWebhookInfoFromDB()
    },
    setVoteInfo: function (voteInfo, serviceNumber){
      var newCampaign = true
      for (var voteCampaign of this.voteCampaignArr){
        if (voteCampaign.serviceNumber == serviceNumber){
          // add to this serviceNumber array
          voteCampaign.campaigns.push(voteInfo)
          newCampaign = false
          break
        }
      }
      if (newCampaign){
        var voteCampaign = {
          serviceNumber: serviceNumber,
          campaigns: [voteInfo]
        }
        this.voteCampaignArr.push(voteCampaign)
      }
      this.updateVoteDataInDB((err, res) => {
        console.log(res)
      })
      console.log(JSON.stringify(this.voteCampaignArr))
    },
    getCampaignByBatchId: function(batchId){
      for (var voteCampaign of this.voteCampaignArr){
        for (var campaign of voteCampaign.campaigns){
          if (campaign.batchId == batchId){
            return campaign
          }
        }
      }
    },
    setCampainByBatchId: function(batchId, campaign){
      for (var voteCampaign of this.voteCampaignArr){
        for (var item of voteCampaign.campaigns){
          if (item.batchId == batchId){
            item = campaign
          }
        }
      }
    },
    deleteCampaignByBatchId: function(batchId, callback){
      for (var item of this.voteCampaignArr){
        for (var i = item.campaigns.length; i--;) {
          var campaign = item.campaigns[i]
          if (campaign.batchId == batchId){
            console.log("User click delete")
            item.campaigns.splice(i, 1);
            this.updateVoteDataInDB((err, res) => {
              if (err){
                console.log("cannot update db " + err)
                callback(err, res)
              }else{
                callback(null, res)
              }
            })
            return
          }else{
            return callback("err", "")
          }
        }
      }
      callback("err", "")
    },
    /*
    setVoteStatusChanges: function(batchId, voteInfo){
      for (var voteCampaign of this.voteCampaignArr){
        for (var campaign of voteCampaign.campaigns){
          if (campaign.batchId == batchId){
            // add to this serviceNumber array
            campaign.voteCounts.Cost = voteInfo.Cost
            campaign.voteCounts.Unreachable = voteInfo.Unreachable
            campaign.voteCounts.Delivered = voteInfo.Delivered
            break
          }
        }
      }
    },
    */
    setPlatform: function(p){
      this.rc_platform = p
    },
    processNotification: function(jsonObj){
      // parse tel notification payload
      console.log(jsonObj)
      var body = jsonObj.body
      // find vote object

      var voteCampaign = this.voteCampaignArr.find(o => o.serviceNumber == body.to[0])
      if (voteCampaign != undefined){ // found a campaign obj with this service number
        // seach for the "from" number within those campaigns
        for (var campaign of voteCampaign.campaigns){
          if (campaign.status == "Closed")
            continue
          if (campaign.status == "Completed" /*&& !campaign.allowCorrection*/)
            continue
          var voter = campaign.voterList.find(o => o.phoneNumber == body.from)
          console.log(voter)
          if (voter != undefined){
            // process this vote campaign
            console.log("Processing response")
            this.processThisCampaign(campaign, voter, body)
            break
          }
        }
      }
      //
      this.incomingMessageArr.push(body)
    },
    processThisCampaign: function(campaign, voter, body){
        var cost = (body.hasOwnProperty('cost')) ? body.cost : 0
        campaign.voteCounts.Cost += cost
        var now = new Date().getTime()
        if (now > campaign.endDateTime){
          console.log("vote has been closed")
          if (campaign.status == "Active"){
            campaign.status = "Closed"
            this.postResults(campaign)
            this.updateVoteDataInDB((err, res) => {
              console.log(res)
            })
          }
          return
        }
        var needUpdateDd = false
        if (!voter.isReplied){
          for (var command of campaign.voteCommands){
            if (body.text.trim().toLowerCase() == command.toLowerCase()){
              campaign.voteCounts.Replied++
              voter.isReplied = true
              voter.repliedTime = new Date().getTime()
              voter.repliedMessage = command
              campaign.voteResults[command]++
              console.log("Client reply message: " + body.text)
              console.log(campaign.autoReply)
              if (campaign.autoReply == true){
                var repliedMsg = campaign.autoReplyMessages[command]
                if (repliedMsg != undefined){
                  var requestBody = {
                      from: body.to[0],
                      text: repliedMsg,
                      messages: [{to:[body.from]}]
                  }
                console.log(requestBody)
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
                  text: "Please reply with a correct reponse!",
                  messages: [{to:[body.from]}]
              }
              this.sendMessage(requestBody)
            }else{
              voter.repliedMessage = body.text
              needUpdateDd = true
            }
          }
          console.log(campaign.voterList)
          console.log(campaign)
          //this.updateVoteDataInDB()
          console.log("======")
        }else if(campaign.allowCorrection){
          for (var command of campaign.voteCommands){
            if (body.text.trim().toLowerCase() == command.toLowerCase()){
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
                this.sendMessage(requestBody)
              }
              needUpdateDd = true
              //this.updateVoteDataInDB()
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
          this.postResults(campaign)
        }
        if (needUpdateDd)
          this.updateVoteDataInDB((err, res) => {
            console.log(res)
          })
    },
    sendMessage: async function(requestBody){
      var p = this.rc_platform.getPlatform()
      if (p){
        try {
          var resp = await p.post("/restapi/v1.0/account/~/a2p-sms/batch", requestBody)
          var jsonObj = await resp.json()
          console.log(jsonObj)
          console.log("Auto-reply succeeded")
        }catch(e) {
          console.log("Auto-reply error")
        }
      }
    },
    loadVoteDataFromDB: function(callback){
      var thisUser = this
      var query = `SELECT votes FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
          return callback(err, err.message)
        }
        if (!err && result.rows.length > 0){
          thisUser.voteCampaignArr = JSON.parse(result.rows[0].votes)
          var now = new Date().getTime()
          var changed = false
          for (var item of thisUser.voteCampaignArr){
            for (var i = item.campaigns.length; i--;) {
              var campaign = item.campaigns[i]
              console.log(campaign)
              var twentyFourHrs = (now - campaign.endDateTime) / 1000
              console.log(twentyFourHrs)
              if (campaign.status == "Active"){
                if (now > campaign.endDateTime){
                  campaign.status = "Closed"
                  changed = true
                }
              }else if (twentyFourHrs > 86400){ //86400
                console.log("Delete after closed/completed for 24 hours")
                item.campaigns.splice(i, 1);
                changed = true
              }
            }
          }
          callback(null, changed)
        }
      })
    },
    readWebhookInfoFromDB: function(){
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
        console.log("WEBHOOKS " + thisUser.webhooks)
      })
    },
    updateVoteDataInDB: function(callback){
      var query = 'UPDATE a2p_sms_users SET '
      query += "votes='" + JSON.stringify(this.voteCampaignArr) + "' WHERE user_id='" + this.extensionId + "'"
      pgdb.update(query, (err, result) =>  {
        if (err){
          console.error(err.message);
        }
        callback(null, "updated batch data")
      })
    },
    postResults: function (data){
      if (this.webhooks == undefined)
        return
      var https = require('https');
      console.log(data)
      var url = this.webhooks.url.replace("https://", "")
      var arr = url.split("/")
      var domain = arr[0]
      var path = `/${arr[1]}`
      var post_options = {
          host: domain,
          path: path,
          method: "POST",
          headers: {
            'Content-Type': 'application/json'
          }
      }
      if (this.webhooks.headerName.length && this.webhooks.headerValue.length){
        post_options.headers[`${this.webhooks.headerName}`] = this.webhooks.headerValue
      }
      console.log(post_options)
      return
      var post_req = https.request(post_options, function(res) {
          var response = ""
          res.on('data', function (chunk) {
              response += chunk
          });
          res.on("end", function(){
            console.log(response)
          });
      });

      post_req.write(JSON.stringify(data));
      post_req.end();
    },
    // Notifications
    /*
    subscribeForNotification: function(callback){
      var thisUser = this
      var p = this.rc_platform.getPlatform(function(err, p){
        if (p != null){
          var eventFilters = []
          var phoneHVNumbers = ["+12342002153","+18883303674"]
          for (var item of phoneHVNumbers){
            var filter = `/restapi/v1.0/account/~/a2p-sms/messages?direction=Inbound&to=${item}`
            eventFilters.push(filter)
          }
          console.log(eventFilters)
          console.log("Current subId: " + thisUser.subscriptionId)
          p.post('/restapi/v1.0/subscription', {
            eventFilters: eventFilters,
            deliveryMode: {
              transportType: 'WebHook',
              address: process.env.DELIVERY_MODE_ADDRESS
            },
            expiresIn: process.env.WEBHOOK_EXPIRES_IN
          })
          .then(function (resp){
            var jsonObj = resp.json()
            console.log("Ready to receive A2P notification via WebHook.")
            thisUser.subscriptionId = jsonObj.id
            //thisUser.eventEngine.subscriptionId = thisUser.subscriptionId
            console.log("Subscription created")
            console.log(thisUser.subscriptionId)
            thisUser.updateActiveUserSubscription()
            callback(null, jsonObj.id)
          })
          .catch(function(e){
            console.log("Failed here subscribeForNotification");
            console.log(e.message)
            callback(e.message, "failed")
          })
        } else {
          console.log(err);
          callback(err, "failed")
        }
      })
    },
    renewNotification: function(callback){
      var thisUser = this
      var p = this.rc_platform.getPlatform(function(err, p){
        if (p != null){
            // check subscription status
            p.get(`/restapi/v1.0/subscription/${thisUser.subscriptionId}`)
            .then(function(resp){
              var jsonObj = resp.json()
              console.log(JSON.stringify(jsonObj))
              if (jsonObj.status != "Active"){
                console.log("RENEW subscription")
                p.post(`/restapi/v1.0/subscription/${thisUser.subscriptionId}/renew`)
                .then(function (resp){
                  var jsonObj = resp.json()
                  console.log("Update notification via WebHook.")
                  callback(null, jsonObj.id)
                })
                .catch(function(e){
                  console.log(e.message)
                  callback(e, e.message)
                })
              }else{
                console.log("still active => use it")
                callback(null, jsonObj.id)
              }
            })
            .catch(function(e){
              console.log(e.message)
              thisUser.subscribeForNotification((err, res) => {
                console.log("==== ERR ====")
                console.log(err)
                callback(e, res)
              })

            })
        } else {
          console.log(err);
          callback(err, "failed")
        }
      })
    },
    updateActiveUserSubscription: function() {
      console.log("updateActiveUserSubscription")
      var query = "INSERT INTO a2p_sms_users (user_id, account_id, batches, votes, contacts, subscription_id, webhooks, access_tokens)"
      query += " VALUES ($1,$2,$3,$4,$5,$6,$7,$8)"
      var tokenStr = this.rc_platform.getTokens()
      var values = [this.extensionId, "", "", "", "", this.subscriptionId, "", tokenStr]
      query += " ON CONFLICT (user_id) DO UPDATE SET subscription_id='" + this.subscriptionId + "'"

      pgdb.insert(query, values, (err, result) =>  {
        if (err){
          console.error(err.message);
          console.log("QUERY: " + query)
        }else{
          console.log("updateActiveUserSubscription DONE");
        }
      })
    }
    */
};

module.exports = ActiveUser;
