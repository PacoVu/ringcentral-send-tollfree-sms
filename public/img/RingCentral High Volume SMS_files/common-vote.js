var pollTimer = null
var campaignsList = []
/*
function switchPollResult(){
  $("#result-block").show()
  if (isPolling){
    if (pollTimer)
      window.clearTimeout(pollTimer)
    pollTimer = null
    isPolling = false
    $("#sendingAni").css('display', 'none');
    $("#polling_tips").css('display', 'none');
  }else{
    $("#sendingAni").css('display', 'inline');
    $("#polling_tips").css('display', 'inline');
    isPolling = true
    pollResult()
  }
}
preview-block
result-block
report-block
vote_report-block
*/

function showBlock(block){
    $("#control-block").show()
    switch (block){
      case "result":
        $("#preview-block").hide();
        $("#report-block").hide();
        $("#vote-report-block").hide();
        $("#result-block").show();
        break
      case "report":
        $("#vote-report-block").hide();
        $("#result-block").hide();
        $("#report-block").show();
        break
      case "vote-report":
        $("#report-block").hide();
        $("#result-block").hide();
        $("#vote-report-block").show();
        break
      case "preview":
        $("#result-block").hide();
        $("#report-block").hide();
        $("#vote-report-block").hide();
        $("#preview-block").show();
        break
      default:
        $("#control-block").hide()
        break
    }
}

function startPollingResult(poll){
  if (poll){
    $("#sendingAni").css('display', 'inline');
    $("#polling-tips").css('display', 'inline');
    pollResult()
  }else{
    if (pollTimer)
      window.clearTimeout(pollTimer)
    pollTimer = null
    $("#sendingAni").css('display', 'none');
    $("#polling-tips").css('display', 'none');
  }
}

function pollResult(){
  if (currentBatchId == "")
    return
  var url = "getbatchresult?batchId=" + currentBatchId
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      parseResultResponse(res)
    }else {
      alert(res.message)
    }
  });
}

function showResult(flag){
  if (flag){
    $("#result-block").show()
    $("#sendingAni").css('display', 'inline');
  }else{
    $("#result-block").hide()
    $("#sendingAni").css('display', 'none');
  }
}
/*
function deleteCampaignResult(batchId){
  var url = `deletecampainresult?batchId=${batchId}`
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok")
      readVoteResult()
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
      alert(res)
  });
}
*/
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
      alert(res)
  });
}

function downloadBatchReport(batchId){
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var url = "downloadbatchreport?batchId=" + batchId + "&timeOffset=" + timeOffset
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok")
      window.location.href = res.message
    else
      alert(res.message)
  });
}
/*
function downloadBatchReport(format){
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
*/
function downloadVoteReport(format){
  var timeOffset = new Date().getTimezoneOffset()*60000;
  var url = "downloadvotereport?format=" + format + "&timeOffset=" + timeOffset
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok")
      window.location.href = res.message
    else
      alert(res.message)
  });
}

function parseResultResponse(resp){

  $("#status").html("Status: " + resp.result.status)
  if (resp.result.status == "Processing"){
    pendingBatch = true
    // show the time since batch request was submited
    $("#time").html("Duration: " + resp.time)
    var text = "Sending " + resp.result.processedCount + " out of " + resp.result.batchSize + " messages."
    $("#result").html(text)
    pollTimer = window.setTimeout(function(){
      pollResult()
    }, 2000)
  }else if (resp.result.status == "Completed" || resp.result.status == "Sent"){
    pendingBatch = false
    startPollingResult(false)
    var createdAt = new Date(resp.result.creationTime).getTime()
    var lastUpdatedAt = new Date(resp.result.lastModifiedTime).getTime()
    var processingTime = (lastUpdatedAt - createdAt) / 1000
    $("#time").html("Duration : " + formatSendingTime(processingTime))
    var text = "Sent " + resp.result.processedCount + " out of " + resp.result.batchSize + " messages."
    $("#result").html(text)
    nextView("cancel")
    readCampaigns()
    /* close to move back to history page and show report there
    if (resp.type == "vote"){
      showBlock("vote-report")
      readVoteResult()
    }else{
      showBlock("report")
      readReport()
    }
    */
  }
}
var reload = true
function readVoteResult(){
  var url = "getvoteresult"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      var report = ""
      var graphDataArr = []
      var i = 0
      reload = false
      report = createReportBlock(res.voteCampaignArr, graphDataArr, i)
      /*
      i = 2
      report += createReportBlock(res.voteCampaignArr, graphDataArr, reload, i)
      i = 4
      report += createReportBlock(res.voteCampaignArr, graphDataArr, reload, i)
      */
      //report += "<div>Cost: " + voteCounts.Cost.toFixed(3) + " USD</div>"
      if (report == "")
        showBlock("")
      else{
        $("#vote-report").html(report)
        for (var n=0; n<graphDataArr.length; n++){
          plotVoteResult_port(graphDataArr[n], n+1)
        }
        if (reload){
          //alert("reload in 5 secs")
          window.setTimeout(function(){
            readVoteResult()
          }, 5000)
        }else{
          // read vote result
        }
      }

      //plotVoteResult(res.voteResults)
    }else if (res.status == "failed") {
      alert(res.message)
      window.location.href = "login"
    }else{
      alert(res.message)
    }
  });
}

function createReportBlock(voteCampaignArr, graphDataArr, i){
  var report = ""
  var timeOffset = new Date().getTimezoneOffset()*60000;
  for (var service of voteCampaignArr){
    for (var campaign of service.campaigns){
      var voteCounts = campaign.voteCounts
      report += "<div class='row col-lg-12 block_space'>"
      report += "<div class='col-lg-5'>"
      report += "<div><b>Service number:</b> " + formatPhoneNumber(service.serviceNumber) + "</div>"
      report += "<div>Campaign name: " + campaign.campaignName + "</div>"

      var dateStr = new Date((campaign.startDateTime - timeOffset)).toISOString()
      dateStr = dateStr.replace("T", " ").substring(0, 19)
      report += "<div>Created time: " + dateStr + "</div>"
      var status = "Status: response period is closed"
      if (campaign.status == "Completed"){
        status = "Status: campaign is completed."
      }else if(campaign.status == "Active"){
        var now = new Date().getTime()
        var expire = campaign.endDateTime - now
        if (expire >= 0){
          status = "Status: response period expires in " + formatSendingTime(expire/1000)
          reload = true
        }else{
          status = "Status: response period is closed"
        }
      }
      report += "<div>" + status + "</div>"
      report += "<div>Message: " + campaign.message + "</div>"
      report += "<div>Total: " + voteCounts.Total + " recipients</div>"
      report += "<div>Unreached: " + voteCounts.Unreachable + "/" + voteCounts.Total + "</div>"
      report += "<div>Reached: " + voteCounts.Delivered + "/" + voteCounts.Total + "</div>"
      report += "<div>Replied: " + voteCounts.Replied + "/" + voteCounts.Delivered + "</div>"
      report += "</div>"
      i++
      report += `<div id='vote-result-${i}' class='col-lg-5'></div>`

      //if (campaign.status != "Active"){
        report += `<div class='col-lg-12'><b>Important:</b> Please download the campaign result now. This campaign result will be deleted in 24 hours!</div>`
        report += `<div class='col-lg-12'><a href="javascript:downloadCampaignResult('${campaign.batchId}','${service.serviceNumber}')">Download Result</a> | `
        report += `<a href="javascript:deleteCampaignResult('${campaign.batchId}')">Delete Result</a></div>`
      //}
      report += "<hr class='col-lg-12 style='margin: 2px !important'></hr>"
      report += "</div>"
      graphDataArr.push(campaign.voteResults)
    }
  }
  return report
}

function plotVoteResult_single(result){
    var params = [];
    var color = ['blue', 'green', 'orange']
    var arr = ['Results', '#', { role: "style" } ];
    params.push(arr);
    var i = 0
    for (var key of Object.keys(result)){
      var item = [key, result[key], color[i]];
      params.push(item);
      i++
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

    var options = {
      title: params[0][0],
      vAxis: {minValue: 0},
      hAxis: {minValue: 0},
      width: 300,
      height: 200,
      bar: {groupWidth: "40%"},
      legend: { position: "none" },
    };
    /*
    var options = {
      title: 'Results (# votes)',
      width: 400,
      height: 300,
      pieHole: 0.4,
    };
    */

    var elm = `vote-result`
    //alert(elm)
    var element = document.getElementById(elm)
    var chart = new google.visualization.ColumnChart(element);
    //var chart = new google.visualization.PieChart(element);
    chart.draw(view, options);
}

function plotVoteResult_port(result, index){
    var params = [];
    var color = ['blue', 'green', 'orange']
    var arr = ['Results', '#', { role: "style" } ];
    params.push(arr);
    var i = 0
    for (var key of Object.keys(result)){
      var item = [key, result[key], color[i]];
      params.push(item);
      i++
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

    var options = {
      title: params[0][0],
      vAxis: {minValue: 0},
      hAxis: {minValue: 0},
      width: 300,
      height: 200,
      bar: {groupWidth: "40%"},
      legend: { position: "none" },
    };
    /*
    var options = {
      title: 'Results (# votes)',
      width: 400,
      height: 300,
      pieHole: 0.4,
    };
    */

    var elm = `vote-result-${index}`
    //alert(elm)
    var element = document.getElementById(elm)
    var chart = new google.visualization.ColumnChart(element);
    //var chart = new google.visualization.PieChart(element);
    chart.draw(view, options);
}

////

function readReport(){
  if (currentBatchId == "")
    return
  $("#report").html("Reading report ...")
  var url = "getbatchreport?batchId=" + currentBatchId
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      var report = "<div>"
      //batchId: "", use this for download to avoid keeping large report campaign
      var campaign = res.summaryReport
      var timeOffset = new Date().getTimezoneOffset()*60000;
      var dateStr = new Date((campaign.created - timeOffset)).toISOString()
      dateStr = dateStr.replace("T", " ").substring(0, 19)
      report += `<div><label class="report-label">Name:</label> ${campaign.campaignName}</div>`
      report += `<div><label class="report-label">Created:</label> ${dateStr}</div>`
      report += `<div><label class="report-label">Sent from:</label> ${formatPhoneNumber(campaign.serviceNumber)}</div>`
      if (campaign.type == "group")
        report += `<div><label class="report-label">Broadcast message:</label> ${campaign.message}</div>`
      else
        report += `<div><label class="report-label">Template message:</label> ${campaign.message}</div>`

      report += `<div><label class="report-label">Total recipients:</label> ${campaign.total}</div>`
      report += `<div><label class="report-label">Unreached:</label> ${campaign.unreachableCount}/${campaign.total}</div>`
      report += `<div><label class="report-label">Reached:</label> ${campaign.deliveredCount}/${campaign.total}</div>`
      report += `<div><label class="report-label">Cost:</label> ${campaign.totalCost} USD</div>`
      report += "</div>"
      $("#report").html(report)
    }else if (res.status == "failed") {
      alert(res.message)
      window.location.href = "login"
    }else{
      alert(res.message)
    }
  });
}

function logout(){
  window.location.href = "index?n=1"
}

function formatSendingTime(processingTime){
  var hour = Math.floor(processingTime / 3600)
  hour = (hour < 10) ? "0"+hour : hour
  var mins = Math.floor((processingTime % 3600) / 60)
  mins = (mins < 10) ? "0"+mins : mins
  var secs = Math.floor(((processingTime % 3600) % 60))
  secs = (secs < 10) ? "0"+secs : secs
  return `${hour}:${mins}:${secs}`
}

function formatPhoneNumber(phoneNumberString) {
  var cleaned = ('' + phoneNumberString).replace(/\D/g, '')
  var match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
  if (match) {
    var intlCode = (match[1] ? '+1 ' : '')
    return [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
  }
  return phoneNumberString
}

function openWindow(){
  window.open("https://github.com/PacoVu/ringcentral-send-tollfree-sms/issues")
}
function openFeedbackForm(){
  var message = $('#send_feedback_form');
  BootstrapDialog.show({
      title: '<div style="font-size:1.2em;font-weight:bold;">Send us your feedback!</div><div>Do you have a suggestion or found some bugs? Let us know in the field below:</div>',
      message: message,
      draggable: true,
      onhide : function(dialog) {
        $('#hidden-div-feedback').append(message);
      },
      buttons: [{
        label: 'Close',
        action: function(dialog) {
          dialog.close();
        }
      }, {
        label: 'Send Feedback',
        cssClass: 'btn btn-primary',

        action: function(dialog) {
          var params = {
            user_name: window.userName,
            emotion: $('input[name=emoji]:checked').val(),
            type: $("#feedback_type").val(),
            message: $("#free_text").val()
          }
          if (submitFeedback(params))
            dialog.close();
        }
      }]
  });
  return false;
}

function submitFeedback(params){
  var url = "sendfeedback"
  var posting = $.post( url, params );
  posting.done(function( res ) {
    alert(res.message)
  });
  return true
}
