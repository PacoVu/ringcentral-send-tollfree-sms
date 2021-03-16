var campaignList = undefined
var voteReportList = undefined
var selectedCampaign = null
var selectedBatchId = ""
var pollingBatchReport = null
var loaded = 0
function init(){
  google.charts.load('current', {'packages':['corechart'], callback: onloaded});
  var height = $(window).height() - $("#footer").outerHeight(true);
  window.onresize = function() {
    var height = $(window).height() - $("#footer").outerHeight(true);
    var swindow = height - $("#menu_header").outerHeight(true)
    $("#history-list-column").height(swindow - $("#history-info-block").outerHeight(true))
    var upperBlock = $("#history-info-block").outerHeight(true) + $("#history-header").outerHeight(true) + 50
    $("#history-list").height(swindow - upperBlock)

    $("#menu-pane").height(swindow)
    $("#control-block").height(swindow)
    $("#creation-pane").height(swindow)
  }
  var swindow = height - $("#menu_header").height()

  $("#history-list-column").height(swindow - $("#history-info-block").outerHeight(true))

  var upperBlock = $("#history-info-block").outerHeight(true) + $("#history-header").outerHeight(true) + 50
  $("#history-list").height(swindow - upperBlock)

  $("#menu-pane").height(swindow)
  $("#control-block").height(swindow)
  $("#creation-pane").height(swindow)
  //rejected-list-block
  selectedCampaign = null
  $(`#${mainMenuItem}`).removeClass("active")
  mainMenuItem = "campaign-new"
  $(`#${mainMenuItem}`).addClass("active")
}

function onloaded(){
  loaded++
  if (loaded == 3){
    readCampaigns()
  }
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
      voteReportList = res.voteReports
      if (campaignList.length == 0)
        createNewCampaign()
      else
        $("#history").show()

      listAllCampaigns(res.recentBatch)
    }else if (res.status == "failed") {
      alert(res.message)
      window.location.href = "login"
    }else{
      alert(res.message)
    }
  });
}

function readCampaignById(elm, batchId){
  if (selectedCampaign != null)
      $(selectedCampaign).removeClass("active");
  $(elm).addClass("active");
  selectedCampaign = elm

  // read from local memory
  var campaign = campaignList.find(o => o.batchId == batchId)
  selectedBatchId = batchId

  //return readCampaignFromServer(campaign)
  if (campaign && campaign.sentCount > 0){
    readCampaignFromServer(campaign)
  }else{
    displaySelectedCampaign(campaign)
  }
}

function readCampaignFromServer(campaign){
  if (pollingBatchReport)
    window.clearTimeout(pollingBatchReport)
  var url = `read-campaign-summary?batchId=${campaign.batchId}`
  var getting = $.get( url );
  getting.done(function( res ) {
      if (res.status == "ok"){
        var batchReport = res.batchReport
        console.log(batchReport)
        campaign.queuedCount = batchReport.queuedCount
        campaign.deliveredCount = batchReport.deliveredCount
        campaign.sentCount = batchReport.sentCount
        campaign.unreachableCount = batchReport.unreachableCount
        campaign.totalCost = batchReport.totalCost
        listAllCampaigns(undefined)
      }else if (res.status == "failed") {
        alert(res.message)
        window.location.href = "login"
      }else{
        alert(res.message)
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
    for (var vote of voteReportList){
      if (vote.batchId == item.batchId){
        html += `<div class="col-lg-2">${vote.status}</div>`
        cost += vote.voteCounts.Cost
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

    if (item.hasOwnProperty('voteReport'))


    if (cost < 1.00)
      cost = cost.toFixed(3)
    else if (cost < 10.00)
      cost = cost.toFixed(2)
    else
      cost = cost.toFixed(1)
    html += `<div class="col-lg-2">${cost} USD</div>`
    if (item.sentCount > 0){
      var total = item.sentCount + item.deliveredCount
      var percent = (item.deliveredCount/total) * 100
      percent = percent.toFixed(0)
      html += `<div class="col-lg-1">${percent}%</div>`
    }else
      html += `<div class="col-lg-1">100%</div>`
    html += "</div>"
  }
  $("#history-list").html(html)

  var recentVote = undefined
  if (selectedBatchId != ""){
    recentBatch = campaignList.find(o => o.batchId === selectedBatchId)
    //recentVote = voteReportList.find(o => o.batchId === selectedBatchId)
  //}else if (recentBatch){
  //  recentVote = voteReportList.find(o => o.batchId === recentBatch.batchId)
  }else{
    recentBatch = campaignList[0]
    //recentVote = voteReportList.find(o => o.batchId === recentBatch.batchId)
  }
  // extra check
  //if (!recentVote)
  //  recentVote = recentBatch.voteReport
  selectedBatchId = recentBatch.batchId
  selectedCampaign = $(`#${selectedBatchId}`)
  $(selectedCampaign).addClass("active");
  displaySelectedCampaign(recentBatch)

  //if (isAnyLiveCampaign() || isAnyActiveVote()){
  if (isAnyActiveVote()){
    pollingBatchReport = window.setTimeout(function(){
      readCampaigns()
    }, 2000)
  }
}


function displaySelectedCampaign(batchReport){
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var timestamp = batchReport.creationTime - timeOffset
  var createdDate = new Date (timestamp)
  var createdDateStr = createdDate.toISOString()
  createdDateStr = createdDateStr.replace("T", " ").substring(0, 19)
  //$("#campaign-title").html(batchReport.campaignName)
  var label = (selectedBatchId == "") ? "Recent campaign " : "Selected campaign "
  var title = `<label class="label-input">${label}</label><span>${batchReport.campaignName}</span>`
  $("#campaign-title").html( title )
  var report = `<div>`
  report += `<div class="info-line"><img class="medium-icon" src="../img/creation-date.png"></img> ${createdDateStr}</div>`
  report += `<div class="info-line"><img class="medium-icon" src="../img/sender.png"></img> ${formatPhoneNumber(batchReport.serviceNumber)}</div>`
  report += `<div class="info-line"><img class="medium-icon" src="../img/recipient.png"></img> ${batchReport.totalCount} recipients </div>`

  report += `<div class="info-line"><img class="medium-icon" src="../img/cost.png"></img> USD ${batchReport.totalCost.toFixed(3)}</div>`
  var msg = (batchReport.message.length > 50) ? (batchReport.message.substring(0, 50) + "...") : batchReport.message
  report += `<p class="info-line"><img class="medium-icon" src="../img/message.png"></img> ${msg}</p>`

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
  if (batchReport.type == "vote"){
    var voteReport = voteReportList.find(o => o.batchId === batchReport.batchId)
    if (!voteReport){
      archived = true
      recentBatch = campaignList.find(o => o.batchId === selectedBatchId)
      voteReport = batchReport.voteReport
    }

    $("#vote-report").show()
    if (voteReport == undefined){
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
        //position: 'labeled',
        //labeledValueText: 'both',
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
    report += `<div class="info-line"><a href="javascript:downloadCampaignResult('${voteReport.batchId}','${voteReport.serviceNumber}')">Download Result</a> | `
    report += `<a href="javascript:deleteCampaignResult('${voteReport.batchId}')">Delete Result</a></div>`
  }
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
      return true
    }
  }
  return false
}

function isAllSentCampaign(){
  for (var campaign of campaignList){
    if (campaign.sentCount > 0){
      return true
    }
  }
  return false
}

function deleteCampaignResult(batchId){
  var url = `deletecampainresult?batchId=${batchId}`
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok")
      readCampaigns()
    else
      alert(res.message)
  });
}

function downloadCampaignResult(batchId, serviceNumber){
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var url = `downloadcampainresult?batchId=${batchId}&timeOffset=${timeOffset}&serviceNumber=${serviceNumber}`
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok")
      window.location.href = res.message
    else
      alert(res.message)
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
