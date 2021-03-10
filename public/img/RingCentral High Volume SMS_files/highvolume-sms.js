/*
var errorCodes = {}
errorCodes["SMS-UP-410"] = "Destination number invalid, unallocated, or does not support this kind of messaging."
errorCodes["SMS-UP-430"] = "Spam content detected by SMS gateway."
errorCodes["SMS-UP-431"] = "Number blacklisted due to spam."
errorCodes["SMS-UP-500"] = "General SMS gateway error. Upstream is malfunctioning."
errorCodes["SMS-CAR-104"] = "Carrier has not reported delivery status."
errorCodes["SMS-CAR-199"] = "Carrier reports unknown message status."
errorCodes["SMS-CAR-400"] = "Carrier does not support this kind of messaging."
errorCodes["SMS-CAR-411"] = "Destination number invalid, unallocated, or does not support this kind of messaging."
errorCodes["SMS-CAR-412"] = "Destination subscriber unavailable."
errorCodes["SMS-CAR-413"] = "Destination subscriber opted out."
errorCodes["SMS-CAR-430"] = "Spam content detected by mobile carrier."
errorCodes["SMS-CAR-431"] = "Message rejected by carrier with no specific reason."
errorCodes["SMS-CAR-432"] = "Message is too long."
errorCodes["SMS-CAR-433"] = "Message is malformed for the carrier."
errorCodes["SMS-CAR-450"] = "P2P messaging volume violation."
errorCodes["SMS-CAR-460"] = "Destination rejected short code messaging."
errorCodes["SMS-CAR-500"] = "Carrier reported general service failure."
errorCodes["SMS-RC-500"] = "General/Unknown internal RingCentral error."
errorCodes["SMS-RC-501"] = "RingCentral is sending a bad upstream API call."
errorCodes["SMS-RC-503"] = "RingCentral provisioning error. Phone number is incorrectly provisioned by RingCentral in upstream."
errorCodes["SMS-NO-ERROR"] = "Sent successfullly."
*/
var campaignList = undefined
var voteReportList = undefined
var selectedCampaign = null
var pollingBatchReport = null
function init(){
  google.charts.load('current', {'packages':['corechart'], callback: onloaded});
  var height = $(window).height() - 80;
    window.onresize = function() {
        height = $(window).height() - 80;
        var swindow = height - $("#menu_header").height()
        $("#history-list-column").height(swindow - $("#history-info-block").outerHeight(true))
        var upperBlock = $("#history-info-block").outerHeight(true) + $("#history-header").outerHeight(true)
        $("#history-list").height(swindow - upperBlock)

        $("#menu-pane").height(swindow)
        $("#control-block").height(swindow)
        $("#creation-pane").height(swindow)
    }
    var swindow = height - $("#menu_header").height()

    $("#history-list-column").height(swindow - $("#history-info-block").outerHeight(true))

    var upperBlock = $("#history-info-block").outerHeight(true) + $("#history-header").outerHeight(true) + 100
    $("#history-list").height(swindow - upperBlock)

    $("#menu-pane").height(swindow)
    $("#control-block").height(swindow)
    $("#creation-pane").height(swindow)
  selectedCampaign = null
}

function onloaded(){
   //alert("onloaded")
   loaded++
   if (loaded == 3)
    readCampaigns()
}

function readCampaigns(){
  if (pollingBatchReport)
    window.clearTimeout(pollingBatchReport)
  var url = "/read-campaigns"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      //alert(JSON.stringify(res))
      campaignList = res.campaigns
      voteReportList = res.voteReport
      if (campaignList.length == 0){
        createNewCampaign()
      }
      var timeOffset = new Date().getTimezoneOffset()*60000;
      var html = ""
      var i = 0
      for (var item of campaignList) {
        var date = new Date(item.creationTime)
        var timestamp = item.creationTime - timeOffset
        date = new Date (timestamp)
        var dateStr = date.toISOString()
        dateStr = dateStr.replace("T", " ").substring(0, 16)
        /*
        <div class="row col-lg-12 history">Campaign history</div>
        <div class="col-lg-12 history header">
          <div class="row col-lg-3">Campaign name</div>
        */
        html += `<div id="${i}" class="row col-lg-12 history-item" onclick="readCampaignById(this, '${item.batchId}')">`
        html += `<div class="row col-lg-3">${item.campaignName}</div>`
        html += `<div class="col-lg-2">${dateStr}</div>`
        html +=  `<div class="col-lg-1">${item.totalCount}</div>`
        html += `<div class="col-lg-1">${item.deliveredCount}/${item.totalCount}</div>`
        html += `<div class="col-lg-1">${item.unreachableCount}/${item.totalCount}</div>`
        if (item.type == "vote")
          html += `<div class="col-lg-1">Survey</div>`
        else
          html += `<div class="col-lg-1">Broadcast</div>`
        html += `<div class="col-lg-1">${item.live}</div>`
        html += `<div class="col-lg-2">${item.totalCost.toFixed(3)}</div>`
        html += "</div>"
        i++
      }
      //alert(html)
      $("#history-list").html(html)
      //readCampaign($("#0"), campaigns[0].batchId, campaigns[0].creationTime, campaigns[0].campaign)
      selectedCampaign = $("#0")
      $(selectedCampaign).addClass("active");
      displayRecentCampaign(res.recentBatch, res.voteReport)

    }else if (res.status == "failed") {
      alert(res.message)
      window.location.href = "login"
    }else{
      alert(res.message)
    }
  });
}

function displayRecentCampaign(batchReport, voteReport){
  //alert(JSON.stringify(batchReport))
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var timestamp = batchReport.creationTime - timeOffset
  var createdDate = new Date (timestamp)
  var createdDateStr = createdDate.toISOString()
  createdDateStr = createdDateStr.replace("T", " ").substring(0, 19)
  $("#campaign-title").html(batchReport.campaignName)
  var report = `<div>`
  report += `<div class="info-line"><img class="icon" src="../img/creation-date.png"></img> ${createdDateStr}</div>`
  report += `<div class="info-line"><img class="icon" src="../img/sender.png"></img> ${formatPhoneNumber(batchReport.serviceNumber)}</div>`
  report += `<div class="info-line"><img class="icon" src="../img/recipient.png"></img> ${batchReport.totalCount} recipients </div>`

  report += `<div class="info-line"><img class="icon" src="../img/cost.png"></img> USD ${batchReport.totalCost.toFixed(3)}</div>`
  var msg = (batchReport.message.length > 50) ? (batchReport.message.substring(0, 50) + "...") : batchReport.message
  report += `<p class="info-line"><img class="icon" src="../img/message.png"></img> ${msg}</p>`

  $("#campaign-details").html(report)

  var params = [];
  var arr = ['Results', '#', { role: "style" } ];
  params.push(arr);
  var item = ["Pending", batchReport.queuedCount, "#ffffff"];
  params.push(item);
  item = ["Delivered", batchReport.deliveredCount, "#2f95a5"]
  params.push(item);
  item = ["Failed", batchReport.unreachableCount, "#f04b3b"]
  params.push(item);

  plotBatchReport(params)
  // display vote report
  if (batchReport.type == "vote"){
    $("#vote-report").show()
    if (voteReport == undefined){
      $("#vote-result").html("")
      $("#vote-details").html("This survey result has been deleted.")
    }else{
      $("#vote-report").show()
      $("#vote-details").html(createVoteReport(voteReport))
      plotVoteResult(voteReport.voteResults)
    }
  }else{
    $("#vote-report").hide()
  }
  //alert(campaign.batchSummaryReport.live)
  if (batchReport.live == true || voteReport.status == "Active"){
    pollingBatchReport = window.setTimeout(function(){
      pollVoteResultById(batchReport, batchReport.batchId)
    }, 2000)
  }
}

function pollVoteResultById(campaign, batchId){
  var url = `read-campaign-summary?batchId=${batchId}`
  var getting = $.get( url );
  getting.done(function( res ) {
      if (res.status == "ok"){
        //var fromNumber = createDetailedReport(res.fullReport)
        //updateVoteResult(campaign, res.voteReport)
        displayRecentCampaign(campaign, res.voteReport)
      }else if (res.status == "failed") {
        alert(res.message)
        window.location.href = "login"
      }else{
        alert(res.message)
      }
  });
}

function createVoteReport(voteReport){
  //alert(JSON.stringify(voteReport))
  var report = "<div>"
  var status = "Status: response period is closed"
  if (voteReport.status == "Completed"){
    status = "Campaign is completed."
  }else if(voteReport.status == "Active"){
    var now = new Date().getTime()
    var expire = voteReport.endDateTime - now
    if (expire >= 0){
      status = "Response period expires in " + formatSendingTime(expire/1000)
      reload = true
    }else{
      status = "Response period is closed"
    }
  }
  report += `<div class="info-line"><img class="icon" src="../img/status.png"></img> ${status}</div>`
  /*autoReplyMessages: {},
  autoReply: false, //body.auto_reply,
  allowCorrection: allowCorrection,
  voteCommands: [],
  */
  report += `<div class="info-line"><img class="icon" src="../img/unreachable.png"></img> ${voteReport.voteCounts.Unreachable} unreached</div>`
  report += `<div class="info-line"><img class="icon" src="../img/replied.png"></img> ${voteReport.voteCounts.Replied} / ${voteReport.voteCounts.Delivered} replied</div>`
  if (voteReport.status != "Active"){
    report += `<p><img class="icon" src="../img/stop.png"></img> This survey result will be deleted in 24 hours!</p>`
  }
  report += `<div class="info-line"><a href="javascript:downloadCampaignResult('${voteReport.batchId}','${voteReport.serviceNumber}')">Download Result</a> | `
  report += `<a href="javascript:deleteCampaignResult('${voteReport.batchId}')">Delete Result</a></div>`
  report += "</div>"
  return report
}

function readCampaignById(elm, batchId){
  if (pollingBatchReport)
    window.clearTimeout(pollingBatchReport)

  if (selectedCampaign != null)
      $(selectedCampaign).removeClass("active");
  $(elm).addClass("active");
  selectedCampaign = elm

  // read from local memory
  var campaign = campaignList.find(o => o.batchId == batchId)
  if (campaign && campaign.type != "vote"){
    displayRecentCampaign(campaign, undefined)
  }else{
    var url = `read-campaign-summary?batchId=${batchId}`
    var getting = $.get( url );
    getting.done(function( res ) {
      if (res.status == "ok"){
        //var fromNumber = createDetailedReport(res.fullReport)
        displayRecentCampaign(campaign, res.voteReport)
      }else if (res.status == "failed") {
        alert(res.message)
        window.location.href = "login"
      }else{
        alert(res.message)
      }
    });
  }
}


function plotBatchReport(params){
    var data = google.visualization.arrayToDataTable(params);
    var view = new google.visualization.DataView(data);
    var options = {
      title: 'Campaign report',
      width: 255,
      height: 150,
      colors: ['#f04b3b', '#2f95a5', '#ffffff'],
      backgroundColor: 'transparent',
      legend: {
        position: "right"
      }
    };


    var elm = `campaign-result`
    var element = document.getElementById(elm)
    var chart = new google.visualization.PieChart(element);
    chart.draw(view, options);
}

function plotVoteResult(result){
    var params = [];
    var color = ['#f04b3b', '#2f95a5', '#ffffff']
    var arr = ['Results', '#', { role: "style" } ];
    params.push(arr);
    for (var key of Object.keys(result)){
      //var item = [key, result[key], color[i]];
      var item = [key, result[key], ""];
      params.push(item);
    }
    var data = google.visualization.arrayToDataTable(params);
    var view = new google.visualization.DataView(data);
    view.setColumns([0, 1,
                    { calc: "stringify",
                       sourceColumn: 1,
                       type: "string",
                       role: "annotation"
                    },
                    2]);
    /*
    var options = {
      title: params[0][0],
      vAxis: {minValue: 0},
      hAxis: {minValue: 0},
      width: 240,
      height: 150,
      bar: {groupWidth: "40%"},
      legend: { position: "none" },
      backgroundColor: 'transparent'
    };
    */
    var options = {
      title: 'Campaign report',
      width: 255,
      height: 150,
      colors: ['#138B8C', '#134B8C', '#FFC300'],
      backgroundColor: 'transparent',
      legend: {
        position: "right"
      }
    };


    var element = document.getElementById(`vote-result`)
    //var chart = new google.visualization.ColumnChart(element);
    var chart = new google.visualization.PieChart(element);
    chart.draw(view, options);
}

function downloadReport(format){
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var url = "downloadbatchreport?format=" + format + "&timeOffset=" + timeOffset
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok")
      window.location.href = res.message
    else
      alert(res.message)
  });
}
