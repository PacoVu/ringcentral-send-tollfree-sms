const pgdb = require('./db')

function ActiveUser(extensionId, subscriptionId){
  //this.accountId = accountId
  this.extensionId = extensionId
  this.subscriptionId = subscriptionId
  this.voteInfo = undefined
}

var engine = ActiveUser.prototype = {
    setup: function(callback){
      console.log("setup ActiveUser Engine")
      this.loadVoteDataFromDB()
      callback(null, "")
    },
    setVoteInfo: function (voteInfo){
      this.voteInfo = voteInfo
      console.log(this.voteInfo)
    },
    processNotification: function(jsonObj){
      // parse tel notification payload
      console.log(jsonObj)
      var body = jsonObj.body
      if (this.voteInfo != undefined && this.voteInfo.serviceNumber == body.to[0]){
        var cost = (body.hasOwnProperty('cost')) ? body.cost : 0
        this.voteInfo.voteCounts.Cost += cost
        var now = new Date().getTime()
        if (now > this.voteInfo.endDateTime){
          console.log("vote has been closed")
          this.voteInfo.completed = true
          return
        }
        var client = this.voteInfo.voterList.find(o => o.phoneNumber == body.from)
        if (client && !client.replied){
          client.replied = true
          this.voteInfo.voteCounts.Replied++
          //
          //if (this.voteInfo.voteCounts.Delivered > 0){
            if (this.voteInfo.voteCounts.Delivered == this.voteInfo.voteCounts.Replied){
              this.voteInfo.completed = true
            }
          //}
          //
          for (var command of client.commands){
            if (body.text.trim().toLowerCase() == command.toLowerCase()){
              client.result = command
              this.voteInfo.voteResults[command]++
              console.log("Client reply message: " + body.text)
              break
            }
          }
          if (client.result == ""){
            console.log("Client reply message: " + body.text)
          }
          console.log(this.voteInfo.voterList)
          console.log(this.voteInfo)
          this.updateVoteDataInDB()
          console.log("======")
        }
      }
    },
    loadVoteDataFromDB: function(){
      var thisUser = this
      var query = `SELECT stats FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
        }
        if (!err && result.rows.length > 0){
          thisUser.voteInfo = JSON.parse(result.rows[0].stats)
          console.log(thisUser.voteInfo)
        }
      })
    },
    updateVoteDataInDB: function(){
      var query = 'UPDATE a2p_sms_users SET '
      query += "stats='" + JSON.stringify(this.voteInfo) + "' WHERE user_id='" + this.extensionId + "'"
      pgdb.update(query, (err, result) =>  {
        if (err){
          console.error(err.message);
        }
        console.log("updated batch data")
      })
    },
    processNotification_0: function(jsonObj){
      // parse tel notification payload
      console.log(jsonObj)
      var thisUser = this
      var body = jsonObj.body
      //console.log(JSON.stringify(requestBody))
      if (this.rc_platform == undefined)
        return
      var p = this.rc_platform.getPlatform(function(err, p){
        if (p != null){
          console.log("handle_client_response")
          var endpoint = "/restapi/v1.0/account/~/a2p-sms/messages"
          //var timestamp = new Date(body.creationTime).getTime()
          //timestamp -= (24 * 3600 * 1000)
          //var dateFrom = new Date(timestamp).toISOString()
          var params = {
            //dateFrom: dateFrom,
            batchId: thisUser.batchId,
            direction: ["Outbound"],
            view: "Detailed"
          }
          p.get(endpoint, params)
          .then(function (resp) {
            var jsonObj = resp.json()
            console.log(JSON.stringify(jsonObj))
            for (var message of jsonObj.records){
              var client = thisUser.customerList.find(o => o.id == message.id)
              if (client && !client.replied){
                client.replied = true
                for (var command of client.commands){
                  if (body.text.toUpperCase() == command){
                    client.result = command
                    console.log("Questionair message: " + message.text)
                    console.log("Client reply message: " + body.text)
                    break
                  }
                }
                if (client.result == ""){
                  console.log("Client reply message: " + body.text)
                }
                console.log(thisUser.customerList)
                console.log("======")
                break
              }
            }
          })
          .catch(function (e) {
            console.log('ERR ' + e.message);
          });
        }else{
          console.log("Platform failed")
        }
      })
    }
};

module.exports = ActiveUser;

function updateAnalyticsTable(accountId, extension){
  var tableName = "rt_analytics_" + accountId

  var query = 'INSERT INTO ' +tableName+ ' (extension_id, added_timestamp, name, inbound_calls, outbound_calls, missed_calls, voicemails)'
  query += " VALUES ('" + extension.id
  query += "'," + new Date().getTime()
  query += ",'" + extension.name
  query += "'," + extension.callStatistics.inboundCalls
  query += "," + extension.callStatistics.outboundCalls
  query += "," + extension.callStatistics.missedCalls
  query += "," + extension.callStatistics.voicemails + ")"

  query += ' ON CONFLICT (extension_id) DO UPDATE SET inbound_calls= ' + extension.callStatistics.inboundCalls + ", "
  query += ' outbound_calls= ' + extension.callStatistics.outboundCalls + ", "
  query += ' missed_calls= ' + extension.callStatistics.missedCalls + ", "
  query += ' voicemails= ' + extension.callStatistics.voicemails

  pgdb.insert(query, [], (err, result) =>  {
    if (err){
      console.error(err.message);
      console.log("QUERY: " + query)
    }else{
      console.log("updateAnalyticsTable DONE");
    }
  })
}

function updateCallReportTable(accountId, extensionId, call){
  var tableName = "rt_call_logs_" + accountId

  var query = "INSERT INTO " + tableName
  query += " (party_id, session_id, extension_id, customer_number, agent_number, direction, calling_timestamp, "
  query += "call_duration, ringing_timestamp, connecting_timestamp, disconnecting_timestamp, holding_timestamp, call_hold_duration, "
  query += "holding_count, call_respond_duration, call_type, call_action, call_result)"
  query += " VALUES ('" + call.partyId + "','"
  query += call.sessionId + "','"
  query += extensionId + "','"
  query += call.customerNumber + "','"
  query += call.agentNumber + "','"
  query += call.direction + "',"
  query += call.callingTimestamp + ","
  query += call.callDuration + ","
  query += call.ringingTimestamp + ","
  query += call.connectingTimestamp + ","
  query += call.disconnectingTimestamp + ","
  query += call.holdingTimestamp + ","
  query += call.callHoldDurationTotal + ","
  query += call.holdingCount + ","
  query += call.callRespondDuration + ",'"
  query += call.callType + "','"
  query += call.callAction + "','"
  query += call.callResult + "')"
  //console.log(query)

  pgdb.insert(query, [], (err, result) =>  {
    if (err){
      console.error(err.message);
      console.log("QUERY: " + query)
    }else{
      console.log("updateCallReportTable DONE");
    }
  })
}

function readAccountMonitoredExtensionsFromTable(accountId, callback){
  return
  var tableName = "rt_analytics_" + accountId
  var query = "SELECT * FROM " + tableName
  var monitoredExtensionList = []
  pgdb.read(query, (err, result) => {
    if (err){
      console.error(err.message);
      return callback(err.message, "error")
    }
    if (result.rows){
      result.rows.sort(sortByAddedDate)
      for (var ext of result.rows){
        var extension = {
          id: ext.extension_id,
          name: ext.name.trim(),
          callStatistics: {
            inboundCalls: parseInt(ext.inbound_calls),
            outboundCalls: parseInt(ext.outbound_calls),
            missedCalls: parseInt(ext.missed_calls),
            voicemails: parseInt(ext.voicemails)
          },
          activeCalls: []
        }
        monitoredExtensionList.push(extension)
      }
    }
    console.log("Done autosetup")
    callback(null, monitoredExtensionList)
  });
}
