const pgdb = require('./db')

function addRejectedNumberToDB(rejectedData, batchId, extensionId) {
  //a2p_sms_users_tempdata
  var query = `SELECT rejected_numbers FROM a2p_sms_users_tempdata WHERE user_id='${extensionId}'`
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
    var values = [extensionId, '[]', JSON.stringify(rejectNumbers)]
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
}

function updateUserMonitorActivities(extensionId, userActivities){
  var activities = JSON.stringify(userActivities)
  //console.log(activities)
  var query = `UPDATE a2p_sms_users_monitor SET activities='${activities}' WHERE user_id='${extensionId}'`
  pgdb.update(query, (err, result) =>  {
    if (err){
      console.error(err.message);
    }
    console.log("updated monitor db")
  })
}

function readMonitorDB(extensionId, callback){
  var query = `SELECT * FROM a2p_sms_users_monitor WHERE user_id='${extensionId}'`
  pgdb.read(query, (err, result) => {
    if (err){
      console.error(err.message);
    }
    var userActivities = undefined
    if (!err && result.rows.length > 0){
      userActivities = JSON.parse(result.rows[0].activities)
    }else{ // no activities
      userActivities = {
        currentPresence: 'offline',
        standard_sms: { count: 0, total_messages: 0, download_count: 0, ts: 0 },
        campaign_broadcast: { count: 0, total_messages: 0, ts: 0 },
        campaign_personalized: { count: 0, total_message: 0, ts: 0 },
        campaign_survey: { count: 0, total_messages: 0, download_count: 0, ts: 0 },
        campaigns_logs: { view_count: 0, delete_count: 0, download_count: 0, total_delivered: 0, total_failed: 0, ts: 0 },
        conversations: { total_messages: 0, ts: 0 },
        message_store_downloads: { count: 0, ts: 0 },
        analytics: { view_count: 0, download_count: 0, ts: 0 },
        settings: { webhook: 0, contacts: 0, opt_out: 0, ts: 0 },
        helps: 0
      }
      /*
      thisUser.userActivities = {
        currentPresence: 'offline',
        messagesCount: [
          {
            dateTime: 0,
            total: {broadcast: 0, customized: 0, survey: 0, direct: 0, standard: 0},
            delivered: {broadcast: 0, customized: 0, survey: 0, direct: 0, standard: 0},
            failed: {broadcast: 0, customized: 0, survey: 0, standard: 0}
          }
        ],
        actionsCount: {

        },
        downloadsCount: {
          standard: 0, campaign: 0, survey:0, message_store: 0, analytics: 0
        },
        standard_sms: { count: 0, total_messages: 0, download_count: 0, ts: 0 },
        campaign_broadcast: { count: 0, total_messages: 0, ts: 0 },
        campaign_personalized: { count: 0, total_message: 0, ts: 0 },
        campaign_survey: { count: 0, total_messages: 0, download_count: 0, ts: 0 },
        campaigns_logs: { view_count: 0, delete_count: 0, download_count: 0, total_delivered: 0, total_failed: 0, ts: 0 },
        conversations: { total_messages: 0, ts: 0 },
        message_store_downloads: { count: 0, ts: 0 },
        analytics: { view_count: 0, download_count: 0, ts: 0 },
        settings: { webhook: 0, contacts: 0, opt_out: 0, ts: 0 },
        helps: 0
      }
      */
    }
    callback(null, userActivities)
  })
}

function updateActiveUserSubscription(extensionId, accountId, subscriptionId) {
  console.log("updateActiveUserSubscription")
  var query = "INSERT INTO a2p_sms_users (user_id, account_id, batches, contacts, subscription_id, webhooks, access_tokens, templates)"
  query += " VALUES ($1,$2,$3,$4,$5,$6,$7,$8)"
  var values = [extensionId, accountId, "[]", "[]", subscriptionId, "", "", "[]"]

  query += ` ON CONFLICT (user_id) DO UPDATE SET account_id='${accountId}', subscription_id='${subscriptionId}'`

  pgdb.insert(query, values, (err, result) =>  {
    if (err){
      console.error(err.message);
      console.log("QUERY: " + query)
    }else{
      console.log("updateActiveUserSubscription DONE");
    }
  })
}

exports.addRejectedNumberToDB = addRejectedNumberToDB;
exports.updateActiveUserSubscription = updateActiveUserSubscription;
exports.updateUserMonitorActivities = updateUserMonitorActivities;
exports.readMonitorDB = readMonitorDB;
/*
var LogUtility = module.exports = {
  writeLog: function(){
    return activeUsers
  },
  removeActiveUser: function(extensionId){
    console.log("removeActiveUser " + extensionId)
    var index = activeUsers.findIndex(o => o.extensionId.toString() === extensionId)
    if (index >= 0){
      console.log("activeUsers length before: " + activeUsers.length)
      activeUsers[index] = null
      activeUsers.splice(index, 1)
      console.log("activeUsers length after: " + activeUsers.length)
    }
  }
}
*/
