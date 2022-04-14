const pgdb = require('./db')
const logger = require('./write-log')
const database = require('./write-database')

const ONE_DAY_TIMER_INTERVAL = 86400000
const ONE_HOUR_TIMER_INTERVAL = 3600000
const ONE_MINUTE_TIMER_INTERVAL = 60000

function ActiveUser(extensionId, subscriptionId, owner){
  this.owner = owner
  this.extensionId = extensionId
  this.subscriptionId = subscriptionId
  this.webhooks = undefined
  this.rc_platform = undefined
  // scheduler
  this.schedulerTimer = undefined
  this.scheduledSendAtArr = []
  this.processingBatches = []
  // auto refresh
  this.autoRefreshTimer = undefined
  this.role = "Owner"
}

var engine = ActiveUser.prototype = {
    setup: function(platform, callback){
      console.log("setup ActiveUser Engine")
      this.rc_platform = platform
      var thisUser = this
      this.readScheduledCampaignsFromDB(async (err, result) => {
        if (!err){
          var scheduledCampaigns = JSON.parse(result)
          for (var sch of scheduledCampaigns){
            thisUser.scheduledSendAtArr.push(sch.sendAt)
          }
          if (thisUser.scheduledSendAtArr.length > 0){
              if (!thisUser.schedulerTimer){
                thisUser.schedulerTimer = setInterval(function(){
                  thisUser.checkScheduledCampaign()
                }, ONE_MINUTE_TIMER_INTERVAL)
              }
          }

          if (!thisUser.autoRefreshTimer){
              thisUser.autoRefreshTimer = setInterval(function(){
                thisUser.autoRefresh()
              }, ONE_DAY_TIMER_INTERVAL)
          }

          thisUser.readWebhookInfoFromDB( async (err, res) => {
              await thisUser.deleteExtraSubscriptions(false)
              callback(null, thisUser.scheduledSendAtArr.length)
          })
        }else{
          callback(err, result)
        }
      })

    },
    autoSetup: function(platform, callback){
      console.log("autoSetup ActiveUser Engine")
      this.rc_platform = platform
      var thisUser = this
      this.readScheduledCampaignsFromDB((err, result) => {
        if (!err){
          var scheduledCampaigns = JSON.parse(result)
          for (var sch of scheduledCampaigns){
            thisUser.scheduledSendAtArr.push(sch.sendAt)
          }

          if (thisUser.scheduledSendAtArr.length > 0){
            if (!thisUser.schedulerTimer){
                console.log("set timer interval: autoSetup")
                thisUser.schedulerTimer = setInterval(function(){
                  thisUser.checkScheduledCampaign()
                }, ONE_MINUTE_TIMER_INTERVAL)
            }
          }

          if (!thisUser.autoRefreshTimer){
              thisUser.autoRefreshTimer = setInterval(function(){
                thisUser.autoRefresh()
              }, ONE_DAY_TIMER_INTERVAL)
          }

          thisUser.readWebhookInfoFromDB( async (err, res) => {
            await thisUser.deleteExtraSubscriptions(false)
            callback(null, thisUser.scheduledSendAtArr.length)
          })
        }else{
          callback(err, result)
        }
      })
    },
    // shared number implementation ends
    autoRefresh: function(){
      console.log("AUTO REFRESH")
      this.rc_platform.getPlatform(this.extensionId)
    },
    cancelScheduledCampaign: function(creationTime, callback){
      var thisUser = this
      var query = `SELECT scheduled_campaigns FROM a2p_sms_users_tempdata WHERE user_id='${this.extensionId}'`
      //console.log(query)
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
          callback(err, "failed")
        }
        //console.log(result.rows)
        if (!err && result.rows.length > 0){
          if (result.rows[0].scheduled_campaigns){
            var campaigns = JSON.parse(result.rows[0].scheduled_campaigns)
            for (var campaign of campaigns){
              //console.log(campaign)
              //console.log(creationTime, campaign.creationTime)
              if (creationTime == campaign.creationTime){
                thisUser.scheduledSendAtArr.splice(thisUser.scheduledSendAtArr.indexOf(campaign.sendAt), 1)

                // remove this scheduled campaign from tempdata db
                campaigns.splice(campaigns.indexOf(campaign), 1)
                thisUser.saveScheduledCampaignsToDB(campaigns, (err, ret) => {
                  var message = ''
                  if (!err)
                    message = "Scheduled campaign cancelled successfully."
                  else
                    message = "Scheduled campaign cancellation failed."
                  //console.log(message)
                  thisUser._removeScheduledCampaignDB(creationTime, (err, ret) => {
                    console.log(ret)
                  })
                  callback(null, message)
                })
                return
              }
            }
            console.log("Call this?")
            thisUser._removeScheduledCampaignDB(creationTime, (err, ret) => {
              console.log("RET", ret)
              callback(null, null)
            })
          }
        }else{ // no connector
          /*
          console.log("Call this?")
          thisUser._removeScheduledCampaignDB(creationTime, (err, ret) => {
            console.log("RET", ret)
          })
          */
          callback('err', null)
        }
      })
    },
    setPlatform: function(p){
      if (this.rc_platform){
        console.log("REPLACE SDK PLATFORM")
      }
      this.rc_platform = p
    },
    changeOwner: function(newOwner){
      this.owner = newOwner
      if (newOwner == 'autoStart'){
        if (!this.autoRefreshTimer){
          var thisUser = this
          this.autoRefreshTimer = setInterval(function(){
            thisUser.autoRefresh()
          }, ONE_DAY_TIMER_INTERVAL)
        }
      }
    },
    /*
    readScheduledCampaignsFromDB: function(callback){
      console.log("readScheduledCampaignsFromDB")
      var thisUser = this
      var query = `SELECT scheduled_campaigns FROM a2p_sms_users_tempdata WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
          return callback(err, err.message)
        }
        if (!err && result.rows.length > 0){
          var scheduledCampaigns = JSON.parse(result.rows[0].scheduled_campaigns)
          for (var sch of scheduledCampaigns){
            thisUser.scheduledSendAtArr.push(sch.sendAt)
          }
          callback(null, thisUser.scheduledSendAtArr.length)
        }else{
          callback(null, 0)
        }
      })
    },
    */
    // scheduler implementation
    setScheduledCampaign: function (campaignData, callback){
      // read scheduled_campaigns from db
      var thisUser = this
      this.readScheduledCampaignsFromDB((err, result) => {
        if (err){
          callback(err, "failed")
        }else{
          var campaigns = JSON.parse(result)
          campaigns.push(campaignData)
          thisUser.scheduledSendAtArr.push(campaignData.sendAt)
          if (!thisUser.schedulerTimer){
            thisUser.schedulerTimer = setInterval(function(){
              thisUser.checkScheduledCampaign()
            }, ONE_MINUTE_TIMER_INTERVAL)
          }
          if (!thisUser.autoRefreshTimer){
            thisUser.autoRefreshTimer = setInterval(function(){
              thisUser.autoRefresh()
            }, ONE_DAY_TIMER_INTERVAL)
          }
          thisUser.saveScheduledCampaignsToDB(campaigns, (err, result) => {
            if (!err){
              callback(null, "ok")
            }else{
              callback(err, "failed")
            }
          })
        }
      })
    },
    readScheduledCampaignsFromDB: function(callback){
      var query = `SELECT scheduled_campaigns FROM a2p_sms_users_tempdata WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
          callback(err, "failed")
        }
        if (!err && result.rows.length > 0){
          if (result.rows[0].scheduled_campaigns){
            callback(null, result.rows[0].scheduled_campaigns)
          }
        }else{ // no
          callback(null, '[]')
        }
      })
    },
    saveScheduledCampaignsToDB: function(campaigns, callback){
      var query = "INSERT INTO a2p_sms_users_tempdata (user_id, rejected_numbers, scheduled_campaigns)"
      query += " VALUES ($1,$2,$3)"
      var scheduledCampaigns = JSON.stringify(campaigns)
      scheduledCampaigns = scheduledCampaigns.replace(/'/g, "''")
      var values = [this.extensionId, '[]', scheduledCampaigns]
      query += ` ON CONFLICT (user_id) DO UPDATE SET scheduled_campaigns='${scheduledCampaigns}'`
      pgdb.insert(query, values, (err, result) =>  {
        if (err){
          console.error(err.message);
          console.log("QUERY: " + query)
          callback(err, "Cannot update scheduled campaigns")
        }else{
          console.log("saveScheduledCampaignsToDB DONE");
          callback(null, "ok")
        }
      })
    },
    checkScheduledCampaign: function(){
      console.log("checkScheduledCampaign", this.scheduledSendAtArr)
      var currentTime = new Date().getTime()
      for (var sendAt of this.scheduledSendAtArr){
        if (currentTime >= sendAt){
          this.scheduledSendAtArr.splice(this.scheduledSendAtArr.indexOf(sendAt), 1)
          if (this.scheduledSendAtArr.length <= 0){
            clearInterval(this.schedulerTimer)
            this.schedulerTimer = undefined
          }
          var thisUser = this
          thisUser.loadScheduledCampaignsFromDB(sendAt, (err, scheduledCampaign) => {
            if (!err){
              if (scheduledCampaign){
                thisUser.sendScheduledCampaign(scheduledCampaign)
              }else{
                console.log("not found scheduled campaign")
              }
            }else{
              console.log("no scheduled campaign")
            }
          })
          break
        }
      }
    },
    loadScheduledCampaignsFromDB: function(sendAt, callback){
      console.log("loadScheduledCampaignsFromDB")
      var thisUser = this
      var query = `SELECT scheduled_campaigns FROM a2p_sms_users_tempdata WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
          callback(err, "failed")
        }
        if (!err && result.rows.length > 0){
          if (result.rows[0].scheduled_campaigns){
            var campaigns = JSON.parse(result.rows[0].scheduled_campaigns)
            for (var campaign of campaigns){
              if (sendAt == campaign.sendAt){
                callback(null, campaign)
                // remove this scheduled campaign from tempdata db
                campaigns.splice(campaigns.indexOf(campaign), 1)
                thisUser.saveScheduledCampaignsToDB(campaigns, (err, ret) => {
                  if (!err)
                    console.log("remove scheduled campaign successfully.")
                  else
                  console.log("remove scheduled campaign failed.")
                })
                return
              }
            }
            callback(null, null)
          }
        }else{ // no connector
          callback(null, null)
        }
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
          }
        }else{ // no connector
          thisUser.webhooks = undefined
        }
        callback(null, "ok")
      })
    },
    postResults: function (data){
      if (this.webhooks == undefined || this.webhooks.url == "")
        return
      console.log("Posting report ...")
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
    deleteSubscription: async function() {
      if (this.rc_platform == undefined)
        return

      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        try{
          var r =  await p.delete(`/restapi/v1.0/subscription/${this.subscriptionId}`)
          console.log(`Deleted current subscription: ${this.subscriptionId}`)
        }catch(e){
          console.log(e.message)
        }
        var query = `UPDATE a2p_sms_users SET subscription_id='' WHERE user_id='${this.extensionId}'`
        pgdb.update(query, (err, result) =>  {
          console.log("Empty subscription_id")
        })
      }else{
        console.log("Cannot get platform => Delete all subscriptions error")
      }
    },
    updateNotification: async function(eventFilters, callback){
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
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
    },
    // scheduler
    sendScheduledCampaign: async function(scheduledCampaign){
      var p = await this.rc_platform.getPlatform(this.extensionId)
      if (p){
        var endpoint = "/restapi/v1.0/account/~/a2p-sms/batches"
        try {
          var resp = await p.post(endpoint, scheduledCampaign.requestBody)
          var jsonObj = await resp.json()
          //var obj = resp.headers
          logger.writeLog(this.extensionId, `------------\r\nCampaign sent to ${jsonObj.batchSize} recipients at ${new Date().toISOString()}\r\nBatch id: ${jsonObj.id}`)
          this.processingBatches.push(jsonObj.id)
          var batchSummaryReport = {
            sendAt: scheduledCampaign.sendAt,
            batchId: jsonObj.id,
            rejectedCount: jsonObj.rejected.length,
          }
          console.log("Ext id: " + this.extensionId)
          if (jsonObj.rejected.length){
            //this.userActivities.campaigns_logs.total_rejected += jsonObj.rejected.length
            // add rejected numbers to a temp db
            //this.addRejectedNumberToDB(jsonObj.rejected, jsonObj.id)
            database.addRejectedNumberToDB(jsonObj.rejected, jsonObj.id, this.extensionId)
          }

          this._updateCampaignDB(false, batchSummaryReport, (err, result) => {
            console.log("_updateCampaignDB: scheduled campaign")
          })
        } catch (e) {
          var obj = e.response.headers
          logger.writeLog(this.extensionId, `------------\r\nCampaign => POST endpoint ${endpoint} at ${new Date().toISOString()}\r\nRequest id: ${obj.get('rcrequestid')}`)
          logger.writeLog(this.extensionId, `Error message: ${e.message}`);
        }
      }else{
        console.log("No tokens => what to do?")
      }
    },
    processBatchEventNotication: function(eventObj){
      console.log("Batch completed: eventEngine")
      var thisUser = this
      this.readBatchReportFromDB(eventObj.body.id, (err, batch) => {
        if (batch){
          console.log("found batch")
          logger.writeLog(thisUser.extensionId, `------------\r\nCampaign status: ${eventObj.body.status} notified at ${new Date().toISOString()}\r\nBatch id: ${batch.batchId}`)
          if (eventObj.body.status == "Completed"){
            var index = thisUser.processingBatches.findIndex(o => o == eventObj.body.id)
            if (index >= 0)
              thisUser.processingBatches.splice(index, 1)
            batch.queuedCount = 0
            batch.deliveredCount = 0
            batch.sentCount = 0
            batch.unreachableCount = 0
            batch.totalCost = 0.0
            thisUser._readBatchReport(batch, 1, 0, "")
          }
          // check status to deal with the future when deletion is supported
        }else{
          logger.writeLog(thisUser.extensionId, `------------\r\nBatch not found from db! Notified at ${new Date().toISOString()}\r\nEvent body: ${JSON.stringify(eventObj.body)}`)
        }
      })
    },
    _readBatchReport: async function(batch, page, spamMsgCount, pageToken){
      console.log("_readBatchReport: eventEngine")
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
                if ( message.errorCode == 'SMS-UP-430' || message.errorCode == 'SMS-UP-431' ||
                     message.errorCode == 'SMS-CAR-430' || message.errorCode == 'SMS-CAR-431')
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
          this.postResults(postData)

          var thisUser = this
          if (jsonObj.paging.hasOwnProperty("nextPageToken")){
            //console.log("has nextPageToken, get it after 1.2 secs")
            page++
            setTimeout(function(){
              thisUser._readBatchReport(batch, page, spamMsgCount, jsonObj.paging.nextPageToken)
            }, 1200)
          }else{
            thisUser._updateCampaignDB(true, batch, (err, result) => {
              //console.log("Call post result only once when batch result is completed. Post only if webhook uri is provided.")
              var postData = {
                dataType: "Campaign_Summary",
                report: result
              }
              // post batch data to webhook address
              thisUser.postResults(postData)
            })
            /*
            thisUser.userActivities.campaigns_logs.total_delivered += batch.deliveredCount
            thisUser.userActivities.campaigns_logs.total_failed += batch.unreachableCount
            thisUser.userActivities.campaigns_logs.ts = new Date().getTime()
            thisUser.updateUserMonitorActivities()
            */
            database.readMonitorDB(this.extensionId, function(err, userActivities){
              userActivities.campaigns_logs.total_delivered += batch.deliveredCount
              userActivities.campaigns_logs.total_failed += batch.unreachableCount
              userActivities.campaigns_logs.ts = new Date().getTime()
              database.updateUserMonitorActivities(thisUser.extensionId, userActivities)
            })
          }
        } catch (e) {
          if (e.response){
            var obj = e.response.headers
            logger.writeLog(this.extensionId, `------------\r\n_readBatchReport => GET ${endpoint} at ${new Date().toISOString()}\r\nRequest id: ${obj.get('rcrequestid')}`)
          }
          logger.writeLog(this.extensionId, `Params ${JSON.stringify(params)}`);
          logger.writeLog(this.extensionId, `Error message: ${e.message}`);
        }
      }else{
        console.log("platform issue")
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
    _updateCampaignDB: function(batchId, batchReport, callback){
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

          var batch = undefined
          if (batchId){
            batch = batches.find(o => o.batchId == batchReport.batchId)
            if (batch){
              batch.batchId = batchReport.batchId
              batch.queuedCount = batchReport.queuedCount
              batch.deliveredCount = batchReport.deliveredCount
              batch.sentCount = batchReport.sentCount
              batch.unreachableCount = batchReport.unreachableCount
              batch.totalCost = batchReport.totalCost
            }
          }else{
            batch = batches.find(o => o.sendAt == batchReport.sendAt)
            if (batch){
              batch.batchId = batchReport.batchId
              batch.creationTime = batchReport.sendAt
              batch.rejectedCount = batchReport.rejectedCount
            }
          }
          if (batch){
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
    _removeScheduledCampaignDB: function(creationTime, callback){
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

          var index = batches.findIndex(o => o.creationTime == creationTime)
          if (index > 0){
            batches.splice(index, 1)
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
              callback(null, "ok")
            })
          }else
            callback(null, "not found")
        }
      })
    }
};

module.exports = ActiveUser;
