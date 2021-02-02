var pollTimer = null

function switchPollResult(){
  $("#result_block").show()
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

function startPollingResult(poll){
  $("#result_block").show()
  if (poll){
    $("#sendingAni").css('display', 'inline');
    $("#polling_tips").css('display', 'inline');
    //$("#result_block").css('display', 'inline');
    $("#result_block").show();
  }else{
    if (pollTimer)
      window.clearTimeout(pollTimer)
    pollTimer = null
    $("#sendingAni").css('display', 'none');
    $("#polling_tips").css('display', 'none');
    $("#result_block").hide();
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
    $("#result_block").show()
    $("#sendingAni").css('display', 'inline');
  }else{
    $("#result_block").hide()
    $("#sendingAni").css('display', 'none');
  }
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

function parseResultResponse(resp){
  //currentBatchId = resp.result.id
  $("#control_block").show()
  $("#status").html("Status: " + resp.result.status)
  if (resp.result.status == "Processing"){
    pendingBatch = true
    // show the time since batch request was submited
    $("#time").html("Duration: " + resp.time)
    var text = "Sending " + resp.result.processedCount + " out of " + resp.result.batchSize + " messages."
    $("#result").html(text)
    pollTimer = window.setTimeout(function(){
      pollResult()
    }, 5000)
  }else if (resp.result.status == "Completed" || resp.result.status == "Sent"){
    pendingBatch = false
    startPollingResult(false)
    var createdAt = new Date(resp.result.creationTime).getTime()
    var lastUpdatedAt = new Date(resp.result.lastModifiedTime).getTime()
    var processingTime = (lastUpdatedAt - createdAt) / 1000
    $("#time").html("Duration : " + formatSendingTime(processingTime))
    var text = "Sent " + resp.result.processedCount + " out of " + resp.result.batchSize + " messages."
    $("#result").html(text)

    $("#report_block").show()
    readVoteResult()
  }
}

function readVoteResult(){
  var url = "getvoteresult"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      var report = ""
      var voteCounts = res.voteCounts
      report += "<div>" + res.voteStatus + "</div>"
      report += "<div>Sample message: " + res.voteQuestionair + "</div>"
      report += "<div>Total voters: " + voteCounts.Total + "</div>"
      report += "<div>Reached voters: " + voteCounts.Delivered + "/" + voteCounts.Total + "</div>"
      //report += "<div>Unreachable voters: " + voteCounts.Unreachable + "</div>"
      report += "<div>Voted voters: " + voteCounts.Replied + "/" + voteCounts.Delivered + "</div>"

      //report += "<div>Cost: " + voteCounts.Cost.toFixed(3) + " USD</div>"
      $("#report").html(report)
      if (!res.voteCompleted){
        window.setTimeout(function(){
          readVoteResult()
        }, 5000)
      }else{
        // read vote result
      }
      plotVoteResult(res.voteResults)
    }else if (res.status == "failed") {
      alert(res.message)
      window.location.href = "login"
    }else{
      alert(res.message)
    }
  });
}

function plotVoteResult(result){
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
    var element = document.getElementById("vote_result")
    var chart = new google.visualization.ColumnChart(element);
    //var chart = new google.visualization.PieChart(element);
    chart.draw(view, options);
}
////

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
