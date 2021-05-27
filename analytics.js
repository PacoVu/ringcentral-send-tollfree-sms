const pgdb = require('./db')

function Analytics(){
  this.extensionId = extensionId
}

var engine = Analytics.prototype = {
    getCampaignAnalytics: function(data, callback){
      console.log("setup ActiveUser Engine")
      var thisUser = this
      this.loadCampaignDataFromDB(async (err, result) => {
        if (!err){
          callback(null, result)

        }else{
          callback(err, result)
        }
      })
    },
    getMonthlyAnalytics: function(records, analyticsData){
      console.log("getMonthlyAnalytics")
      /* {
      "id":"6777357",
      "batchId":"b8adcdef-98e6-40d4-aa37-14245f110647",
      "from":"+12342002153",
      "to":["+12092484775"],
      "text":"Keep eyes on this",
      "direction":"Outbound",
      "creationTime":"2021-05-24T13:49:41.441964Z",
      "lastModifiedTime":"2021-05-24T13:49:42.673911Z",
      "messageStatus":"Delivered",
      "cost":0.007,
      "segmentCount":1
      }
      */
    },
    loadCampaignDataFromDB: function(callback){
      var thisUser = this
      var query = `SELECT active_survey FROM a2p_sms_users WHERE user_id='${this.extensionId}'`
      pgdb.read(query, (err, result) => {
        if (err){
          console.error(err.message);
          return callback(err, err.message)
        }
        callback(null, thisUser.voteCampaignArr.length)
        }else{
          callback(null, 0)
        }
      })
};

module.exports = Analytics;
/*
const periods = [
  {month: "Jan '20", from: new Data("2020-01-01"),to: new Data("2020-01-31")},
  {month: "Feb '20", from: new Data("2020-02-01"),to: new Data("2020-02-29")},
  {month: "Mar '20", from: new Data("2020-03-01"),to: new Data("2020-03-31")},
  {month: "Apr '20", from: new Data("2020-04-01"),to: new Data("2020-04-30")},
  {month: "May '20", from: new Data("2020-05-01"),to: new Data("2020-05-31")},
  {month: "Jun '20", from: new Data("2020-06-01"),to: new Data("2020-06-30")},
  {month: "Jul '20", from: new Data("2020-07-01"),to: new Data("2020-07-31")},
  {month: "Aug '20", from: new Data("2020-08-01"),to: new Data("2020-08-31")},
  {month: "Sep '20", from: new Data("2020-09-01"),to: new Data("2020-09-30")},
  {month: "Oct '20", from: new Data("2020-10-01"),to: new Data("2020-10-31")},
  {month: "Nov '20", from: new Data("2020-11-01"),to: new Data("2020-11-30")},
  {month: "Dec '20", from: new Data("2020-12-01"),to: new Data("2020-12-31")},
  {month: "Jan '21", from: new Data("2021-01-01"),to: new Data("2021-01-31")},
  {month: "Feb '21", from: new Data("2021-02-01"),to: new Data("2021-02-28")},
  {month: "Mar '21", from: new Data("2021-03-01"),to: new Data("2021-03-31")},
  {month: "Apr '21", from: new Data("2021-04-01"),to: new Data("2021-04-30")},
  {month: "May '21", from: new Data("2021-05-01"),to: new Data("2021-05-31")},
  {month: "Jun '21", from: new Data("2021-06-01"),to: new Data("2021-06-30")},
  {month: "Jul '21", from: new Data("2021-07-01"),to: new Data("2021-07-31")},
  {month: "Aug '21", from: new Data("2021-08-01"),to: new Data("2021-08-31")},
  {month: "Sep '21", from: new Data("2021-09-01"),to: new Data("2021-09-30")},
  {month: "Oct '21", from: new Data("2021-10-01"),to: new Data("2021-10-31")},
  {month: "Nov '21", from: new Data("2021-11-01"),to: new Data("2021-11-30")},
  {month: "Dec '21", from: new Data("2021-12-01"),to: new Data("2021-12-31")}
]
*/
const periods = [
  {month: "Jan '20", to: new Data("2020-01-31")},
  {month: "Feb '20", to: new Data("2020-02-29")},
  {month: "Mar '20", to: new Data("2020-03-31")},
  {month: "Apr '20", to: new Data("2020-04-30")},
  {month: "May '20", to: new Data("2020-05-31")},
  {month: "Jun '20", to: new Data("2020-06-30")},
  {month: "Jul '20", to: new Data("2020-07-31")},
  {month: "Aug '20", to: new Data("2020-08-31")},
  {month: "Sep '20", to: new Data("2020-09-30")},
  {month: "Oct '20", to: new Data("2020-10-31")},
  {month: "Nov '20", to: new Data("2020-11-30")},
  {month: "Dec '20", to: new Data("2020-12-31")},
  {month: "Jan '21", to: new Data("2021-01-31")},
  {month: "Feb '21", to: new Data("2021-02-28")},
  {month: "Mar '21", to: new Data("2021-03-31")},
  {month: "Apr '21", to: new Data("2021-04-30")},
  {month: "May '21", to: new Data("2021-05-31")},
  {month: "Jun '21", to: new Data("2021-06-30")},
  {month: "Jul '21", to: new Data("2021-07-31")},
  {month: "Aug '21", to: new Data("2021-08-31")},
  {month: "Sep '21", to: new Data("2021-09-30")},
  {month: "Oct '21", to: new Data("2021-10-31")},
  {month: "Nov '21", to: new Data("2021-11-30")},
  {month: "Dec '21", to: new Data("2021-12-31")}
]
function getMonth(ts){
  for (var i = 0; i<24; i++){
    if (ts <= periods[i].to){
      return periods[i].month
    }
  }
}
