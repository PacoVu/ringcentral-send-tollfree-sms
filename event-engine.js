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
      this.loadVoteDataFromDB((err, result) => {
        if (!err){
          if (result > 0){
            this.autoDeleteTimer = setInterval(function(){
              thisUser.autoDeleteVoteCampaign()
            }, this.deleteInterval)
            this.updateStatusTimer = setInterval(function(){
              thisUser.detectExpiredVoteCampaign()
            }, this.updateInterval)
          }
        }
        thisUser.readWebhookInfoFromDB((err, res) => {
          callback(null, result)
        })
      })
    },
    setVoteInfo: function (voteInfo){
      this.voteCampaignArr.push(voteInfo)
      var thisUser = this
      this.autoDeleteTimer = setInterval(function(){
        thisUser.autoDeleteVoteCampaign()
      }, this.deleteInterval)
      this.updateStatusTimer = setInterval(function(){
        thisUser.detectExpiredVoteCampaign()
      }, this.updateInterval)

      this.updateVoteDataInDB((err, res) => {
        console.log(res)
      })
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
          this.updateCampaignDataInDB([voteReport])
          this.voteCampaignArr.splice(i, 1);
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
      callback("err", "")
    },
    setPlatform: function(p){
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
            if (campaign.status == "Completed" && !campaign.allowCorrection){
              continue
            }else{
              notFound = false
              // process this vote campaign
              console.log("Processing response")
              this.processThisCampaign(campaign, voter, body)
              break
            }
          }else continue;
        }
      }
      //
      if (notFound && this.logNewMessage)
        this.newMessageArr.push(body)
    },
    processThisCampaign: function(campaign, voter, body){
        var cost = (body.hasOwnProperty('cost')) ? body.cost : 0
        campaign.voteCounts.Cost += cost
        var now = new Date().getTime()
        if (now > campaign.endDateTime){
          console.log("vote has been closed")
          if (campaign.status == "Active"){
            campaign.status = "Closed"
            // close for now
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
                  //console.log(requestBody)
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
          //console.log(campaign.voterList)
          //console.log(campaign)
          //console.log("======")
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
                campaign.voteCounts.Cost += 0.007
                this.sendMessage(requestBody)
              }
              needUpdateDd = true
              break
            }
          }
          //console.log(campaign.voterList)
          //console.log(campaign)
          //console.log("======")
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
          //console.log(jsonObj)
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
          //thisUser.voteCampaignArr = JSON.parse(result.rows[0].votes)
          thisUser.voteCampaignArr = JSON.parse(result.rows[0].active_survey)
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
            this.postResults(campaign)
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
      var query = 'UPDATE a2p_sms_users_tempdata SET '
      query += "active_survey='" + JSON.stringify(this.voteCampaignArr) + "' WHERE user_id='" + this.extensionId + "'"
      //console.log(query)
      pgdb.update(query, (err, result) =>  {
        if (err){
          console.error(err.message);
        }
        callback(null, "updated vote campaign data")
      })

      var query = "INSERT INTO a2p_sms_users_tempdata (user_id, active_survey, rejected_numbers)"
      query += " VALUES ($1,$2,$3)"
      var activeServeys = JSON.stringify(this.voteCampaignArr)
      var values = [this.extensionId, activeServeys, '[]']
      query += ` ON CONFLICT (user_id) DO UPDATE SET active_survey='${activeServeys}'`
      pgdb.insert(query, values, (err, result) =>  {
        if (err){
          console.error(err.message);
          console.log("QUERY: " + query)
        }else{
          console.log("updateVoteDataInDB DONE");
        }
      })
    },
    updateCampaignDataInDB: function(archiveVoteList){
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
          var query = `UPDATE a2p_sms_users SET batches='${JSON.stringify(allCampaigns)}' WHERE user_id='${thisUser.extensionId}'`
          //console.log(query)
          pgdb.update(query, (err, result) => {
            if (err){
              console.log("Error?")
            }
            console.log("Archive vote done")
          })
        }
      })
    },
    postResults: function (data){
      if (this.webhooks == undefined || this.webhooks.url == "")
        return
      var https = require('https');
      //console.log(data)
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
      //console.log(post_options)
      //return
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
    }
};

module.exports = ActiveUser;
