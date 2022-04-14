var campaignList = undefined
var selectedElement = null
var selectedBatchIndex = -1
var pollingLiveBatchTimer = null
var pollingScheduledBatchTimer = null
var pollingIncompletedBatchTimer = null
var loaded = 0
var timeOffset = 0
function init(){
  //google.charts.load('current', {'packages':['corechart'], callback: onloaded});
  google.charts.load('current', {'packages':['corechart']});
  google.charts.setOnLoadCallback(onloaded);
  window.onresize = function() {
    setElementsHeight()
  }
  setElementsHeight()

  selectedElement = null
  $(`#${mainMenuItem}`).removeClass("active")
  mainMenuItem = "campaign-new"
  $(`#${mainMenuItem}`).addClass("active")
  timeOffset = new Date().getTimezoneOffset()*60000;
  var readingAni = "<img src='./img/logging.gif' style='width:50px;height:50px;display: block;margin:auto;'></img>"
  $("#history-list").html(readingAni)
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
  if (loaded == 1){
    window.setTimeout(function(){
      readCampaigns()
    }, 1000)
  }
}

function readCampaigns(){
  if (pollingScheduledBatchTimer){
    window.clearTimeout(pollingScheduledBatchTimer)
  }
  pollingScheduledBatchTimer = undefined
  var url = "/read-campaigns"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      campaignList = res.campaigns
      if (campaignList.length == 0){
        createNewCampaign()
      }else{
        if ($("#create").css("display") == "none")
          $("#history").show()
        else
          return
      }
      listAllCampaigns(undefined)
    }else if (res.status == "error"){
      _alert(res.message)
    }else{
      if (res.message)
        _alert(res.message)
      else
        _alert("You have been logged out. Please login again.")
      window.setTimeout(function(){
        window.location.href = "/relogin"
      },8000)
    }
  });
}

function showScheduledCampaign(elm, creationTime){
  if (selectedElement != null)
      $(selectedElement).removeClass("active");
  $(elm).addClass("active");
  selectedElement = elm

  // read from local memory
  var campaign = campaignList.find(o => o.creationTime == creationTime)
  selectedBatchIndex = elm.id
  displayScheduledCampaign(campaign)
}

function readCampaignById(elm, batchId){
  if (batchId == ''){
    _alert(`This campaign is scheduled!`, "Information")
    return
  }
  if (selectedElement != null)
      $(selectedElement).removeClass("active");
  $(elm).addClass("active");
  selectedElement = elm

  // read from local memory
  selectedBatchIndex = campaignList.findIndex(o => o.batchId == batchId)
  if (selectedBatchIndex < 0)
    selectedBatchIndex = 0
  var campaign = campaignList[selectedBatchIndex]
  displaySelectedCampaign(campaign)
}

function readCampaignFromServer(campaign){
  if (pollingLiveBatchTimer){
    window.clearTimeout(pollingLiveBatchTimer)
  }
  pollingLiveBatchTimer = undefined
  if (pollingIncompletedBatchTimer){
    window.clearTimeout(pollingIncompletedBatchTimer)
  }
  pollingIncompletedBatchTimer = undefined

  var url = 'read-campaign-summary'
  var params = {
      batchId: campaign.batchId,
      ts: campaign.creationTime,
      number: campaign.serviceNumber
    }

  var getting = $.get( url, params );
  getting.done(function( res ) {
      if (res.status == "ok"){
        var batchReport = res.batchReport
        campaign.queuedCount = batchReport.queuedCount
        campaign.deliveredCount = batchReport.deliveredCount
        campaign.sentCount = batchReport.sentCount
        campaign.unreachableCount = batchReport.unreachableCount
        campaign.totalCost = batchReport.totalCost
        //listAllCampaigns(undefined)
        //var index = campaignList.findIndex(o => o.batchId == campain.batchId)
        updateThisCampaign(campaign)
      }else if (res.status == "error"){
        _alert(res.message)
      }else{
        if (res.message)
          _alert(res.message)
        else
          _alert("You have been logged out. Please login again.")
        window.setTimeout(function(){
          window.location.href = "/relogin"
        },8000)
      }
  });
}

function listAllCampaigns(recentBatch){
  if (campaignList.length == 0)
    return
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var html = ""
  var index = 0
  for (var item of campaignList) {
    // need this for parsing old campaign w/o schedule and sendAt data
    var scheduled = false
    if (item.hasOwnProperty('scheduled')){
      scheduled = item.scheduled
    }
    //

    if (item.type == "tollfree") continue
    var date = new Date(item.creationTime)
    var timestamp = item.creationTime - timeOffset
    date = new Date (timestamp)
    var dateStr = date.toISOString()
    dateStr = dateStr.replace("T", " ").substring(0, 16)
    if (scheduled && item.batchId == ''){
      html += `<div id="${index}" class="row col-lg-12 history-item" style="background: orange" onclick="showScheduledCampaign(this, '${item.creationTime}')">`
    }else
      html += `<div id="${index}" class="row col-lg-12 history-item" onclick="readCampaignById(this, '${item.batchId}')">`
    index++
    html += `<div class="row col-lg-5">${item.campaignName}</div>`

    html += `<div class="col-lg-2">${dateStr}</div>`
    html += `<div class="col-lg-1">${item.totalCount}</div>`
    if (item.type == "group")
      html += `<div class="col-lg-1">Broadcast</div>`
    else if (item.type == "customized")
      html += `<div class="col-lg-1">Tailored</div>`
    else
      html += `<div class="col-lg-1">Toll-Free</div>`

    var cost = item.totalCost
    //console.log("total Cost " + cost)
    if (cost < 1.00)
      cost = cost.toFixed(3)
    else if (cost < 10.00)
      cost = cost.toFixed(2)
    else
      cost = cost.toFixed(1)
    html += `<div class="col-lg-2">${cost} USD</div>`
    var total = item.queuedCount + item.sentCount + item.deliveredCount + item.unreachableCount

    if (total == 0){
      total = item.totalCount
    }
    if (scheduled && item.batchId == ''){
      html += `<div class="col-lg-1">Scheduled</div>`
    }else{
      var progress = (item.deliveredCount/total) * 100
      if (progress != 0)
        progress = progress.toFixed(0)
      html += `<div class="col-lg-1">${progress}%</div>`
    }
    html += "</div>"
  }
  $("#history-list").html(html)

  if (recentBatch){
    selectedBatchIndex = campaignList.findIndex(o => o.batchId === recentBatch.batchId)
  }else{
    if (selectedBatchIndex >= 0){
      recentBatch = campaignList[selectedBatchIndex]
    }else{
      selectedBatchIndex = 0
      recentBatch = campaignList[selectedBatchIndex]
    }
  }

  selectedElement = $(`#${selectedBatchIndex}`)
  $(selectedElement).addClass("active");
  if (recentBatch.batchId == '')
    displayScheduledCampaign(recentBatch)
  else
    displaySelectedCampaign(recentBatch)
  checkPendingCampaign()
}

function updateThisCampaign(campaign){
  var date = new Date(campaign.creationTime)
  var timestamp = campaign.creationTime - timeOffset
  date = new Date (timestamp)
  var dateStr = date.toISOString()
  dateStr = dateStr.replace("T", " ").substring(0, 16)

  //html += `<div id="${item.batchId}" class="row col-lg-12 history-item" onclick="readCampaignById(this, '${item.batchId}')">`
  var html = `<div class="row col-lg-5">${campaign.campaignName}</div>`
  html += `<div class="col-lg-2">${dateStr}</div>`
  html += `<div class="col-lg-1">${campaign.totalCount}</div>`
  if (campaign.type == "group")
    html += `<div class="col-lg-1">Broadcast</div>`
  else if (campaign.type == "customized")
    html += `<div class="col-lg-1">Tailored</div>`
  else
    html += `<div class="col-lg-1">Toll-Free</div>`

  var cost = campaign.totalCost
  if (cost < 1.00)
    cost = cost.toFixed(3)
  else if (cost < 10.00)
    cost = cost.toFixed(2)
  else
    cost = cost.toFixed(1)
  html += `<div class="col-lg-2">${cost} USD</div>`
  var total = campaign.queuedCount + campaign.sentCount + campaign.deliveredCount + campaign.unreachableCount

  if (total == 0){
    total = campaign.totalCount
  }

  var progress = (campaign.deliveredCount/total) * 100

  if (progress != 0)
    progress = progress.toFixed(0)

  html += `<div class="col-lg-1">${progress}%</div>`

  var index = campaignList.findIndex(o => o.batchId === campaign.batchId)
  $(`#${index}`).html(html)
  if (selectedBatchIndex == index)
    displaySelectedCampaign(campaign)
  checkPendingCampaign()
}

function displayScheduledCampaign(batchReport){
  var timestamp = batchReport.creationTime - timeOffset
  var createdDate = new Date (timestamp)
  var createdDateStr = createdDate.toISOString()
  createdDateStr = createdDateStr.replace("T", " ").substring(0, 16)
  timestamp = batchReport.sendAt - timeOffset
  var sendDate = new Date (timestamp)
  var sendDateStr = sendDate.toISOString()
  sendDateStr = sendDateStr.replace("T", " ").substring(0, 16)
  var label = "Campaign "
  var title = `<label class="label-input">${label}</label><span>${batchReport.campaignName}</span>`
  $("#campaign-title").html( title )
  var report = `<div>`
  report += `<div class="info-line"><img class="medium-icon" src="../img/creation-date.png"></img> ${sendDateStr}</div>`
  report += `<div class="info-line"><img class="medium-icon" src="../img/sender.png"></img> ${formatPhoneNumber(batchReport.serviceNumber)}</div>`
  report += `<div class="info-line"><img class="medium-icon" src="../img/recipient.png"></img> ${batchReport.totalCount} recipients </div>`
  report += `<div class="info-line"><img class="medium-icon" src="../img/cost.png"></img> N/A</div>`
  report += `<p class="info-line"><img class="medium-icon" src="../img/message.png"></img> ${batchReport.message}</p>`

  $("#campaign-details").html(report)

  var params = [];
  var arr = ['Results', '#'];
  params.push(arr);
  var item = ["Scheduled", batchReport.totalCount];
  params.push(item);

  //plotBatchReport(params)
  var data = google.visualization.arrayToDataTable(params);
  var view = new google.visualization.DataView(data);
  var options = {
    title: 'Campaign report',
    width: 265,
    height: 150,
    slices: {0: {color: 'orange'}, 1:{color: '#2280c9'}, 2:{color: '#2f95a5'}, 3: {color: '#f04b3b'}},
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
  // display vote report

  $("#vote-report").show()
  //$("#vote-result").hide()
  timestamp = new Date().getTime()
  timestamp = (batchReport.sendAt - timestamp) / 1000
  var report = `<div>This campaign will be sent in ${formatEstimatedTimeLeft(timestamp)}.<div>`
  report += `<br><div><button class="form-control rc-oval-btn" onclick="cancelScheduleWarning('${batchReport.creationTime}');">Cancel scheduled campaign</button></div>`
  $("#vote-result").html('')
  $("#vote-details").html(report)

  if (!setHeight){
    setCampaignHistoryListHeight()
    setHeight = true
  }
}

function displaySelectedCampaign(batchReport){
  var timestamp = batchReport.creationTime - timeOffset
  var createdDate = new Date (timestamp)
  var createdDateStr = createdDate.toISOString()
  createdDateStr = createdDateStr.replace("T", " ").substring(0, 16)

  var label = (selectedBatchIndex < 0) ? "Recent campaign " : "Selected campaign "
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
  if (selectedBatchIndex >= 0){
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
  }else{
    var arr = ['Results', '#'];
    params.push(arr);
    var item = ["Scheduled", batchReport.totalCount];
    params.push(item);
  }
  plotBatchReport(params)
  // display vote report
  var archived = false
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

function checkPendingCampaign(){
  var liveCampaign = isAnyLiveCampaign()
  if (liveCampaign){ // keep polling a campaign with message(s) in queued status
    if (!pollingLiveBatchTimer){
      pollingLiveBatchTimer = window.setTimeout(function(){
        readCampaignFromServer(liveCampaign)
      }, 2000)
    }
  }else{
    var pendingCampaign = isAllSentCampaign()
    if (pendingCampaign && !pollingIncompletedBatchTimer){ // keep polling a campaign with message(s) in sent status
      pollingIncompletedBatchTimer = window.setTimeout(function(){
        readCampaignFromServer(pendingCampaign)
      }, 5000)
      //return
    }
    if (hasScheduledCampaign() && !pollingScheduledBatchTimer){
        pollingScheduledBatchTimer = window.setTimeout(function(){
          readCampaigns()
        }, 60000)
    }
  }
}

function isAnyLiveCampaign(){
  for (var campaign of campaignList){
    if (campaign.type != "tollfree"){
      //if (campaign.hasOwnProperty('scheduled') && campaign.scheduled == true)
      if (campaign.batchId == '')
        continue
      if (campaign.queuedCount){ // for a pending campaign with message in queue status
        return campaign
      }else{
        // for patching if campaign missed updated by batch completed notification
        if (campaign.message != ""){
          var total = campaign.queuedCount + campaign.sentCount + campaign.deliveredCount + campaign.unreachableCount
          if (total == 0){
            return campaign
          }
        }
      }
    }
  }
  return null
}

function isAllSentCampaign(){
  for (var campaign of campaignList){
    if (campaign.hasOwnProperty('scheduled') && campaign.scheduled == true)
      continue
    if (campaign.sentCount > 0){ // for a campaign with message in sent status
      return campaign
    }
  }
  return null
}

function hasScheduledCampaign(){
  for (var campaign of campaignList){
    if (campaign.batchId == '')
      return campaign
  }
  return null
}

function cancelScheduleWarning(creationTime){
  var r = confirm("Do you really want to cancel this scheduled campaign?");
    if (r == true) {
      cancelScheduledCampaign(creationTime)
    }
}

function cancelScheduledCampaign(creationTime){
  // cancel pollingScheduledBatchTimer
  if (pollingScheduledBatchTimer){
    window.clearTimeout(pollingScheduledBatchTimer)
  }
  pollingScheduledBatchTimer = undefined
  var url = `cancel-scheduled-campaign?creationTime=${creationTime}`
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      readCampaigns()
    }else if (res.status == "error"){
      _alert(res.message)
    }else{
      if (res.message)
        _alert(res.message)
      else
        _alert("You have been logged out. Please login again.")
      window.setTimeout(function(){
        window.location.href = "/relogin"
      },8000)
    }
  });
}

function formatEstimatedTimeLeft(dur){
  dur = Math.floor(dur)
  if (dur > 86400) {
    var d = Math.floor(dur / 86400)
    d = (d > 1) ? `${d} days` : `${d} day`
    dur = dur % 86400
    var h = Math.floor(dur / 3600)
    h = (h > 1) ? `${h} hours` : `${h} hour`
    dur = dur % 3600
    var m = Math.floor(dur / 60)
    m = (m > 1) ? `${m} mins` : `${m} min`
    //dur = dur % 60
    //var s = (dur > 1) ? `${dur} secs` : `${dur} sec`
    return `${d} ${h} and ${m}` //${s}`
  }else if (dur >= 3600){
    var h = Math.floor(dur / 3600)
    h = (h > 1) ? `${h} hours` : `${h} hour`
    dur = dur % 3600
    var m = Math.floor(dur / 60)
    m = (m > 1) ? `${m} mins` : `${m} min`
    //dur = dur % 60
    //var s = (dur > 1) ? `${dur} secs` : `${dur} sec`
    return `${h} and ${m}` // ${s}`
  }else if (dur >= 60){
    var m = Math.floor(dur / 60)
    m = (m > 1) ? `${m} mins` : `${m} min`
    //dur %= 60
    //var s = (dur > 1) ? `${dur} secs` : `${dur} sec`
    return m //`${m} ${s}`
  }else{
    //var s = (dur > 1) ? `${dur} secs` : `${dur} sec`
    return 'a minute' //`${s} secs`
  }
}
