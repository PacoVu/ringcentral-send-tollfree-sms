var mainMenuItem = "campaign-new"
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

function formatPhoneNumber(phoneNumberString, countryCode) {
  var cleaned = ('' + phoneNumberString).replace(/\D/g, '')
  var match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
  if (match) {
    var intlCode = (match[1] ? '+1 ' : '')
    if (countryCode)
      return [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
    else
      return ['(', match[2], ') ', match[3], '-', match[4]].join('')
  }
  return phoneNumberString
}
/*
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
      //isPolling = true
      pollResult()
    }, 5000)
  }else if (resp.result.status == "Completed" || resp.result.status == "Sent"){
    pendingBatch = false
    var createdAt = new Date(resp.result.creationTime).getTime()
    var lastUpdatedAt = new Date(resp.result.lastModifiedTime).getTime()
    var processingTime = (lastUpdatedAt - createdAt) / 1000
    $("#time").html("Duration : " + formatSendingTime(processingTime))
    var text = "Sent " + resp.result.processedCount + " out of " + resp.result.batchSize + " messages."
    $("#result").html(text)
    //isPolling = true // force to stop polling!
    //switchPollResult()
    startPollingResult(false)
    readReport()
  }
}
*/
/*
function readReport(){
  if (currentBatchId == "")
    return
  $("#report_block").show()
  $("#report").html("Reading report ...")
  var url = "getbatchreport?batchId=" + currentBatchId
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      var report = "<div>"
      for (var key of Object.keys(res.summaryReport)){
        if (key == "Total_Cost")
          report += "<div>" + key.replace(/_/g, " ") + ": " + res.summaryReport[key].toFixed(3) + " USD</div>"
        else
          report += "<div>" + key.replace(/_/g, " ") + ": " + res.summaryReport[key] + "</div>"
      }
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
////
*/

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

function _alert(msg, title, focusField){
  if (title == undefined)
    title = "Error"
  BootstrapDialog.show({
      title: `<div style="font-size:1.2em;font-weight:bold;color:white">${title}</div>`,
      message: msg,
      draggable: true,
      onhide : function(dialog) {
        $('#hidden-div-error').append(msg);
      },
      buttons: [{
        label: 'Close',
        action: function(dialog) {
          dialog.close();
          if (focusField)
            $(focusField).focus()
        }
      }]
  });
  return false;
}
