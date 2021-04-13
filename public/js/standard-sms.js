var canPoll = false
const SMS_COST = 0.007
const SMS_SEGMENT_LEN = 153
const SMS_MAX_LEN = 160
function init(){
  var jsonObj = JSON.parse(window.sendReport)
  if (jsonObj.sendInProgress){
    $("#progress").toggleClass("show")
    $("#control_panel").css('display', 'block');
    disableInputs(true)
    pollResult()
  }
}

function pollResult(){
  var url = "get-standard-sms-result"
  var getting = $.get( url );
  canPoll = true
  getting.done(function( res ) {
    if (res.sendInProgress == true) {
      window.setTimeout(function(){
        if (canPoll)
          pollResult()
      }, 1000)
    }else{
      disableInputs(false)
    }
    $("#time").html(res.sentInfo)
    $("#success").html(res.successCount)
    $("#failure").html(res.failedCount)
    /*
    if (res.failedCount.length > 0) {
      var htmlStr = ""
      for (var item of res['invalidNumbers']) {
        htmlStr += "<div>" + item.reason + ": " + item.number + "</div>"
      }
      $('#invalid-numbers').html(htmlStr)
    }
    */
  });
}

function disableInputs(flag){

  $("#from-number").prop("disabled", flag);
  $("#to-numbers").prop("disabled", flag);
  $("#message").prop("disabled", flag);
  $("#attachment").prop("disabled", flag);
  $("#send-message").prop("disabled", flag);

  if (flag){
    $("#send-message").toggleClass("btn-rc")
    $("#sendingAni").css('display', 'inline');
    $("#download_json").toggleClass("hide")
    $("#download_csv").toggleClass("hide")
  }else{
    $("#send-message").toggleClass("btn-rc")
    $("#sendingAni").css('display', 'none');
    $("#download_json").toggleClass("show")
    $("#download_csv").toggleClass("show")
    $("#control_panel").css('display', 'none');
  }
}

function setDelayInterVal(){
  var url = "setdelay"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok")
      alert(res.message)
    else
      alert(res.message)
  });
}

function pause_resume(){
  var title = $("#pause_resume").text()
  if (title == "Pause"){
    $("#pause_resume").text("Resume")
    $("#sendingAni").css('display', 'none');
    pauseMessageSending()
  }else{
    $("#pause_resume").text("Pause")
    resumeMessageSending()
  }
}

function pauseMessageSending(){
  var url = "pause"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok")
      canPoll = false
      //alert(res.message)
    else
      alert(res.message)
  });
}

function resumeMessageSending(){
  var url = "resume"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      $("#sendingAni").css('display', 'inline');
      pollResult()
    }else
      alert(res.message)
  });
}
function confirmCancel(){
  var r = confirm("Do you really want to cancel sending message?");
  if (r == true) {
    cancelMessageSending()
  }
}
function cancelMessageSending(){
  var url = "cancel"
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok"){
      canPoll = false
      disableInputs(false)
    }else
      alert(res.message)
  });
}

function downloadReport(format){
  var url = "download-standard-message-report?format="+format
  var getting = $.get( url );
  getting.done(function( res ) {
    if (res.status == "ok")
      window.location.href = res.message
    else
      alert(res.message)
  });
}

function countCharacter(elm){
  var text = $(elm).val()
  $("#charcount").html("SMS length: " + text.length + " chars.")
  if (text.length)
    updateEstimatedCost()
  else
    $("#estimated_cost").html("0.000 USD")
}

function fileSelected(elm){
  var file = elm.files[0]
  if (file) {
    var reader = new FileReader();
    reader.readAsText(file);
    reader.onload = function(e) {
      var numbersFromFile = e.target.result.trim().split("\r\n")
      numbersFromFile.shift()
      var directNumbers = $("#to-numbers").val().trim()
      if (directNumbers.length)
        directNumbers = directNumbers.split("\n").length
      calculateEstimatedCost((directNumbers + numbersFromFile.length))
    };
  }else{
    var directNumbers = $("#to-numbers").val().trim()
    if (directNumbers.length)
      directNumbers = directNumbers.split("\n").length
    calculateEstimatedCost(directNumbers)
  }
}
function calculateEstimatedCost(numberOfRecipients){
  var charCount = $("#message").val().length
  if (charCount == 0) return
  var coef = 1
  if (charCount > SMS_MAX_LEN){
    coef = g.charCount / SMS_SEGMENT_LEN
    coef = Math.ceil(coef)
  }

  var numberOfMessages = numberOfRecipients * coef
  var estimatedCost = numberOfMessages * SMS_COST
  var msg = `You are about to send a total of ${numberOfMessages} messages to ${numberOfRecipients} recipients.<br/>Your estimated cost will be $${estimatedCost.toFixed(3)} USD *.`
  if (numberOfRecipients == 0)
    msg = "$0.000 USD."
  $("#estimated_cost").html(msg)
}
function updateEstimatedCost(){
  fileSelected($("#attachment")[0])
}

function logout(){
  window.location.href = "index?n=1"
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
    if (res.status == "ok"){
      alert(res.message)
    }else
      alert(res.message)
  });
  return true
}

function launchRequestApp(){
  window.open("https://ringcentral.github.io/releases/high-volume-sms-beta-signup.html")
}
