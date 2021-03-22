var campaignList = undefined
var voteReportList = undefined
var selectedElement = null
var selectedBatchId = ""
var pollingBatchReportTimer = null
var pollingVoteResultTimer = null
var loaded = 0
var timeOffset = 0
function init(){
  google.charts.load('current', {'packages':['corechart'], callback: onloaded});

  window.onresize = function() {
    setElementsHeight()
  }
  setElementsHeight()

  selectedElement = null
  $(`#${mainMenuItem}`).removeClass("active")
  mainMenuItem = "campaign-new"
  $(`#${mainMenuItem}`).addClass("active")
  timeOffset = new Date().getTimezoneOffset()*60000;
}

function setElementsHeight(){
  var height = $(window).height() - $("#footer").outerHeight(true);
  var swindow = height - $("#menu_header").height()
  $("#history-list-column").height(swindow - $("#history-info-block").outerHeight(true))
  var upperBlock = $("#history-info-block").outerHeight(true) + $("#history-header").outerHeight(true) + 50
  $("#history-list").height(swindow - upperBlock)
  $("#menu-pane").height(swindow)
  $("#control-block").height(swindow)
  $("#creation-pane").height(swindow)
  $("#rejected-list-block").height(swindow - 50)
}
var setHeight = false
function setCampaignHistoryListHeight(){
  var height = $(window).height() - $("#footer").outerHeight(true);
  var swindow = height - $("#menu_header").height()
  $("#history-list-column").height(swindow - $("#history-info-block").outerHeight(true))
  var upperBlock = $("#history-info-block").outerHeight(true) + $("#history-header").outerHeight(true) + 50
  $("#history-list").height(swindow - upperBlock)
}

function onloaded(){
  loaded++
  if (loaded == 3){
    readCampaigns()
  }
}

function readCampaigns(){
  if (pollingBatchReportTimer)
    window.clearTimeout(pollingBatchReportTimer)
  var url = "/read-campaigns"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      campaignList = res.campaigns
      voteReportList = res.voteReports
      if (campaignList.length == 0)
        createNewCampaign()
      else
        $("#history").show()

      listAllCampaigns(res.recentBatch)
    }else if (res.status == "error" || res.status == "failed"){
      _alert(res.message)
    }else{
      window.setTimeout(function(){
        window.location.href = "/index"
      },10000)
    }
  });
}

function readCampaignById(elm, batchId){
  if (selectedElement != null)
      $(selectedElement).removeClass("active");
  $(elm).addClass("active");
  selectedElement = elm

  // read from local memory
  var campaign = campaignList.find(o => o.batchId == batchId)
  selectedBatchId = batchId
  console.log(selectedBatchId)
  displaySelectedCampaign(campaign)
  /*
  if (campaign && campaign.sentCount > 0){
    readCampaignFromServer(campaign)
  }else{
    displaySelectedCampaign(campaign)
  }
  */
}

function readCampaignFromServer(campaign){
  if (pollingBatchReportTimer)
    window.clearTimeout(pollingBatchReportTimer)
  var url = `read-campaign-summary?batchId=${campaign.batchId}`
  var getting = $.get( url );
  getting.done(function( res ) {
      if (res.status == "ok"){
        var batchReport = res.batchReport
        campaign.queuedCount = batchReport.queuedCount
        campaign.deliveredCount = batchReport.deliveredCount
        campaign.sentCount = batchReport.sentCount
        campaign.unreachableCount = batchReport.unreachableCount
        campaign.totalCost = batchReport.totalCost
        //listAllCampaigns(undefined)
        updateThisCampaign(campaign)
      }else if (res.status == "error" || res.status == "failed"){
        _alert(res.message)
      }else{
        window.setTimeout(function(){
          window.location.href = "/index"
        },10000)
      }
  });
}

function listAllCampaigns(recentBatch){
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var html = ""
  for (var item of campaignList) {
    var date = new Date(item.creationTime)
    var timestamp = item.creationTime - timeOffset
    date = new Date (timestamp)
    var dateStr = date.toISOString()
    dateStr = dateStr.replace("T", " ").substring(0, 16)

    html += `<div id="${item.batchId}" class="row col-lg-12 history-item" onclick="readCampaignById(this, '${item.batchId}')">`
    html += `<div class="row col-lg-3">${item.campaignName}</div>`
    html += `<div class="col-lg-2">${dateStr}</div>`
    html += `<div class="col-lg-1">${item.totalCount}</div>`
    if (item.type == "vote"){
      html += `<div class="col-lg-1">Survey</div>`
    }else if (item.type == "group")
      html += `<div class="col-lg-1">Broadcast</div>`
    else if (item.type == "customized")
      html += `<div class="col-lg-1">Tailored</div>`
    else
      html += `<div class="col-lg-1">Toll-Free</div>`

    // mashup with vote result
    var found = false
    var cost = item.totalCost
    console.log("batch cost " + item.totalCost)
    for (var vote of voteReportList){
      if (vote.batchId == item.batchId){
        html += `<div class="col-lg-2">${vote.status}</div>`
        cost += vote.voteCounts.Cost
        console.log("vote Cost " + vote.voteCounts.Cost)
        found = true
        break
      }
    }
    if (!found){
      if (item.type == "vote"){
        if (item.voteReport){
          html += `<div class="col-lg-2">${item.voteReport.status}</div>`
          cost += item.voteReport.voteCounts.Cost
        }else
          html += `<div class="col-lg-2">Deleted</div>`
      }else
        html += `<div class="col-lg-2">--</div>`
    }

    console.log("total Cost " + cost)
    if (cost < 1.00)
      cost = cost.toFixed(3)
    else if (cost < 10.00)
      cost = cost.toFixed(2)
    else
      cost = cost.toFixed(1)
    html += `<div class="col-lg-2">${cost} USD</div>`
    var total = item.queuedCount + item.sentCount + item.deliveredCount + item.unreachableCount

    if (total == 0){
      console.log("adjusted")
      console.log(item)
      total = item.totalCount
      item.unreachableCount = total
    }

    var progress = (item.deliveredCount/total) * 100
    progress = progress.toFixed(0)
    html += `<div class="col-lg-1">${progress}%</div>`
    html += "</div>"
  }
  $("#history-list").html(html)

  var recentVote = undefined
  if (recentBatch){
    selectedBatchId = recentBatch.batchId
  }else{
    if (selectedBatchId != ""){
      recentBatch = campaignList.find(o => o.batchId === selectedBatchId)
    }else{
      recentBatch = campaignList[0]
      selectedBatchId = recentBatch.batchId
    }
  }

  selectedElement = $(`#${selectedBatchId}`)
  $(selectedElement).addClass("active");
  displaySelectedCampaign(recentBatch)

  if (isAnyActiveVote()){
    pollingVoteResultTimer = window.setTimeout(function(){
      readVoteResult()
    }, 2000)
  }
  checkPendingCampaign()
}

function updateThisCampaign(campaign){
  var date = new Date(campaign.creationTime)
  var timestamp = campaign.creationTime - timeOffset
  date = new Date (timestamp)
  var dateStr = date.toISOString()
  dateStr = dateStr.replace("T", " ").substring(0, 16)

  //html += `<div id="${item.batchId}" class="row col-lg-12 history-item" onclick="readCampaignById(this, '${item.batchId}')">`
  var html = `<div class="row col-lg-3">${campaign.campaignName}</div>`
  html += `<div class="col-lg-2">${dateStr}</div>`
  html += `<div class="col-lg-1">${campaign.totalCount}</div>`
  if (campaign.type == "vote"){
    html += `<div class="col-lg-1">Survey</div>`
  }else if (campaign.type == "group")
    html += `<div class="col-lg-1">Broadcast</div>`
  else if (campaign.type == "customized")
    html += `<div class="col-lg-1">Tailored</div>`
  else
    html += `<div class="col-lg-1">Toll-Free</div>`

  // mashup with vote result
  var found = false
  var cost = campaign.totalCost
  console.log("batch cost " + campaign.totalCost)
  for (var vote of voteReportList){
    if (vote.batchId == campaign.batchId){
      html += `<div class="col-lg-2">${vote.status}</div>`
      cost += vote.voteCounts.Cost
      console.log("vote Cost " + vote.voteCounts.Cost)
      found = true
      break
    }
  }
  if (!found){
    if (campaign.type == "vote"){
      if (campaign.voteReport){
        html += `<div class="col-lg-2">${campaign.voteReport.status}</div>`
        cost += campaign.voteReport.voteCounts.Cost
      }else
        html += `<div class="col-lg-2">Deleted</div>`
    }else
      html += `<div class="col-lg-2">--</div>`
  }

  console.log("total Cost " + cost)
  if (cost < 1.00)
    cost = cost.toFixed(3)
  else if (cost < 10.00)
    cost = cost.toFixed(2)
  else
    cost = cost.toFixed(1)
  html += `<div class="col-lg-2">${cost} USD</div>`
  var total = campaign.queuedCount + campaign.sentCount + campaign.deliveredCount
  var progress = (campaign.deliveredCount/total) * 100
  progress = progress.toFixed(0)
  html += `<div class="col-lg-1">${progress}%</div>`

  $(`#${campaign.batchId}`).html(html)

  if (selectedBatchId == campaign.batchId)
    displaySelectedCampaign(campaign)
  checkPendingCampaign()
}

function checkPendingCampaign(){
  var liveCampaign = isAnyLiveCampaign()
  if (liveCampaign){ // keep polling a campaign with message(s) in queued status
    pollingBatchReportTimer = window.setTimeout(function(){
      readCampaignFromServer(liveCampaign)
    }, 2000)
  }else{
    var pendingCampaign = isAllSentCampaign()
    if (pendingCampaign){ // keep polling a campaign with message(s) in sent status
      pollingBatchReportTimer = window.setTimeout(function(){
        readCampaignFromServer(pendingCampaign)
      }, 5000)
    }
  }
}

function readVoteResult(){
  var url = "/read-vote-reports"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      voteReportList = res.voteReports
      for (var vote of voteReportList){
        var campaign = campaignList.find(o => o.batchId === vote.batchId)
        if (campaign){
          updateThisCampaign(campaign)
        }
      }
      if (isAnyActiveVote()){
        pollingVoteResultTimer = window.setTimeout(function(){
          readVoteResult()
        }, 2000)
      }
    }else if (res.status == "error" || res.status == "failed"){
      _alert(res.message)
    }else{
      window.setTimeout(function(){
        window.location.href = "/index"
      },10000)
    }
  });
}

function displaySelectedCampaign(batchReport){

  var timestamp = batchReport.creationTime - timeOffset
  var createdDate = new Date (timestamp)
  var createdDateStr = createdDate.toISOString()
  createdDateStr = createdDateStr.replace("T", " ").substring(0, 19)

  var label = (selectedBatchId == "") ? "Recent campaign " : "Selected campaign "
  var title = `<label class="label-input">${label}</label><span>${batchReport.campaignName}</span>`
  $("#campaign-title").html( title )
  var report = `<div>`
  report += `<div class="info-line"><img class="medium-icon" src="../img/creation-date.png"></img> ${createdDateStr}</div>`
  report += `<div class="info-line"><img class="medium-icon" src="../img/sender.png"></img> ${formatPhoneNumber(batchReport.serviceNumber)}</div>`
  report += `<div class="info-line"><img class="medium-icon" src="../img/recipient.png"></img> ${batchReport.totalCount} recipients </div>`

  report += `<div class="info-line"><img class="medium-icon" src="../img/cost.png"></img> USD ${batchReport.totalCost.toFixed(3)}</div>`
  //var msg = (batchReport.message.length > 50) ? (batchReport.message.substring(0, 50) + "...") : batchReport.message
  report += `<p class="info-line"><img class="medium-icon" src="../img/message.png"></img> ${batchReport.message}</p>`

  $("#campaign-details").html(report)

  var params = [];
  var arr = ['Results', '#'];
  params.push(arr);
  var item = ["Pending", batchReport.queuedCount];
  params.push(item);
  item = ["Sent", batchReport.sentCount]
  params.push(item);
  item = ["Delivered", batchReport.deliveredCount]
  params.push(item);
  item = ["Failed", batchReport.unreachableCount]
  params.push(item);

  plotBatchReport(params)
  // display vote report
  var archived = false
  console.log(batchReport)
  if (batchReport.type == "vote"){
    var voteReport = voteReportList.find(o => o.batchId === batchReport.batchId)
    console.log(voteReport)
    console.log(selectedBatchId)
    if (voteReport == undefined){
      archived = true
      recentBatch = campaignList.find(o => o.batchId === selectedBatchId)
      voteReport = batchReport.voteReport
    }
    console.log(voteReport)
    $("#vote-report").show()
    if (voteReport == undefined){
      console.log("display this?")
      $("#vote-result").html("")
      $("#vote-details").html("This survey result has been deleted.")
    }else{
      $("#vote-report").show()
      $("#vote-details").html(createVoteReport(voteReport, archived))
      plotVoteResult(voteReport.voteResults)
    }
  }else{
    $("#vote-report").hide()
  }
  if (!setHeight){
    setCampaignHistoryListHeight()
    setHeight = true
  }
}

function plotBatchReport(params){
    var data = google.visualization.arrayToDataTable(params);
    var view = new google.visualization.DataView(data);
    var options = {
      title: 'Campaign report',
      width: 265,
      height: 150,
      slices: {0: {color: '#ffffff'}, 1:{color: '#2280c9'}, 2:{color: '#2f95a5'}, 3: {color: '#f04b3b'}},
      backgroundColor: 'transparent',
      legend: {
        position: "right",
      },
      pieSliceText: 'value'
    };

    var elm = `campaign-result`
    var element = document.getElementById(elm)
    var chart = new google.visualization.PieChart(element);
    chart.draw(view, options);
}

function createVoteReport(voteReport, archived){
  var report = "<div>"
  var status = "Status: response period is closed"
  if (voteReport.status == "Completed"){
    status = "Survey is completed."
  }else if(voteReport.status == "Closed"){
    status = "Survey is closed."
  }else{
    var now = new Date().getTime()
    var expire = voteReport.endDateTime - now
    if (expire >= 0){
      status = "Response period expires in " + formatSendingTime(expire/1000)
      reload = true
    }else{
      status = "Survey is closed."
    }
  }
  if (voteReport.status == "Completed")
    report += `<div class="info-line"><img class="medium-icon" src="../img/completed.png"></img> ${status}</div>`
  else if (voteReport.status == "Closed")
    report += `<div class="info-line"><img class="medium-icon" src="../img/closed.png"></img> ${status}</div>`
  else
    report += `<div class="info-line"><img class="medium-icon" src="../img/status.png"></img> ${status}</div>`

  report += `<div class="info-line"><img class="medium-icon" src="../img/unreachable.png"></img> ${voteReport.voteCounts.Unreachable} unreached</div>`
  report += `<div class="info-line"><img class="medium-icon" src="../img/replied.png"></img> ${voteReport.voteCounts.Replied} / ${voteReport.voteCounts.Delivered} replied</div>`
  report += `<div class="info-line"><img class="medium-icon" src="../img/cost.png"></img> USD ${voteReport.voteCounts.Cost.toFixed(3)}</div>`
  if (!archived){
    if (voteReport.status != "Active"){
      report += `<p><img class="medium-icon" src="../img/stop.png"></img> This survey result will be deleted in 24 hours!</p>`
    }
    report += `<div class="info-line"><a href="javascript:downloadSurveyResult('${voteReport.batchId}')">Download Detailed Result</a> | `
    report += `<a href="javascript:deleteSurveyResult('${voteReport.batchId}')">Delete Detailed Result</a></div>`
  }else{
    report += `<p><img class="medium-icon" src="../img/stop.png"></img> This survey detailed result was deleted!</p>`
  }
  report += `<a href="javascript:emailSurveyResult('${voteReport}')">Share Result</a></div>`
  report += "</div>"
  return report
}

function plotVoteResult(result){
    var params = [];
    //var color = ['#f04b3b', '#2f95a5', '#ffffff']
    var colors = ['#138B8C', '#134B8C', '#FFC300']
    var arr = ['Vote', '#', { role: 'annotation'}, { role: "style" }];
    params.push(arr);
    var i = 0
    for (var key of Object.keys(result)){
      var item = [key, result[key], `${result[key]}`, colors[i]];
      params.push(item);
      i++
    }
    var data = google.visualization.arrayToDataTable(params);
    var view = new google.visualization.DataView(data);
    var options = {
      title: "Survey result",
      vAxis: {minValue: 0},
      hAxis: {minValue: 0},
      width: 240,
      height: 150,
      bar: {groupWidth: "40%"},
      legend: { position: "none" },
      backgroundColor: 'transparent'
    };

    var element = document.getElementById(`vote-result`)
    var chart = new google.visualization.ColumnChart(element);
    chart.draw(view, options);
}

function emailSurveyResult(voteReport){
  var subject = "&subject=Survey result"
  var result = ""
  for (var key of Object.keys(result)){
    result = `${result[key]} persons voted for ${key}\n`
  }
  var body = "&body=" + escape(result)
  var mailto = "mailto:phong.vu@ringcentral.com?"
  var mail = mailto + subject + body
  console.log(mail)
  window.location.href = mailto + subject + body
}

function isAnyActiveVote(){
  for (var vote of voteReportList){
    if (vote.status === "Active"){
      return true
    }
  }
  return false
}

function isAnyLiveCampaign(){
  for (var campaign of campaignList){
    if (campaign.live){
      return campaign
    }
  }
  return null
}

function isAllSentCampaign(){
  for (var campaign of campaignList){
    if (campaign.sentCount > 0){
      return campaign
    }
  }
  return null
}

function deleteSurveyResult(batchId){
  var url = `delete-survey-result?batchId=${batchId}`
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      readCampaigns()
    }else if (res.status == "error" || res.status == "failed"){
      _alert(res.message)
    }else{
      window.setTimeout(function(){
        window.location.href = "/index"
      },10000)
    }
  });
}

function downloadSurveyResult(batchId){
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var url = `download-survey-result?batchId=${batchId}&timeOffset=${timeOffset}`
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      window.location.href = res.message
    }else if (res.status == "error" || res.status == "failed"){
      _alert(res.message)
    }else{
      window.setTimeout(function(){
        window.location.href = "/index"
      },10000)
    }
  });
}
/*

function downloadReport(format){
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var url = "downloadbatchreport?format=" + format + "&timeOffset=" + timeOffset
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok")
      window.location.href = res.message
    else{
      console.log(res.message)
      alert(res.message)
    }
  });
}
*/
